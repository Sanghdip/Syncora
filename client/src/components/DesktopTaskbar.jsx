import { useEffect, useRef, useState } from "react";
import { CameraIcon, ChatIcon, ScreenIcon, FullscreenIcon } from "./Icons.jsx";
import useViewport from "../hooks/useViewport.js";
import { useWindows } from "../context/WindowManager.jsx";

const PROGRAM_ICONS = {
  youtube: "▶",
  screen:  <ScreenIcon />,
  camera:  <CameraIcon />,
  browser: "🌐",
};
const PROGRAM_LABELS = {
  youtube: "YouTube",
  screen:  "Screen",
  camera:  "Camera",
  browser: "Browser",
};

const DRAG_THRESHOLD = 5;

export default function DesktopTaskbar({
  windows,
  chatOpen,
  onLaunch,
  onToggleChat,
  onToggleFullscreen,
  onFocusWindow,
  onMinimizeWindow,
}) {
  const { isMobile, isCompact } = useViewport();
  const { taskbarPos, setTaskbarPosition, canControl } = useWindows();

  const [drag, setDrag] = useState(null);
  const barRef = useRef(null);
  const movedRef = useRef(false);

  const pos = taskbarPos;

  useEffect(() => {
    if (!drag) return;
    const onMove = (e) => {
      const bar = barRef.current;
      if (!bar) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        movedRef.current = true;
      }
      const w = bar.offsetWidth;
      const h = bar.offsetHeight;
      const nx = Math.max(0, Math.min(window.innerWidth - w, drag.ox + dx));
      const ny = Math.max(0, Math.min(window.innerHeight - h, drag.oy + dy));
      bar.style.left = nx + "px";
      bar.style.top = ny + "px";
      bar.style.transform = "none";
      bar.style.right = "auto";
      bar.style.bottom = "auto";
      drag.pendingRef = { x: nx, y: ny };
    };
    const onUp = () => {
      if (movedRef.current && drag.pendingRef) {
        setTaskbarPosition(drag.pendingRef);
      }
      setDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [drag, setTaskbarPosition]);

  const startDrag = (e) => {
    if (isMobile || !canControl) return;
    if (e.button !== 0) return;
    if (e.target.closest("button")) return;
    const bar = barRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    movedRef.current = false;
    setDrag({
      startX: e.clientX, startY: e.clientY,
      ox: rect.left, oy: rect.top,
      pendingRef: null,
    });
    e.preventDefault();
  };

  const swallowClickAfterDrag = (e) => {
    if (movedRef.current) {
      e.stopPropagation();
      e.preventDefault();
      movedRef.current = false;
    }
  };

  const reset = () => { if (canControl) setTaskbarPosition(null); };

  const style = pos
    ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto", transform: "none" }
    : undefined;

  const programs = ["youtube", "screen", "camera", "browser"];

  if (isMobile) {
    return (
      <div className="mobile-nav" role="navigation">
        {programs.map((p) => (
          <button
            key={p}
            className={`mnav-btn ${!canControl ? "locked" : ""}`}
            onClick={() => canControl && onLaunch(p)}
            aria-label={PROGRAM_LABELS[p]}
          >
            <span className="mnav-icon">{PROGRAM_ICONS[p]}</span>
            <span className="mnav-label">{PROGRAM_LABELS[p]}</span>
          </button>
        ))}
        <button
          className={`mnav-btn ${chatOpen ? "active" : ""}`}
          onClick={onToggleChat}
          aria-label="Chat"
        >
          <span className="mnav-icon"><ChatIcon /></span>
          <span className="mnav-label">Chat</span>
        </button>
      </div>
    );
  }

  return (
    <div
      ref={barRef}
      className={`desktop-taskbar ${pos ? "floating" : "docked"} ${isCompact ? "compact" : ""} ${!canControl ? "readonly" : ""}`}
      style={style}
      onPointerDown={startDrag}
      onClickCapture={swallowClickAfterDrag}
    >
      <div className="tb-grip" title={canControl ? "Drag to move" : "Locked by host"}>⋮⋮</div>

      <div className="tb-launchers">
        {programs.map((p) => (
          <button
            key={p}
            className={`tb-launch ${!canControl ? "locked" : ""}`}
            onClick={() => canControl && onLaunch(p)}
            title={canControl ? PROGRAM_LABELS[p] : `${PROGRAM_LABELS[p]} — locked`}
          >
            {PROGRAM_ICONS[p]}
            {!canControl && <span className="tb-lock">🔒</span>}
          </button>
        ))}
      </div>

      <div className="tb-divider" />

      <div className="tb-open">
        {windows.length === 0 && !isCompact && (
          <span className="tb-empty">No open windows</span>
        )}
        {windows.map((w) => (
          <button
            key={w.id}
            className={`tb-win ${w.minimized ? "min" : "active"}`}
            onClick={() =>
              canControl && (w.minimized ? onFocusWindow(w.id) : onMinimizeWindow(w.id))
            }
            title={w.title}
            disabled={!canControl}
          >
            {isCompact ? w.title.slice(0, 2) : w.title}
          </button>
        ))}
      </div>

      <div className="tb-divider" />

      <div className="tb-right">
        <button
          className={`tb-launch ${chatOpen ? "on" : ""}`}
          onClick={onToggleChat}
          title="Toggle chat"
        ><ChatIcon /></button>
        <button className="tb-launch" onClick={onToggleFullscreen} title="Fullscreen">
          <FullscreenIcon />
        </button>
        {pos && canControl && (
          <>
            <div className="tb-divider" />
            <button className="tb-reset" onClick={reset} title="Reset position">⟲</button>
          </>
        )}
      </div>
    </div>
  );
}