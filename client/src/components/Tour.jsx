import { useEffect, useState } from "react";

const STEPS = [
  { el: null,                         title: "Welcome to Syncora", desc: "Watch parties, chat, and shared browsing — together." },
  { el: '[data-tour="create-room"]',  title: "Create a room",    desc: "Start your own watch party. Invite friends with a code." },
  { el: '[data-tour="join-room"]',    title: "Join with a code", desc: "Have a room code? Type it here and press Enter." },
  { el: '[data-tour="room-card"]',    title: "Join a live room", desc: "Click any card to enter an active watch party." },
  { el: '[data-tour="room-tabs"]',    title: "Public vs yours",  desc: "Switch between public rooms and rooms you created." },
  { el: '[data-tour="nav-profile"]',  title: "Your profile",     desc: "Click here to log out or view your account." },
  { el: null,                         title: "You're all set",   desc: "Have fun watching together!" }
];

export default function Tour({ onDone }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);

  useEffect(() => {
    const step = STEPS[i];
    if (!step.el) { setRect(null); return; }
    const node = document.querySelector(step.el);
    setRect(node ? node.getBoundingClientRect() : null);
  }, [i]);

  const next = () => {
    if (i < STEPS.length - 1) setI(i + 1);
    else onDone();
  };
  const prev = () => i > 0 && setI(i - 1);

  return (
    <>
      {/* Overlay with clip-path cutout */}
      <div
        onClick={onDone}
        style={{
          position: "fixed", inset: 0, zIndex: 9998,
          background: "rgba(10,12,24,.82)",
          clipPath: rect
            ? `polygon(
                0 0, 100% 0, 100% 100%, 0 100%, 0 0,
                ${rect.left - 8}px ${rect.top - 8}px,
                ${rect.left - 8}px ${rect.bottom + 8}px,
                ${rect.right + 8}px ${rect.bottom + 8}px,
                ${rect.right + 8}px ${rect.top - 8}px,
                ${rect.left - 8}px ${rect.top - 8}px
              )`
            : "none"
        }}
      />

      {/* Popover */}
      <div
        className="driver-popover syncora-tour-popover"
        style={{
          position: "fixed",
          zIndex: 10001,
          top: rect
            ? Math.min(window.innerHeight - 260, rect.bottom + 12)
            : window.innerHeight / 2 - 110,
          left: rect
            ? Math.max(10, Math.min(window.innerWidth - 360, rect.left))
            : window.innerWidth / 2 - 170,
          maxWidth: 340,
          padding: 15
        }}
      >
        <div className="driver-popover-title" style={{ fontSize: 17, fontWeight: 600, color: "#fff" }}>
          {STEPS[i].title}
        </div>
        <div className="driver-popover-description" style={{ marginTop: 8, color: "#c5c9e6", lineHeight: 1.6 }}>
          {STEPS[i].desc}
        </div>
        <div className="driver-popover-footer" style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center" }}>
          <span className="driver-popover-progress-text" style={{ flex: 1, color: "#8b90b8", fontSize: 12 }}>
            {i + 1} of {STEPS.length}
          </span>
          <button className="syncora-tour-skip" onClick={onPrevOrDone(false)}>{i === 0 ? "Skip" : "Back"}</button>
          <button className="driver-popover-next-btn" onClick={next}>
            {i === STEPS.length - 1 ? "Got it" : "Next"}
          </button>
        </div>
      </div>
    </>    
  );

  function onPrevOrDone(isSkip) {
    return (e) => {
      e.stopPropagation();
      if (i === 0) onDone();
      else prev();
    };
  }
}
