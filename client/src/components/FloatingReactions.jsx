import { useEffect, useRef, useState } from "react";
import { useSocket } from "../context/SocketContext.jsx";

// Emoji lives on screen for this long
const LIFETIME = 5200;
// Safety cap — never render more than this many at once
const MAX_ON_SCREEN = 30;

export default function FloatingReactions() {
  const { socket } = useSocket();
  const [reactions, setReactions] = useState([]);
  const cleanupTimersRef = useRef(new Map());

  useEffect(() => {
    if (!socket) return;

    const onReaction = (data) => {
      if (!data?.id || !data?.emoji) return;

      setReactions((prev) => {
        const next = [...prev, data];
        if (next.length > MAX_ON_SCREEN) {
          const removed = next.splice(0, next.length - MAX_ON_SCREEN);
          removed.forEach((r) => {
            const t = cleanupTimersRef.current.get(r.id);
            if (t) clearTimeout(t);
            cleanupTimersRef.current.delete(r.id);
          });
        }
        return next;
      });

      const timer = setTimeout(() => {
        setReactions((prev) => prev.filter((r) => r.id !== data.id));
        cleanupTimersRef.current.delete(data.id);
      }, LIFETIME);

      cleanupTimersRef.current.set(data.id, timer);
    };

    socket.on("room:reaction", onReaction);

    return () => {
      socket.off("room:reaction", onReaction);
      cleanupTimersRef.current.forEach((t) => clearTimeout(t));
      cleanupTimersRef.current.clear();
    };
  }, [socket]);

  return (
    <div className="floating-reactions-overlay" aria-hidden="true">
      {reactions.map((r) => (
        <FloatingEmoji key={r.id} emoji={r.emoji} username={r.username} />
      ))}
    </div>
  );
}

function FloatingEmoji({ emoji, username }) {
  // Compute random values ONCE per mount. Calling Math.random() on every
  // render would restart the CSS animation and cause the stutter.
  const randRef = useRef(null);
  if (!randRef.current) {
    randRef.current = {
      left: 6 + Math.random() * 88,          // 6% → 94% of screen width
      duration: 3.6 + Math.random() * 1.6,   // 3.6s → 5.2s (slower, gentler)
      drift: -60 + Math.random() * 120,      // horizontal wobble in px
      scale: 0.85 + Math.random() * 0.55,    // 0.85× → 1.4×
      delay: Math.random() * 0.12,           // tiny stagger
    };
  }
  const { left, duration, drift, scale, delay } = randRef.current;

  const style = {
    left: `${left}%`,
    animationDuration: `${duration}s`,
    animationDelay: `${delay}s`,
    "--drift": `${drift}px`,
    "--emoji-scale": scale,
  };

  return (
    <div className="floating-emoji" style={style}>
      <span className="floating-emoji-icon">{emoji}</span>
      {username && <span className="floating-emoji-username">{username}</span>}
    </div>
  );
}