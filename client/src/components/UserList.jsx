export default function UserList({ members, isHost, socket }) {
  const promote = (socketId, role) => {
    socket.emit("room:set-role", { targetSocketId: socketId, role });
  };

  const kick = (socketId) => {
    if (!window.confirm("Remove this user?")) return;
    socket.emit("room:kick", { targetSocketId: socketId });
  };

  return (
    <div className="mzuserlist">
      <div className="lobbyuserheader">
        <strong style={{ color: "#fff" }}>In Room — {members.length}</strong>
      </div>
      <hr className="hrmz" />
      <div className="lobbybox">
        {members.map((m) => (
          <div key={m.socketId} className="lobby-user-1 lobbybutton lobbybro">
            <div className="lobby-user-2">
              <img className="lobby-user-image" src={m.avatar} alt={m.username} />
            </div>
            <div className="lobby-user-3">
              <div className="lobby-user-name">
                {m.nickname}
                {m.role === "host" && " 👑"}
                {m.role === "moderator" && " 🛡"}
              </div>
              <div className="lobby-user-bio">{m.role}</div>
            </div>

            {isHost && m.role !== "host" && (
              <div style={{ display: "flex", gap: 4, paddingRight: 6 }}>
                <button
                  className="btn btn-sm btn-outline-light"
                  onClick={() => promote(m.socketId, "moderator")}
                  title="Promote to moderator"
                >
                  🛡
                </button>
                <button
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => kick(m.socketId)}
                  title="Kick"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}