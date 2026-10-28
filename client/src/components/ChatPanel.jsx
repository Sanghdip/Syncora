import { useEffect, useRef, useState } from "react";
import { SmileIcon, GifIcon, SendIcon, PlusIcon } from "./Icons.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import useViewport from "../hooks/useViewport.js";
import useKeyboardInset from "../hooks/useKeyboardInset.js";
import GifPicker from "./GifPicker";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🎉"];

const DEFAULT_FLOATS = ["❤️", "😂", "👍", "😮", "😢", "🔥", "🎉", "💯"];
const RECENTS_KEY = "nr_recent_floats";
const MAX_RECENTS = 8;

const EMOJI_GRID = [
  "😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃",
  "😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😙",
  "😋","😛","😜","🤪","😝","🤑","🤗","🤭","🤫","🤔",
  "😐","😑","😶","😏","😒","🙄","😬","🤥","😌","😔",
  "😪","🤤","😴","😷","🤒","🤕","🤢","🤮","🥵","🥶",
  "😵","🤯","🤠","🥳","😎","🤓","🧐","😕","😟","🙁",
  "😮","😯","😲","😳","🥺","😦","😧","😨","😰","😥",
  "😢","😭","😱","😖","😣","😞","😓","😩","😫","🥱",
  "😤","😡","😠","🤬","😈","👿","💀","💩","🤡","👻",
  "❤️","🧡","💛","💚","💙","💜","🖤","🤍","💔","💕",
  "🎉","🎊","🎈","🔥","✨","⭐","💯","👏","🙌","👍",
];

export default function ChatPanel({ user, onClose }) {
  const { socket } = useSocket();
  const { isMobile } = useViewport();
  const keyboardInset = useKeyboardInset();

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [popup, setPopup] = useState(null); // "emoji" | "gif" | null
  const [pickerMode, setPickerMode] = useState("insert"); // "insert" | "float"
  const [expanded, setExpanded] = useState(false);

  const [recentFloats, setRecentFloats] = useState(() => {
    try {
      const raw = localStorage.getItem(RECENTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) {
          return parsed.slice(0, MAX_RECENTS);
        }
      }
    } catch {}
    return DEFAULT_FLOATS.slice(0, MAX_RECENTS);
  });

  const scrollerRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, expanded]);

  useEffect(() => {
    if (keyboardInset > 0 && isMobile) {
      setPopup(null);
      setExpanded(true);
      setTimeout(() => {
        inputRef.current?.scrollIntoView({ block: "nearest" });
      }, 60);
    }
  }, [keyboardInset, isMobile]);

  useEffect(() => {
    if (!socket) return;

    const onMessage = (msg) => {
      if (!msg) return;
      setMessages((prev) => {
        if (msg.id && prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    };
    const onHistory = (history) => {
      if (Array.isArray(history)) setMessages(history);
    };

    socket.on("chat:message", onMessage);
    socket.on("chat:history", onHistory);

    socket.emit("chat:history-request", (history) => {
      if (Array.isArray(history)) setMessages(history);
    });

    return () => {
      socket.off("chat:message", onMessage);
      socket.off("chat:history", onHistory);
    };
  }, [socket]);

  const pushRecent = (emoji) => {
    setRecentFloats((prev) => {
      if (prev.includes(emoji)) return prev;
      const next = [emoji, ...prev].slice(0, MAX_RECENTS);
      try { localStorage.setItem(RECENTS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const send = (overrideText) => {
    const body = (overrideText ?? text).trim();
    if (!body || !socket) return;
    socket.emit("chat:message", { text: body });
    setText("");
    setPopup(null);
  };

  const sendFloatingReaction = (emoji) => {
    if (!socket) return;
    socket.emit("room:reaction", { emoji });
    pushRecent(emoji);
  };

  const pickEmoji = (e) => setText((t) => t + e);
  const togglePopup = (name) => setPopup((p) => (p === name ? null : name));

  const formatTime = (ts) =>
    new Date(ts || Date.now()).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  const identityOf = (m) => {
    const u = m?.user || {};
    const name = u.nickname || u.username || "User";
    const avatar =
      u.avatar ||
      `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
        u.username || "unknown"
      )}`;
    return { name, avatar };
  };

  const sheetStyle =
    isMobile && keyboardInset > 0
      ? { bottom: `${keyboardInset}px`, paddingBottom: 0 }
      : undefined;

  return (
    <aside
      className={`chat-panel ${isMobile ? "chat-mobile" : ""} ${expanded ? "expanded" : ""}`}
      style={sheetStyle}
    >
      {isMobile && (
        <button
          className="chat-sheet-handle"
          onClick={() => {
            inputRef.current?.blur();
            setExpanded((v) => !v);
          }}
          aria-label={expanded ? "Collapse chat" : "Expand chat"}
          title={expanded ? "Collapse" : "Expand"}
        />
      )}

      <div className="chat-header">
        <span>Chat</span>
        <button className="chat-close" onClick={onClose} title="Close">✕</button>
      </div>

      <div className="chat-scroll" ref={scrollerRef}>
        {messages.length === 0 && (
          <div className="chat-empty">No messages yet — say hi 👋</div>
        )}
        {messages.map((m, i) => {
          const { name, avatar } = identityOf(m);
          const isImage = /^https?:\/\/.*\.(gif|png|jpe?g|webp)(\?.*)?$/i.test(
            m.text || ""
          );
          return (
            <div key={m.id || i} className="chat-msg">
              <img src={avatar} alt="" className="chat-msg-avatar" />
              <div className="chat-msg-body">
                <div className="chat-msg-head">
                  <span className="chat-msg-name">{name}</span>
                  <span className="chat-msg-time">{formatTime(m.timestamp)}</span>
                </div>
                {isImage ? (
                  <img src={m.text} alt="" className="chat-msg-image" />
                ) : (
                  <div className="chat-msg-text">{m.text}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="floating-reaction-bar" title="Recent floating reactions">
        {recentFloats.map((e) => (
          <button
            key={e}
            className="floating-reaction-btn"
            onClick={() => sendFloatingReaction(e)}
            title={`Float ${e}`}
            type="button"
          >
            {e}
          </button>
        ))}
        <button
          className="floating-reaction-btn floating-reaction-more"
          onClick={() => {
            setPickerMode("float");
            setPopup("emoji");
          }}
          title="More emojis"
          type="button"
        >
          ＋
        </button>
      </div>

      <div className="chat-input-wrap">
        <button
          className={`chat-input-btn ${popup === "emoji" ? "active" : ""}`}
          onClick={() => {
            inputRef.current?.blur();
            if (popup === "emoji" && pickerMode === "float") {
              setPopup(null);
            } else {
              setPickerMode("insert");
              setPopup("emoji");
            }
          }}
          title="Emoji"
          type="button"
        >
          <SmileIcon />
        </button>

        <button
          className={`chat-input-btn ${popup === "gif" ? "active" : ""}`}
          onClick={() => {
            inputRef.current?.blur();
            togglePopup("gif");
          }}
          title="GIF"
          type="button"
        >
          <GifIcon />
        </button>

        {!isMobile && (
          <button className="chat-input-btn" title="Attach" type="button">
            <PlusIcon />
          </button>
        )}

        <input
          ref={inputRef}
          className="chat-input"
          placeholder="Message @room"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => {
            setPopup(null);
            if (isMobile) setExpanded(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              send();
            }
          }}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="sentences"
          spellCheck="false"
          inputMode="text"
          enterKeyHint="send"
          type="text"
        />

        <button className="chat-send" onClick={() => send()} title="Send" type="button">
          <SendIcon />
        </button>
      </div>

      {popup === "emoji" && (
        <div className="chat-emoji-pop">
          <div className="chat-emoji-tabs">
            <button
              className={pickerMode === "insert" ? "active" : ""}
              onClick={() => setPickerMode("insert")}
              type="button"
            >
              Insert
            </button>
            <button
              className={pickerMode === "float" ? "active" : ""}
              onClick={() => setPickerMode("float")}
              type="button"
            >
              Float
            </button>
          </div>
          <div className="chat-emoji-grid">
            {EMOJI_GRID.map((e) => (
              <button
                key={e}
                className="chat-emoji-cell"
                onClick={() => {
                  if (pickerMode === "float") {
                    sendFloatingReaction(e);
                  } else {
                    pickEmoji(e);
                  }
                }}
                type="button"
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      {popup === "gif" && (
        <div className="chat-gif-pop">
          <GifPicker
            onSelect={(gif) => {
              send(gif.url);
              setPopup(null);
            }}
            onClose={() => setPopup(null)}
          />
        </div>
      )}
    </aside>
  );
}