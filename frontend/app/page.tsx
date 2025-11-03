"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { generateCode, renderVideo, getMediaList, setSettings, getSettings, resetSession } from "../lib/api";

type Message = { role: "user" | "assistant"; content: string };

type VideoSettings = {
  resolution_width: number;
  resolution_height: number;
  fps: number;
  quality: "low" | "medium" | "high" | "ultra";
};

const defaultSettings: VideoSettings = {
  resolution_width: 854,
  resolution_height: 480,
  fps: 30,
  quality: "low",
};

export default function HomePage() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL!;
  const [sessionId] = useState(() => Math.random().toString(36).slice(2));
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [code, setCode] = useState<string>("");
  const [sceneClass, setSceneClass] = useState<string>("");
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [settings, setSettingsState] = useState<VideoSettings>(defaultSettings);
  const [settingsConfirmed, setSettingsConfirmed] = useState(false);
  const [error, setError] = useState<string>("");
  const [logs, setLogs] = useState<string>("");
  const withCacheBust = (u?: string | null) => (u ? `${u}${u.includes('?') ? '&' : '?'}t=${Date.now()}` : "");

  useEffect(() => {
    // load saved settings if any
    getSettings(backendUrl, sessionId).then((s) => {
      if (s) setSettingsState({
        resolution_width: s.resolution_width ?? defaultSettings.resolution_width,
        resolution_height: s.resolution_height ?? defaultSettings.resolution_height,
        fps: s.fps ?? defaultSettings.fps,
        quality: s.quality ?? defaultSettings.quality,
      });
    });
  }, [backendUrl, sessionId]);

  const confirmSettings = async () => {
    await setSettings(backendUrl, sessionId, settings);
    setSettingsConfirmed(true);
  };

  const onSend = async () => {
    if (!input.trim()) return;
    setError("");
    setLogs("");
  const newMsgs: Message[] = [...messages, { role: "user" as const, content: input }];
    setMessages(newMsgs);
    setBusy(true);
    try {
      const res = await generateCode(backendUrl, { session_id: sessionId, prompt: input });
      if (res.code === -1) {
        setError("-1");
  setMessages([...newMsgs, { role: "assistant" as const, content: "-1" }]);
        setCode("");
        setVideoUrl("");
        return;
      }
      setCode(res.code);
      setSceneClass(res.scene_class || "GeneratedScene");
  setMessages([...newMsgs, { role: "assistant" as const, content: res.code }] );

      const rendered = await renderVideo(backendUrl, {
        session_id: sessionId,
        code: res.code,
        scene_class: res.scene_class || undefined,
        settings,
        preview: true,
      });
      if (rendered.success && rendered.video_url) {
        setVideoUrl(withCacheBust(rendered.video_url));
      }
      if (rendered.log) {
        setLogs(rendered.log);
        if (!rendered.success) setError(rendered.log);
      }
    } catch (e: any) {
      setError(e?.message || "Failed to generate");
    } finally {
      setBusy(false);
      setInput("");
    }
  };

  const renderLogLines = (text: string) => {
    if (!text) return null;
    const lines = text.split(/\r?\n/);
    const filtered: string[] = [];
    let skippingTrace = false;
    for (const ln of lines) {
      const s = ln.trimStart();
      if (s.startsWith('Traceback (most recent call last):')) { skippingTrace = true; continue; }
      if (skippingTrace) {
        // Stop skipping when a new info line or empty separator appears
        if (s.startsWith('INFO') || s === '' || s.startsWith('Manim Community')) { skippingTrace = false; }
        // Capture final exception summary line if present
        if (!s.startsWith('File ') && (s.match(/^[A-Za-z]+Error:/) || s.match(/^[A-Za-z]+Exception:/))) {
          filtered.push(s);
        }
        continue;
      }
      // Keep other lines
      filtered.push(ln);
    }
    return filtered.map((line, idx) => {
      let cls = "log-line";
      if (line.startsWith("[ERROR]")) cls += " log-error"; 
      else if (line.startsWith("[INFO]")) cls += " log-info";
      else if (line.startsWith("[SUCCESS]")) cls += " log-success";
      return <div key={idx} className={cls}>{line}</div>;
    });
  };

  return (
    <div className="container">
      <div className="panel">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2>automanim by niyarrbarman</h2>  
          <button onClick={async () => {
            try {
              await resetSession(backendUrl, sessionId);
            } catch {}
            // Clear local state
            setMessages([]);
            setInput("");
            setCode("");
            setSceneClass("");
            setVideoUrl("");
            setError("");
            setLogs("");
            setSettingsState(defaultSettings);
            setSettingsConfirmed(false);
          }}>create new scene</button>
        </div>
        {!settingsConfirmed && (
          <div style={{ marginBottom: 12 }}>
            <h3>video settings</h3>
            <div className="settings">
              <div>
                <label>width</label>
                <input type="number" value={settings.resolution_width}
                  onChange={e => setSettingsState({ ...settings, resolution_width: parseInt(e.target.value || '0') })} />
              </div>
              <div>
                <label>height</label>
                <input type="number" value={settings.resolution_height}
                  onChange={e => setSettingsState({ ...settings, resolution_height: parseInt(e.target.value || '0') })} />
              </div>
              <div>
                <label>fps</label>
                <input type="number" value={settings.fps}
                  onChange={e => setSettingsState({ ...settings, fps: parseInt(e.target.value || '0') })} />
              </div>
              <div>
                <label>quality</label>
                <select value={settings.quality} onChange={e => setSettingsState({ ...settings, quality: e.target.value as any })}>
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                  <option value="ultra">ultra</option>
                </select>
              </div>
            </div>
            <button style={{ marginTop: 8 }} onClick={confirmSettings}>confirm settings</button>
          </div>
        )}

        {messages.length > 0 && (
          <div className="messages">
            {messages.map((m, i) => (
              <div key={i}>
                <div style={{ fontWeight: 600 }}>{m.role}</div>
                <pre className="code">{m.content}</pre>
              </div>
            ))}
          </div>
        )}
        <div className="input">
          <input placeholder="describe the manim scene you want" value={input}
            onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') onSend(); }} />
          <button onClick={onSend} disabled={busy}>
            {busy ? (<span className="typing">Working<span></span><span></span><span></span></span>) : 'Send'}
          </button>
        </div>
        {error && <div className="err" style={{ marginTop: 8 }}>Error: {error === "-1" ? "I specialize in Manim only. Let's stick to that." : error}</div>}

        {/* Logs Section */}
        <div className="logs" aria-label="Render logs">
          {logs ? renderLogLines(logs) : <div className="log-line">logs will appear here…</div>}
        </div>
      </div>

      <div className="panel">
        <h2>preview</h2>
        <div className="videoWrap pulse">
          {videoUrl ? (
            <video key={videoUrl} className="video" src={`${backendUrl}${videoUrl}`} controls />
          ) : (
            <div style={{ padding: 16, color: 'var(--text-secondary)' }}>no preview yet.</div>
          )}
        </div>
        {code && (
          <div style={{ marginTop: 12 }}>
            <button onClick={async () => {
              setBusy(true);
              const rendered = await renderVideo(backendUrl, {
                session_id: sessionId,
                code,
                scene_class: sceneClass || undefined,
                settings,
                preview: false,
              });
              setBusy(false);
              if (rendered.success && rendered.video_url) {
                setVideoUrl(withCacheBust(rendered.video_url));
              }
              if (rendered.log) {
                setLogs(rendered.log);
                if (!rendered.success) setError(rendered.log);
              }
            }}>render and save</button>
          </div>
        )}
      </div>
    </div>
  );
}
