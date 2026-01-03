"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { generateCode, renderVideo, setSettings, getSettings } from "../lib/api";

// ========== TYPES ==========
type HistoryEntry = {
  id: string;
  prompt: string;
  code: string;
  logs: string;
  videoUrl: string;
  timestamp: Date;
  sceneName: string;
};

type VideoSettings = {
  resolution_width: number;
  resolution_height: number;
  fps: number;
  quality: "low" | "medium" | "high" | "ultra";
};

type Status = "ready" | "rendering" | "error";

// ========== RESOLUTION PRESETS ==========
const RESOLUTION_PRESETS: Record<string, { width: number; height: number; quality: VideoSettings["quality"] }> = {
  "480p": { width: 854, height: 480, quality: "low" },
  "720p": { width: 1280, height: 720, quality: "medium" },
  "1080p": { width: 1920, height: 1080, quality: "high" },
};

const FPS_OPTIONS = [24, 30, 60];

// ========== MAIN COMPONENT ==========
export default function HomePage() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
  const [sessionId] = useState(() => Math.random().toString(36).slice(2));

  // UI State
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState<Status>("ready");
  const [wrapCode, setWrapCode] = useState(false);
  const [fontSize, setFontSize] = useState(() => {
    if (typeof window !== "undefined") {
      return parseInt(localStorage.getItem("automanim-fontsize") || "13", 10);
    }
    return 13;
  });
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Data State
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [currentCode, setCurrentCode] = useState("");
  const [currentLogs, setCurrentLogs] = useState("");
  const [currentVideoUrl, setCurrentVideoUrl] = useState("");
  const [currentSceneName, setCurrentSceneName] = useState("GeneratedScene.py");

  // Settings State
  const [resolution, setResolution] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("automanim-resolution") || "480p";
    }
    return "480p";
  });
  const [fps, setFps] = useState(() => {
    if (typeof window !== "undefined") {
      return parseInt(localStorage.getItem("automanim-fps") || "30", 10);
    }
    return 30;
  });

  // Refs
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);

  // ========== EFFECTS ==========
  // Persist settings
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("automanim-resolution", resolution);
    }
  }, [resolution]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("automanim-fps", fps.toString());
    }
  }, [fps]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("automanim-fontsize", fontSize.toString());
    }
  }, [fontSize]);

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

  // ========== HANDLERS ==========
  const handleGenerate = async () => {
    if (!prompt.trim() || status === "rendering") return;

    setStatus("rendering");
    setCurrentLogs("Generating code...\n");

    try {
      // Send settings first
      await setSettings(backendUrl, sessionId, getVideoSettings());

      // Generate code
      const res = await generateCode(backendUrl, { session_id: sessionId, prompt: prompt.trim() });

      if (res.code === -1) {
        setStatus("error");
        setCurrentLogs("Error: I specialize in Manim only. Let's stick to that.");
        return;
      }

      const newCode = res.code;
      const sceneName = res.scene_class ? `${res.scene_class}.py` : "GeneratedScene.py";

      setCurrentCode(newCode);
      setCurrentSceneName(sceneName);
      setCurrentLogs(prev => prev + "Code generated successfully.\n");

      // Create history entry
      const newEntry: HistoryEntry = {
        id: Math.random().toString(36).slice(2),
        prompt: prompt.trim(),
        code: newCode,
        logs: "Code generated. Ready to render.",
        videoUrl: "",
        timestamp: new Date(),
        sceneName,
      };

      setHistory(prev => [newEntry, ...prev]);
      setActiveRunId(newEntry.id);
      setPrompt("");

      // Auto-render after generation
      setCurrentLogs(prev => prev + "Starting render...\n");

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

        // Update history entry with video
        setHistory(prev => prev.map(h =>
          h.id === newEntry.id
            ? { ...h, videoUrl, logs: rendered.log || h.logs }
            : h
        ));
      } else {
        // Render failed - show error in logs
        setStatus("error");
        const errorLog = rendered.log || "Render failed. Check your code for errors.";
        setCurrentLogs(errorLog);

        // Update history entry with error logs
        setHistory(prev => prev.map(h =>
          h.id === newEntry.id
            ? { ...h, logs: errorLog }
            : h
        ));
      }

    } catch (e: any) {
      setStatus("error");
      const errorMsg = `Error: ${e?.message || "Failed to generate"}`;
      setCurrentLogs(errorMsg);
    }
  };

  const handleDownloadVideo = () => {
    if (!currentVideoUrl) return;
    const fullUrl = `${backendUrl}${currentVideoUrl}`;
    const a = document.createElement("a");
    a.href = fullUrl;
    a.download = currentSceneName.replace(".py", ".mp4");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleRenderOnly = async () => {
    if (!currentCode || status === "rendering") return;

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

        // Update history entry
        if (activeRunId) {
          setHistory(prev => prev.map(h =>
            h.id === activeRunId
              ? { ...h, videoUrl, logs: rendered.log || h.logs }
              : h
          ));
        }
      } else {
        setStatus("error");
      }
    } catch (e: any) {
      setStatus("error");
      setCurrentLogs(`Error: ${e?.message || "Render failed"}`);
    }
  };

  const handleHistoryClick = (entry: HistoryEntry) => {
    setActiveRunId(entry.id);
    setCurrentCode(entry.code);
    setCurrentLogs(entry.logs);
    setCurrentVideoUrl(entry.videoUrl);
    setCurrentSceneName(entry.sceneName);
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

  // ========== RENDER ==========
  return (
    <div className="app-container">
      {/* Top Bar */}
      <header className="top-bar">
        <div className="top-bar-left">
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
            placeholder="Describe the animation you want to create…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <div className="hint-row">
            Press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to generate
          </div>
          <button
            className="btn-generate"
            onClick={handleGenerate}
            disabled={status === "rendering" || !prompt.trim()}
          >
            Generate Scene
          </button>

          <div className="history-section">
            <span className="section-label">History</span>
            <div className="history-list">
              {history.length === 0 ? (
                <p className="history-empty">
                  No history yet. <span>Generate your first scene!</span>
                </p>
              ) : (
                history.map((entry) => (
                  <button
                    key={entry.id}
                    className={`history-item ${activeRunId === entry.id ? "history-item--active" : ""}`}
                    onClick={() => handleHistoryClick(entry)}
                  >
                    <span className="history-item-prompt">{entry.prompt}</span>
                    <span className="history-item-time">
                      {entry.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
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
                  src={`${backendUrl}${currentVideoUrl}`}
                  controls
                  key={currentVideoUrl}
                />
              ) : (
                <div className="preview-empty">
                  <p className="preview-empty-title">No render yet</p>
                  <p className="preview-empty-hint">
                    Type a prompt <span className="preview-empty-arrow">→</span> Generate Scene
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
              style={{ fontSize }}
            >
              {currentCode ? (
                <pre style={{ margin: 0 }}>{currentCode}</pre>
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
            <div className="dock-content">
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
