"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { generateCode, renderVideo, setSettings } from "../lib/api";
import HistoryTabList from "./components/HistoryTabList";
import SceneNodeTree from "./components/SceneNodeTree";
import {
  HistoryTab,
  SceneNode,
  VideoSettings,
  createNewTab,
  generateId,
  getAncestryChain,
  getDescendantIds,
  dateReviver,
} from "./types";

// ========== RESOLUTION PRESETS ==========
const RESOLUTION_PRESETS: Record<string, { width: number; height: number; quality: VideoSettings["quality"] }> = {
  "480p": { width: 854, height: 480, quality: "low" },
  "720p": { width: 1280, height: 720, quality: "medium" },
  "1080p": { width: 1920, height: 1080, quality: "high" },
  "4K": { width: 3840, height: 2160, quality: "ultra" },
};

const FPS_OPTIONS = [24, 30, 60];

type Status = "ready" | "rendering" | "error";

// ========== MAIN COMPONENT ==========
export default function HomePage() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
  const [sessionId] = useState(() => Math.random().toString(36).slice(2));

  // UI State
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<Status>("ready");
  const [wrapCode, setWrapCode] = useState(false);
  const [fontSize, setFontSize] = useState(13);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Multi-tab project state
  const [tabs, setTabs] = useState<HistoryTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  // Current display state (derived from active tab/node)
  const [currentCode, setCurrentCode] = useState("");
  const [currentLogs, setCurrentLogs] = useState("");
  const [currentVideoUrl, setCurrentVideoUrl] = useState("");
  const [currentSceneName, setCurrentSceneName] = useState("GeneratedScene.py");

  // Settings State
  const [resolution, setResolution] = useState("480p");
  const [fps, setFps] = useState(30);

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);

  // ========== DERIVED STATE ==========
  const getActiveTab = useCallback((): HistoryTab | null => {
    return tabs.find(t => t.id === activeTabId) || null;
  }, [tabs, activeTabId]);

  const getActiveNode = useCallback((): SceneNode | null => {
    const tab = getActiveTab();
    if (!tab || !tab.activeNodeId) return null;
    return tab.nodes.find(n => n.id === tab.activeNodeId) || null;
  }, [getActiveTab]);

  // Check if current tab has any nodes (determines button label)
  const tabHasNodes = useCallback((): boolean => {
    const tab = getActiveTab();
    return tab ? tab.nodes.length > 0 : false;
  }, [getActiveTab]);

  // ========== EFFECTS ==========
  // Load tabs from localStorage on mount
  useEffect(() => {
    const savedTabs = localStorage.getItem("automanim-tabs");
    const savedActiveTabId = localStorage.getItem("automanim-active-tab");
    const savedResolution = localStorage.getItem("automanim-resolution");
    const savedFps = localStorage.getItem("automanim-fps");
    const savedFontSize = localStorage.getItem("automanim-fontsize");

    if (savedTabs) {
      try {
        const parsed = JSON.parse(savedTabs, dateReviver) as HistoryTab[];
        setTabs(parsed);
        if (savedActiveTabId && parsed.some(t => t.id === savedActiveTabId)) {
          setActiveTabId(savedActiveTabId);
        } else if (parsed.length > 0) {
          setActiveTabId(parsed[0].id);
        }
      } catch (e) {
        console.error("Failed to parse saved tabs:", e);
      }
    }

    if (savedResolution) setResolution(savedResolution);
    if (savedFps) setFps(parseInt(savedFps, 10));
    if (savedFontSize) setFontSize(parseInt(savedFontSize, 10));
  }, []);

  // Save tabs to localStorage on change
  useEffect(() => {
    if (tabs.length > 0) {
      localStorage.setItem("automanim-tabs", JSON.stringify(tabs));
    }
  }, [tabs]);

  useEffect(() => {
    if (activeTabId) {
      localStorage.setItem("automanim-active-tab", activeTabId);
    }
  }, [activeTabId]);

  useEffect(() => {
    localStorage.setItem("automanim-resolution", resolution);
  }, [resolution]);

  useEffect(() => {
    localStorage.setItem("automanim-fps", fps.toString());
  }, [fps]);

  useEffect(() => {
    localStorage.setItem("automanim-fontsize", fontSize.toString());
  }, [fontSize]);

  // Sync display state when active node changes
  useEffect(() => {
    const node = getActiveNode();
    if (node) {
      setCurrentCode(node.code);
      setCurrentLogs(node.logs);
      setCurrentVideoUrl(node.videoUrl);
      setCurrentSceneName(node.sceneName || "GeneratedScene.py");

      // Map node status to UI status
      if (node.status === "generating" || node.status === "rendering") {
        setStatus("rendering");
      } else if (node.status === "error") {
        setStatus("error");
      } else {
        setStatus("ready");
      }
    } else {
      // Clear display if no active node
      setCurrentCode("");
      setCurrentLogs("");
      setCurrentVideoUrl("");
      setCurrentSceneName("GeneratedScene.py");
      setStatus("ready");
    }
  }, [tabs, activeTabId, getActiveNode]);

  // Build settings object
  const getVideoSettings = useCallback((): VideoSettings => {
    const preset = RESOLUTION_PRESETS[resolution] || RESOLUTION_PRESETS["480p"];
    return {
      resolution_width: preset.width,
      resolution_height: preset.height,
      fps,
      quality: preset.quality,
    };
  }, [resolution, fps]);

  // Cache bust helper
  const withCacheBust = (url?: string | null) =>
    url ? `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}` : "";

  // Centralized display sync helper
  const syncDisplayToNode = useCallback((node: SceneNode | null) => {
    if (node) {
      setCurrentCode(node.code);
      setCurrentLogs(node.logs);
      setCurrentVideoUrl(node.videoUrl);
      setCurrentSceneName(node.sceneName || "GeneratedScene.py");
      if (node.status === "generating" || node.status === "rendering") {
        setStatus("rendering");
      } else if (node.status === "error") {
        setStatus("error");
      } else {
        setStatus("ready");
      }
    } else {
      setCurrentCode("");
      setCurrentLogs("");
      setCurrentVideoUrl("");
      setCurrentSceneName("GeneratedScene.py");
      setStatus("ready");
    }
  }, []);

  // ========== TAB/NODE MANAGEMENT ==========
  const handleCreateNewTab = useCallback(() => {
    const newTab = createNewTab(resolution, fps, tabs.length + 1);
    setTabs(prev => [newTab, ...prev]);
    setActiveTabId(newTab.id);
    setPrompt("");
    syncDisplayToNode(null);
  }, [resolution, fps, tabs.length, syncDisplayToNode]);

  const handleTabSelect = useCallback((tabId: string) => {
    setActiveTabId(tabId);
    setPrompt("");

    // Immediately sync display state to the selected tab's active node
    const selectedTab = tabs.find(t => t.id === tabId);
    if (selectedTab && selectedTab.activeNodeId) {
      const activeNode = selectedTab.nodes.find(n => n.id === selectedTab.activeNodeId) || null;
      syncDisplayToNode(activeNode);
    } else {
      syncDisplayToNode(null);
    }
  }, [tabs, syncDisplayToNode]);

  const handleTabDelete = useCallback((tabId: string) => {
    setTabs(prev => {
      const newTabs = prev.filter(t => t.id !== tabId);
      // Determine new active tab if we deleted the active one
      if (activeTabId === tabId) {
        if (newTabs.length > 0) {
          const newActiveTab = newTabs[0];
          setActiveTabId(newActiveTab.id);

          // Sync display state to the new active tab's node
          if (newActiveTab.activeNodeId) {
            const activeNode = newActiveTab.nodes.find(n => n.id === newActiveTab.activeNodeId) || null;
            syncDisplayToNode(activeNode);
          } else {
            syncDisplayToNode(null);
          }
        } else {
          setActiveTabId(null);
          setPrompt("");
          syncDisplayToNode(null);
        }
      }
      return newTabs;
    });
  }, [activeTabId, syncDisplayToNode]);

  const handleNodeSelect = useCallback((nodeId: string) => {
    setTabs(prev => prev.map(tab => {
      if (tab.id === activeTabId) {
        return { ...tab, activeNodeId: nodeId, updatedAt: new Date() };
      }
      return tab;
    }));
  }, [activeTabId]);

  const handleNodeDelete = useCallback((nodeId: string) => {
    const tab = getActiveTab();
    if (!tab) return;

    // Find all descendants to delete
    const idsToDelete = new Set(getDescendantIds(tab.nodes, nodeId));

    // Find parent of the deleted node
    const nodeToDelete = tab.nodes.find(n => n.id === nodeId);
    const parentId = nodeToDelete?.parentId || null;

    setTabs(prev => prev.map(t => {
      if (t.id === tab.id) {
        const remainingNodes = t.nodes.filter(n => !idsToDelete.has(n.id));

        let newActiveId = t.activeNodeId;
        if (t.activeNodeId && idsToDelete.has(t.activeNodeId)) {
          newActiveId = parentId;
        }

        return {
          ...t,
          nodes: remainingNodes,
          activeNodeId: newActiveId,
          updatedAt: new Date(),
        };
      }
      return t;
    }));
  }, [activeTabId, getActiveTab]);

  const handleNodeRetry = useCallback(async (nodeId: string) => {
    const tab = getActiveTab();
    if (!tab) return;

    // Find the node to retry
    const nodeToRetry = tab.nodes.find(n => n.id === nodeId);
    if (!nodeToRetry) return;

    // Delete all descendants of this node (but keep the node itself for now)
    const descendantIds = new Set(getDescendantIds(tab.nodes, nodeId));
    descendantIds.delete(nodeId); // Keep the node we're retrying

    // Get the parent node for context building
    const parentNode = nodeToRetry.parentId
      ? tab.nodes.find(n => n.id === nodeToRetry.parentId) || null
      : null;

    // Remove descendants and the node itself (we'll create a new one)
    setTabs(prev => prev.map(t => {
      if (t.id === tab.id) {
        const remainingNodes = t.nodes.filter(n => !descendantIds.has(n.id) && n.id !== nodeId);
        return {
          ...t,
          nodes: remainingNodes,
          activeNodeId: parentNode?.id || null,
          updatedAt: new Date(),
        };
      }
      return t;
    }));

    // Now trigger regeneration with the same prompt
    setPrompt(nodeToRetry.prompt);

    // Wait a tick for state to update, then trigger generation
    setTimeout(() => {
      // Set prompt and let user click generate, or auto-trigger
      const generateBtn = document.querySelector('.btn-generate') as HTMLButtonElement;
      if (generateBtn && !generateBtn.disabled) {
        generateBtn.click();
      }
    }, 100);
  }, [getActiveTab, setPrompt]);

  // Update a node in a specific tab
  const updateNodeInTab = useCallback((tabId: string, nodeId: string, updates: Partial<SceneNode>) => {
    setTabs(prev => prev.map(tab => {
      if (tab.id === tabId) {
        return {
          ...tab,
          updatedAt: new Date(),
          nodes: tab.nodes.map(n => n.id === nodeId ? { ...n, ...updates } : n),
        };
      }
      return tab;
    }));
  }, []);

  // ========== CONTEXT BUILDING ==========
  const buildContextForLLM = useCallback((tab: HistoryTab, parentNode: SceneNode | null): string => {
    if (!parentNode) {
      // Root node - no prior context
      return "";
    }

    // Get ancestry chain
    const ancestry = getAncestryChain(tab.nodes, parentNode.id);

    // Build context summary
    const contextParts = ancestry.map((node, idx) => {
      const prefix = idx === 0 ? "Initial request" : `Update ${idx}`;
      return `${prefix}: "${node.prompt}"\nCode:\n${node.code}`;
    });

    return contextParts.join("\n\n---\n\n");
  }, []);

  // ========== HANDLERS ==========
  const handleGenerate = async () => {
    if (!prompt.trim() || status === "rendering") return;

    // Ensure we have an active tab
    let currentTab = getActiveTab();
    if (!currentTab) {
      // Auto-create first tab if none exists
      const newTab = createNewTab(resolution, fps, 1);
      setTabs([newTab]);
      setActiveTabId(newTab.id);
      currentTab = newTab;
    }

    // Capture tab ID to ensure consistency in async callbacks
    const targetTabId = currentTab.id;

    const parentNode = getActiveNode();
    const isUpdate = currentTab.nodes.length > 0;

    setStatus("rendering");
    setCurrentLogs(isUpdate ? "Updating scene...\n" : "Generating code...\n");

    try {
      // Send settings first
      await setSettings(backendUrl, sessionId, getVideoSettings());

      // Build context from ancestry if updating
      const contextSummary = buildContextForLLM(currentTab, parentNode);
      const parentCode = parentNode?.code || undefined;

      // Generate code with context
      const res = await generateCode(backendUrl, {
        session_id: sessionId,
        prompt: prompt.trim(),
        parent_code: parentCode,
        context_summary: contextSummary || undefined,
      });

      if (res.code === -1) {
        setStatus("error");
        setCurrentLogs("Error: I specialize in Manim only. Let's stick to that.");
        return;
      }

      const newCode = res.code;
      const sceneName = res.scene_class ? `${res.scene_class}.py` : "GeneratedScene.py";

      // Create new scene node
      const newNode: SceneNode = {
        id: generateId(),
        parentId: parentNode?.id || null,
        prompt: prompt.trim(),
        code: newCode,
        videoUrl: "",
        logs: "Code generated. Rendering...",
        status: "rendering",
        createdAt: new Date(),
        sceneName,
        summary: isUpdate ? `Updated from: "${parentNode?.prompt?.slice(0, 30)}..."` : undefined,
      };

      // Add node to tab and set as active
      setTabs(prev => prev.map(tab => {
        if (tab.id === targetTabId) {
          // Update tab title if this is the first node
          const title = tab.nodes.length === 0
            ? prompt.trim().slice(0, 25) + (prompt.length > 25 ? "..." : "")
            : tab.title;
          return {
            ...tab,
            title,
            updatedAt: new Date(),
            nodes: [...tab.nodes, newNode],
            activeNodeId: newNode.id,
          };
        }
        return tab;
      }));

      setCurrentCode(newCode);
      setCurrentSceneName(sceneName);
      setCurrentLogs(prev => prev + "Code generated. Starting render...\n");
      setPrompt("");

      // Auto-render
      const settings = getVideoSettings();
      const rendered = await renderVideo(backendUrl, {
        session_id: sessionId,
        code: newCode,
        scene_class: sceneName.replace(".py", "") || undefined,
        settings,
        preview: false,
      });

      if (rendered.log) {
        setCurrentLogs(rendered.log);
      }

      if (rendered.success && rendered.video_url) {
        const videoUrl = withCacheBust(rendered.video_url);
        setCurrentVideoUrl(videoUrl);
        setStatus("ready");

        // Update node with video
        updateNodeInTab(targetTabId, newNode.id, {
          videoUrl,
          logs: rendered.log || "Render complete.",
          status: "success",
        });
      } else {
        setStatus("error");
        const errorLog = rendered.log || "Render failed. Check your code for errors.";
        setCurrentLogs(errorLog);

        updateNodeInTab(targetTabId, newNode.id, {
          logs: errorLog,
          status: "error",
        });
      }

    } catch (e: any) {
      setStatus("error");
      const errorMsg = `Error: ${e?.message || "Failed to generate"}`;
      setCurrentLogs(errorMsg);
    }
  };

  const handleDownloadVideo = async () => {
    if (!currentVideoUrl) return;
    try {
      const fullUrl = `${backendUrl}${currentVideoUrl}`;
      const response = await fetch(fullUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = currentSceneName.replace(".py", ".mp4");
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Failed to download video:", e);
    }
  };

  const handleRenderOnly = async () => {
    if (!currentCode || status === "rendering") return;

    const targetTab = getActiveTab();
    if (!targetTab) return;

    setStatus("rendering");
    setCurrentLogs("Starting render...\n");

    try {
      const settings = getVideoSettings();
      await setSettings(backendUrl, sessionId, settings);

      const rendered = await renderVideo(backendUrl, {
        session_id: sessionId,
        code: currentCode,
        scene_class: currentSceneName.replace(".py", "") || undefined,
        settings,
        preview: false,
      });

      if (rendered.log) {
        setCurrentLogs(rendered.log);
      }

      if (rendered.success && rendered.video_url) {
        const videoUrl = withCacheBust(rendered.video_url);
        setCurrentVideoUrl(videoUrl);
        setStatus("ready");

        // Update active node if exists
        const activeNode = getActiveNode();
        if (activeNode) {
          updateNodeInTab(targetTab.id, activeNode.id, {
            videoUrl,
            logs: rendered.log || "Render complete.",
            status: "success",
          });
        }
      } else {
        setStatus("error");
      }
    } catch (e: any) {
      setStatus("error");
      setCurrentLogs(`Error: ${e?.message || "Render failed"}`);
    }
  };

  const handleCopyCode = async () => {
    if (!currentCode) return;
    try {
      await navigator.clipboard.writeText(currentCode);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  };

  const handleDownloadCode = () => {
    if (!currentCode) return;
    const blob = new Blob([currentCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = currentSceneName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key === "Enter") {
      e.preventDefault();
      handleGenerate();
    }
  };

  // ========== RENDER HELPERS ==========
  const renderLogs = (text: string) => {
    if (!text) return <span className="dock-content-placeholder">Logs will appear here...</span>;

    const lines = text.split(/\r?\n/);
    return lines.map((line, idx) => {
      let className = "log-line";
      if (line.includes("[ERROR]") || line.includes("Error:")) {
        className += " log-line--error";
      } else if (line.includes("[INFO]")) {
        className += " log-line--info";
      } else if (line.includes("[SUCCESS]") || line.includes("success")) {
        className += " log-line--success";
      }
      return <div key={idx} className={className}>{line}</div>;
    });
  };

  const getStatusPillClass = () => {
    if (status === "rendering") return "status-pill status-pill--rendering";
    if (status === "error") return "status-pill status-pill--error";
    return "status-pill";
  };

  const getStatusText = () => {
    if (status === "rendering") return "Rendering";
    if (status === "error") return "Error";
    return "Ready";
  };

  // Get button label based on tab state
  const getGenerateButtonLabel = () => {
    return tabHasNodes() ? "Update Scene" : "Generate Scene";
  };

  // Get active tab for rendering
  const activeTab = getActiveTab();

  // ========== RENDER ==========
  return (
    <div className="app-container">
      {/* Top Bar */}
      <header className="top-bar">
        <div className="top-bar-left">
          <button className="btn-new-scene" onClick={handleCreateNewTab}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Scene
          </button>
          <span className="brand">
            <span className="brand-bracket">[</span> <span className="brand-bracket">]</span> automanim
          </span>
          <span className={getStatusPillClass()}>
            <span className="status-dot" />
            {getStatusText()}
          </span>
        </div>
        <div className="top-bar-right">
          <div className="dropdown-chip">
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              aria-label="Resolution"
            >
              {Object.keys(RESOLUTION_PRESETS).map(res => (
                <option key={res} value={res}>{res}</option>
              ))}
            </select>
          </div>
          <div className="dropdown-chip">
            <select
              value={fps}
              onChange={(e) => setFps(parseInt(e.target.value, 10))}
              aria-label="FPS"
            >
              {FPS_OPTIONS.map(f => (
                <option key={f} value={f}>{f} FPS</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="main-content">
        {/* Left Panel */}
        <aside className="left-panel">
          <span className="section-label">Chat</span>
          <textarea
            ref={textareaRef}
            className="chat-textarea"
            placeholder={
              tabHasNodes()
                ? "Describe how to update the scene…"
                : "Describe the animation you want to create…"
            }
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="hint-row">
            Press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to {tabHasNodes() ? "update" : "generate"}
          </div>
          <button
            className="btn-generate"
            onClick={handleGenerate}
            disabled={status === "rendering" || !prompt.trim()}
          >
            {getGenerateButtonLabel()}
          </button>

          {/* History Tab List */}
          <HistoryTabList
            tabs={tabs}
            activeTabId={activeTabId}
            onTabSelect={handleTabSelect}
            onTabDelete={handleTabDelete}
          />

          {/* Scene Node Tree (inside active tab) */}
          {activeTab && (
            <div className="scene-tree-section">
              <span className="section-label">Scene History</span>
              <SceneNodeTree
                nodes={activeTab.nodes}
                activeNodeId={activeTab.activeNodeId}
                onNodeSelect={handleNodeSelect}
                onNodeDelete={handleNodeDelete}
                onNodeRetry={handleNodeRetry}
              />
            </div>
          )}
        </aside>

        {/* Right Panel */}
        <section className="right-panel">
          <div className="preview-header">
            <span className="preview-title">
              <span className="preview-title-bracket">[Preview]</span> {currentSceneName}
            </span>
            <div className="preview-meta">
              <span>Status: {status === "ready" ? "—" : getStatusText()}</span>
              <span>Res: {resolution}</span>
            </div>
          </div>

          <div className="preview-container">
            <div className="preview-frame">
              {/* Corner ticks */}
              <div className="preview-ticks" />
              <span className="corner-tick corner-tick--tr" />
              <span className="corner-tick corner-tick--v corner-tick--tr-v" />
              <span className="corner-tick corner-tick--bl" />
              <span className="corner-tick corner-tick--v corner-tick--bl-v" />

              {currentVideoUrl ? (
                <video
                  className="preview-video"
                  src={`${backendUrl}${currentVideoUrl}?t=${Date.now()}`}
                  controls
                  autoPlay
                  loop
                  muted
                  key={`${activeTabId}-${activeTab?.activeNodeId}-${currentVideoUrl}`}
                />
              ) : (
                <div className="preview-empty">
                  <p className="preview-empty-title">No render yet</p>
                  <p className="preview-empty-hint">
                    Type a prompt <span className="preview-empty-arrow">→</span> {getGenerateButtonLabel()}
                    <kbd>Ctrl</kbd><kbd>Enter</kbd>
                  </p>
                </div>
              )}
            </div>

            <button
              className="btn-render"
              onClick={handleDownloadVideo}
              disabled={!currentVideoUrl || status === "rendering"}
            >
              Save Video
            </button>
          </div>
        </section>
      </main>

      {/* Bottom Dock - Fixed 40% */}
      <div className="dock" ref={dockRef}>
        <div className="dock-split">
          {/* Code Panel */}
          <div className="dock-panel dock-panel--code">
            <div className="dock-panel-header">
              <span className="dock-panel-title">CODE</span>
              <div className="dock-controls">
                <button className="dock-btn" onClick={handleCopyCode} disabled={!currentCode}>
                  Copy
                </button>
                <button className="dock-btn" onClick={handleDownloadCode} disabled={!currentCode}>
                  Download
                </button>
                <button
                  className={`dock-btn ${wrapCode ? "dock-btn--active" : ""}`}
                  onClick={() => setWrapCode(!wrapCode)}
                >
                  Wrap
                </button>
                <div className="dock-btn-group">
                  <button
                    className="dock-btn"
                    onClick={() => setFontSize(Math.max(10, fontSize - 1))}
                  >
                    A-
                  </button>
                  <button
                    className="dock-btn"
                    onClick={() => setFontSize(Math.min(20, fontSize + 1))}
                  >
                    A+
                  </button>
                </div>
              </div>
            </div>
            <div
              className={`dock-content ${!wrapCode ? "dock-content--nowrap" : ""}`}
              style={{ fontSize, overflow: "scroll", flex: "1 1 0", minHeight: 0, maxHeight: "100%" }}
            >
              {currentCode ? (
                <SyntaxHighlighter
                  language="python"
                  style={vscDarkPlus}
                  showLineNumbers={true}
                  wrapLines={wrapCode}
                  customStyle={{
                    margin: 0,
                    padding: "12px",
                    background: "transparent",
                    fontSize: `${fontSize}px`,
                    minWidth: wrapCode ? "auto" : "max-content",
                  }}
                  lineNumberStyle={{
                    minWidth: "3em",
                    paddingRight: "1em",
                    color: "#525252",
                    userSelect: "none",
                  }}
                >
                  {currentCode}
                </SyntaxHighlighter>
              ) : (
                <span className="dock-content-placeholder">// Generated code will appear here...</span>
              )}
            </div>
          </div>

          {/* Logs Panel */}
          <div className="dock-panel dock-panel--logs">
            <div className="dock-panel-header">
              <span className="dock-panel-title">LOGS</span>
            </div>
            <div className="dock-content" style={{ overflow: "scroll", flex: "1 1 0", minHeight: 0, maxHeight: "100%" }}>
              {renderLogs(currentLogs)}
            </div>
          </div>
        </div>
      </div>

      {/* Copy feedback toast */}
      <div className={`copy-feedback ${copyFeedback ? "copy-feedback--visible" : ""}`}>
        Copied to clipboard!
      </div>
    </div>
  );
}
