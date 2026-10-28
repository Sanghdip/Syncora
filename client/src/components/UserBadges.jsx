import { useEffect, useRef, useState } from "react";

export default function UserBadges({
  members,
  mySocketId,
  isHost,
  onRename,
}) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (editingId && inputRef.current) inputRef.current.focus();
  }, [editingId]);

  if (!members?.length) return null;

  const startEdit = (m) => {
    const isSelf = m.socketId === mySocketId;
    if (!isHost && !isSelf) return;
    setEditingId(m.socketId);
    setDraft(m.nickname || m.username);
  };

  const commit = () => {
    const name = draft.trim();
    if (name && editingId) onRename(editingId, name);
    setEditingId(null);
    setDraft("");
  };

  const cancel = () => {
    setEditingId(null);
    setDraft("");
  };

  return (
    <div className="user-badges">
      {members.map((m) => {
        const isSelf = m.socketId === mySocketId;
        const isOwner = m.role === "host";
        const canEdit = isSelf || isHost;
        const editing = editingId === m.socketId;

        return (
          <div
            key={m.socketId || m.username}
            className={`ubadge ${isSelf ? "self" : ""} ${isOwner ? "owner" : ""}`}
          >
            <img
              className="ubadge-avatar"
              src={m.avatar}
              alt={m.nickname || m.username}
              onClick={() => !editing && startEdit(m)}
              title={
                canEdit
                  ? `Click to rename ${isSelf ? "yourself" : m.nickname || m.username}`
                  : m.nickname || m.username
              }
              style={{ cursor: canEdit ? "pointer" : "default" }}
            />
            {editing ? (
              <input
                ref={inputRef}
                className="ubadge-input"
                value={draft}
                maxLength={24}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") cancel();
                }}
              />
            ) : (
              <div className="ubadge-name" onClick={() => startEdit(m)}>
                {isOwner && <span className="ubadge-crown" title="Host">👑</span>}
                <span className="ubadge-name-text">
                  {m.nickname || m.username}
                  {isSelf && <span className="ubadge-you"> (you)</span>}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}