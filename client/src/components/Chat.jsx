import { useEffect, useRef, useState } from "react";

export default function Chat({ socket }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const boxRef = useRef(null);

  useEffect(() => {
    const onMsg = (m) => setMessages((prev) => [...prev, m]);
    socket.on("chat:message", onMsg);
    return () => socket.off("chat:message", onMsg);
  }, [socket]);

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [messages]);

  const send = (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    socket.emit("chat:message", { text: trimmed });
    setText("");
  };

  return (
    <div style={{
      background: "#2f3136",
      borderRadius: 8,
      height: "100%",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden"
    }}>
      <div style={{
        padding: 12,
        borderBottom: "1px solid #202225",
        color: "#fff",
        fontWeight: 600
      }}>
        Room Chat
      </div>

      <div ref={boxRef} style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {messages.map((m) => (
          <div key={m.id} className="chatmessage2" style={{ marginBottom: 10 }}>
            <img
              src={m.avatar}
              alt={m.author}
              className="chatavatar32"
              style={{ left: 8 }}
            />
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span className="msgheader">{m.nickname}</span>
              <span className="msgtime" style={{ float: "none" }}>
                {new Date(m.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit"
                })}
              </span>
            </div>
            <div className="chattxt">{m.text}</div>
          </div>
        ))}
        {messages.length === 0 && (
          <div style={{ color: "#72767d", fontSize: 13, textAlign: "center", marginTop: 20 }}>
            No messages yet — say hi 👋
          </div>
        )}
      </div>

      <form onSubmit={send} style={{ padding: 12, borderTop: "1px solid #202225" }}>
        <input
          className="logininput"
          placeholder="Message the room…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={500}
        />
      </form>
    </div>
  );
}