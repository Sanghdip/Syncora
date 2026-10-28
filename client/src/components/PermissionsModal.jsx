import { useMemo } from "react";

const PROGRAMS = [
  { id: "youtube", label: "YouTube",  icon: "▶" },
  { id: "screen",  label: "Screen",   icon: "🖥️" },
  { id: "camera",  label: "Camera",   icon: "📹" },
  { id: "browser", label: "Browser",  icon: "🌐" },
];

export default function PermissionsModal({
  open,
  onClose,
  members,
  permissions,
  ownerUsername,
  onToggle,
}) {
  const guests = useMemo(
    () => members.filter((m) => m.username !== ownerUsername),
    [members, ownerUsername]
  );

  if (!open) return null;

  return (
    <div className="pm-overlay" onClick={onClose}>
      <div className="pm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pm-header">
          <h2>Program Access</h2>
          <button className="pm-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="pm-sub">
          You (host) always have full access. Toggle what each guest can launch.
        </div>

        {guests.length === 0 ? (
          <div className="pm-empty">
            No guests in the room yet.
          </div>
        ) : (
          <div className="pm-table">
            <div className="pm-row pm-row-head">
              <div className="pm-cell pm-cell-user">User</div>
              {PROGRAMS.map((p) => (
                <div key={p.id} className="pm-cell pm-cell-prog">
                  <span title={p.label}>{p.icon}</span>
                </div>
              ))}
            </div>
            {guests.map((g) => {
              const perms = permissions[g.socketId] || {};
              return (
                <div key={g.socketId} className="pm-row">
                  <div className="pm-cell pm-cell-user">
                    <img src={g.avatar} alt="" className="pm-avatar" />
                    <span className="pm-username">{g.username}</span>
                  </div>
                  {PROGRAMS.map((p) => {
                    const on = perms[p.id] === true;
                    return (
                      <div key={p.id} className="pm-cell pm-cell-prog">
                        <button
                          className={`pm-toggle ${on ? "on" : "off"}`}
                          onClick={() => onToggle(g.socketId, p.id, !on)}
                          title={`${on ? "Revoke" : "Grant"} ${p.label}`}
                        >
                          {on ? "✓" : ""}
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        <div className="pm-footer">
          <button className="pm-btn primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}