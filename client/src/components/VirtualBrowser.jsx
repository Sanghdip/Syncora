import { useEffect, useState } from "react";

const NEKO_URL = import.meta.env.VITE_NEKO_URL || "http://localhost:8080";

export default function VirtualBrowser({ socket, canControl }) {
  const [active, setActive] = useState(false);
  const [password, setPassword] = useState(null);
  const [role, setRole] = useState("viewer");
  const [loading, setLoading] = useState(false);
  const [holderId, setHolderId] = useState(null);

  const fetchCreds = () => {
    if (!socket) return;
    setLoading(true);
    socket.emit("neko:credentials", (res) => {
      setLoading(false);
      if (!res?.ok) return;
      setPassword(res.password);
      setRole(res.role);
    });
  };

  useEffect(() => {
    if (!socket) return;

    const onStarted = () => { setActive(true); fetchCreds(); };
    const onStopped = () => {
      setActive(false);
      setPassword(null);
      setRole("viewer");
    };
    const onAccess = (state) => setHolderId(state?.holderId || null);

    socket.on("neko:started", onStarted);
    socket.on("neko:stopped", onStopped);
    socket.on("access:state", onAccess);

    socket.emit("neko:state", (state) => {
      if (state?.ok && state.active) { setActive(true); fetchCreds(); }
    });

    return () => {
      socket.off("neko:started", onStarted);
      socket.off("neko:stopped", onStopped);
      socket.off("access:state", onAccess);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  useEffect(() => {
    if (!active) return;
    fetchCreds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holderId, active]);

  const start = () => {
    if (!canControl) return;
    socket.emit("neko:start", (res) => {
      if (!res?.ok) alert(res?.error || "Could not start");
    });
  };

  const stop = () => {
    if (!canControl) return;
    socket.emit("neko:stop", (res) => {
      if (!res?.ok) alert(res?.error || "Could not stop");
    });
  };

  const embedUrl = password
    ? `${NEKO_URL}/?pwd=${encodeURIComponent(password)}`
    : null;

  return (
    <div className="vb-root">
      <div className="vb-toolbar">
        <span className="vb-title">🌐 Virtual Browser</span>

        {active && role === "admin" && (
          <span className="vb-badge admin" title="You control the shared browser">
            <span className="vb-dot admin" />
            Controlling
          </span>
        )}
        {active && role === "viewer" && (
          <span className="vb-badge viewer" title="View only — the remote holder controls this browser">
            <span className="vb-dot viewer" />
            View only
          </span>
        )}

        {!active && canControl && (
          <button
            className="vb-btn primary"
            onClick={start}
            disabled={loading}
            title="Start a shared Firefox session for the room"
          >
            {loading ? "Opening…" : "▶ Start"}
          </button>
        )}

        {!active && !canControl && (
          <span className="vb-hint">Waiting for the remote holder…</span>
        )}

        {active && canControl && (
          <>
            <a
              className="vb-btn ghost"
              href={embedUrl || NEKO_URL}
              target="_blank"
              rel="noreferrer"
              title="Open in a new browser tab"
            >↗</a>
            <button
              className="vb-btn danger"
              onClick={stop}
              title="Stop the shared browser for everyone"
            >✕</button>
          </>
        )}
      </div>

      <div className="vb-body">
        {active && embedUrl ? (
          <iframe
            key={embedUrl}
            title="Virtual Browser"
            src={embedUrl}
            className="vb-iframe"
            allow="camera; microphone; display-capture; autoplay; clipboard-read; clipboard-write; fullscreen"
          />
        ) : (
          <div className="vb-placeholder">
            {canControl
              ? "Click ▶ Start to launch a shared Firefox session for the room."
              : "Waiting for the remote holder to launch the browser…"}
          </div>
        )}
      </div>
    </div>
  );
}