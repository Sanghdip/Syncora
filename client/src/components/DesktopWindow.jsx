import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useWindows } from "../context/WindowManager.jsx";

const MIN_W = 260;
const MIN_H = 160;
const ROTATE_STEP = 5;
const MAX_ROTATION = 25;

export default function DesktopWindow({
  win,
  onClose,
  onFocus,
  onUpdate,
  onUpdateFinal,
  onMinimize,
  onMaximize,
  children,
}) {
  const { isMobile, canControl } = useWindows();
  const [drag, setDrag] = useState(null);
  const [resize, setResize] = useState(null);
  const pendingRef = useRef(null);

  useEffect(() => {
    if (!canControl) {
      setDrag(null);
      setResize(null);
      pendingRef.current = null;
    }
  }, [canControl]);

  // ---- Drag ----
  useEffect(() => {
    if (isMobile || !canControl || !drag) return;
    const onMove = (e) => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const nx = drag.ox + (e.clientX - drag.startX);
      const ny = drag.oy + (e.clientY - drag.startY);
      const clampedX = Math.max(-win.w + 100, Math.min(vw - 100, nx));
      const clampedY = Math.max(0, Math.min(vh - 40, ny));
      const patch = { x: clampedX, y: clampedY };
      pendingRef.current = patch;
      onUpdate(patch);
    };
    const onUp = () => {
      if (pendingRef.current) {
        onUpdateFinal(pendingRef.current);
        pendingRef.current = null;
      }
      setDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [isMobile, canControl, drag, win.w, onUpdate, onUpdateFinal]);

  // ---- Resize ----
  useEffect(() => {
    if (isMobile || !canControl || !resize) return;
    const onMove = (e) => {
      const dx = e.clientX - resize.startX;
      const dy = e.clientY - resize.startY;
      let { ox: x, oy: y, ow: w, oh: h } = resize;
      const dir = resize.dir;
      if (dir.includes("e")) w = Math.max(MIN_W, resize.ow + dx);
      if (dir.includes("s")) h = Math.max(MIN_H, resize.oh + dy);
      if (dir.includes("w")) {
        const nw = Math.max(MIN_W, resize.ow - dx);
        x = resize.ox + (resize.ow - nw);
        w = nw;
      }
      if (dir.includes("n")) {
        const nh = Math.max(MIN_H, resize.oh - dy);
        y = resize.oy + (resize.oh - nh);
        h = nh;
      }
      const patch = { x, y, w, h };
      pendingRef.current = patch;
      onUpdate(patch);
    };
    const onUp = () => {
      if (pendingRef.current) {
        onUpdateFinal(pendingRef.current);
        pendingRef.current = null;
      }
      setResize(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [isMobile, canControl, resize, onUpdate, onUpdateFinal]);

  if (win.minimized && !isMobile) return null;

  const style = isMobile
    ? { position: "fixed", inset: 0, zIndex: win.z, transform: "none", borderRadius: 0 }
    : win.maximized
      ? { left: 0, top: 0, width: "100%", height: "100%", zIndex: win.z, transform: "none" }
      : {
          left: win.x,
          top: win.y,
          width: win.w,
          height: win.h,
          zIndex: win.z,
          transform: `rotate(${win.rotation}deg)`,
        };

  const startDrag = (e) => {
    if (isMobile || !canControl) return;
    if (e.button !== 0) return;
    if (win.maximized) return;
    if (e.target.closest("button")) return;
    onFocus();
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch {}
    setDrag({ startX: e.clientX, startY: e.clientY, ox: win.x, oy: win.y });
    e.preventDefault();
  };

  const startResize = (dir) => (e) => {
    if (isMobile || !canControl || win.maximized) return;
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onFocus();
    try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch {}
    setResize({
      dir,
      startX: e.clientX,
      startY: e.clientY,
      ox: win.x,
      oy: win.y,
      ow: win.w,
      oh: win.h,
    });
  };

  const rotate = (delta) => {
    if (isMobile || !canControl) return;
    const next = Math.max(-MAX_ROTATION, Math.min(MAX_ROTATION, win.rotation + delta));
    onUpdateFinal({ rotation: next });
  };

  const doMinimize = () => { if (canControl) onMinimize(); };
  const doMaximize = () => { if (canControl && !isMobile) onMaximize(); };
  const doClose = () => { if (canControl) onClose(); };

  const readOnly = !canControl;
  const isInteracting = !!(drag || resize);

  return (
    <div
      className={`dw ${win.maximized || isMobile ? "dw-max" : ""} ${isMobile ? "dw-mobile" : ""} ${readOnly ? "dw-readonly" : ""}`}
      style={style}
      onPointerDown={onFocus}
    >
      <div
        className="dw-header"
        onPointerDown={startDrag}
        style={readOnly ? { cursor: "default" } : undefined}
      >
        {isMobile ? (
          <button className="dw-btn dw-back" onClick={doClose} title="Close" disabled={readOnly}>←</button>
        ) : (
          <div className="dw-title" title={win.title}>
            {win.title}
            {readOnly && <span className="dw-lock-inline" title="Locked by host">🔒</span>}
          </div>
        )}

        {isMobile && (
          <div className="dw-title dw-title-mobile">
            {win.title}
            {readOnly && <span className="dw-lock-inline">🔒</span>}
          </div>
        )}

        <div className="dw-controls">
          {!isMobile && (
            <>
              <button className="dw-btn" title="Rotate left" onClick={() => rotate(-ROTATE_STEP)} disabled={readOnly}>⟲</button>
              <button className="dw-btn" title="Rotate right" onClick={() => rotate(ROTATE_STEP)} disabled={readOnly}>⟳</button>
              <button className="dw-btn" title="Reset tilt" onClick={() => rotate(-win.rotation)} disabled={readOnly}>•</button>
              <button className="dw-btn" title="Minimize" onClick={doMinimize} disabled={readOnly}>—</button>
              <button className="dw-btn" title={win.maximized ? "Restore" : "Maximize"} onClick={doMaximize} disabled={readOnly}>
                {win.maximized ? "❐" : "▢"}
              </button>
            </>
          )}
          {!isMobile && (
            <button className="dw-btn dw-close" title="Close" onClick={doClose} disabled={readOnly}>✕</button>
          )}
        </div>
      </div>

      <div className="dw-body">{children}</div>

      {/* Capture overlay via PORTAL — escapes the window's transform
          so position:fixed anchors to the real viewport, not the window. */}
      {isInteracting &&
        createPortal(
          <div
            className="dw-capture-overlay"
            style={{ cursor: drag ? "grabbing" : "default" }}
            onPointerDown={(e) => e.stopPropagation()}
          />,
          document.body
        )}

      {!win.maximized && !isMobile && (
        <>
          {["n", "s", "e", "w", "ne", "nw", "se", "sw"].map((dir) => (
            <div
              key={dir}
              className={`dw-resize dw-resize-${dir} ${readOnly ? "dw-resize-disabled" : ""}`}
              onPointerDown={readOnly ? undefined : startResize(dir)}
            />
          ))}
        </>
      )}
    </div>
  );
}