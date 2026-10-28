import { useMemo } from "react";

export default function RemotePanel({
  open,
  onClose,
  mySocketId,
  isHost,
  members,
  access,
  onPermit,
  onRequestRemote,
  onApprove,
  onDeny,
  onForceHolder,
  onReleaseRemote,
}) {
  const holderId = access?.holderId;
  const permitted = useMemo(() => new Set(access?.permitted || []), [access]);
  const requests = access?.requests || [];

  if (!open) return null;

  const holder = members.find((m) => m.socketId === holderId);
  const iHold = holderId === mySocketId;
  const iPermitted = permitted.has(mySocketId);
  const iRequested = requests.some((r) => r.socketId === mySocketId);

  const others = members.filter((m) => m.socketId !== mySocketId && m.username !== holder?.username);

  return (
    <div className="rm-overlay" onClick={onClose}>
      <div className="rm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rm-header">
          <h2>Remote Control</h2>
          <button className="rm-close" onClick={onClose}>✕</button>
        </div>

        {/* Current holder */}
        <div className="rm-section">
          <div className="rm-label">Currently holding the remote</div>
          {holder ? (
            <div className="rm-holder">
              <img className="rm-avatar" src={holder.avatar} alt="" />
              <div className="rm-holder-name">
                {holder.nickname || holder.username}
                {holderId === mySocketId && <span className="rm-you"> (you)</span>}
                {holder.role === "host" && <span className="rm-crown"> 👑</span>}
              </div>

              <div className="rm-holder-actions">
                {iHold && !isHost && (
                  <button className="rm-btn ghost" onClick={onReleaseRemote}>
                    Release
                  </button>
                )}
                {!iHold && isHost && (
                  <button className="rm-btn primary" onClick={() => onForceHolder(mySocketId)}>
                    Take remote
                  </button>
                )}
                {!iHold && !isHost && iPermitted && !iRequested && (
                  <button className="rm-btn primary" onClick={onRequestRemote}>
                    Request remote
                  </button>
                )}
                {!iHold && !isHost && iPermitted && iRequested && (
                  <span className="rm-pending">Request pending…</span>
                )}
              </div>
            </div>
          ) : (
            <div className="rm-empty">No one holds the remote.</div>
          )}
        </div>

        {/* Pending requests */}
        {requests.length > 0 && (
          <div className="rm-section">
            <div className="rm-label">Pending requests ({requests.length})</div>
            <div className="rm-list">
              {requests.map((r) => {
                const canDecide = isHost || iHold;
                return (
                  <div key={r.socketId} className="rm-row">
                    <img className="rm-avatar small" src={r.avatar} alt="" />
                    <div className="rm-row-name">{r.username}</div>
                    {canDecide ? (
                      <div className="rm-row-actions">
                        <button className="rm-btn primary small" onClick={() => onApprove(r.socketId)}>
                          Approve
                        </button>
                        <button className="rm-btn ghost small" onClick={() => onDeny(r.socketId)}>
                          Deny
                        </button>
                      </div>
                    ) : (
                      <span className="rm-pending">Waiting…</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Host: grant/revoke permissions */}
        {isHost && (
          <div className="rm-section">
            <div className="rm-label">Allow others to request the remote</div>
            {members.filter((m) => m.username !== members.find(x => x.socketId === mySocketId)?.username).length === 0 ? (
              <div className="rm-empty">No other users in the room yet.</div>
            ) : (
              <div className="rm-list">
                {members
                  .filter((m) => m.socketId !== mySocketId)
                  .map((m) => {
                    const on = permitted.has(m.socketId);
                    const holds = holderId === m.socketId;
                    return (
                      <div key={m.socketId} className="rm-row">
                        <img className="rm-avatar small" src={m.avatar} alt="" />
                        <div className="rm-row-name">
                          {m.nickname || m.username}
                          {holds && <span className="rm-crown"> 👑</span>}
                        </div>
                        <label className="rm-switch">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={(e) => onPermit(m.socketId, e.target.checked)}
                          />
                          <span className="rm-slider" />
                        </label>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        <div className="rm-footer">
          <button className="rm-btn ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}