export default function RemoteRequestToast({
  access,
  mySocketId,
  onApprove,
  onDeny,
  onOpenPanel,
}) {
  const requests = access?.requests || [];
  if (requests.length === 0) return null;
  // Only the current remote holder sees this
  if (access.holderId !== mySocketId) return null;

  const latest = requests[requests.length - 1];
  const extra = requests.length - 1;

  return (
    <div className="rr-toast" role="alert">
      <div className="rr-toast-main">
        <img className="rr-toast-avatar" src={latest.avatar} alt="" />
        <div className="rr-toast-body">
          <div className="rr-toast-title">
            <strong>{latest.username}</strong> wants the remote
          </div>
          <div className="rr-toast-sub">
            If you allow, they take over window control and sharing.
          </div>
        </div>
      </div>

      <div className="rr-toast-actions">
        <button
          className="rr-btn rr-btn-allow"
          onClick={() => onApprove(latest.socketId)}
        >
          Allow
        </button>
        <button
          className="rr-btn rr-btn-deny"
          onClick={() => onDeny(latest.socketId)}
        >
          Deny
        </button>
      </div>

      {extra > 0 && (
        <button className="rr-toast-more" onClick={onOpenPanel}>
          +{extra} more request{extra === 1 ? "" : "s"} — view all
        </button>
      )}
    </div>
  );
}