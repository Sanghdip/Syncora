import { useState } from "react";

export default function RoomList({ rooms, onCreate, onJoin }) {
  const [newName, setNewName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const submitCreate = () => {
    const name = newName.trim();
    if (!name) return alert("Enter a room name");
    if (isPrivate && !password.trim()) return alert("Enter a password for the private room");

    onCreate(name, "A watch party", isPrivate, password.trim());

    setNewName("");
    setPassword("");
    setIsPrivate(false);
  };

  return (
    <div className="mzroomlist">
      <div className="lobbyroom">
        <div className="lobbyroomheader">
          <span className="createRoomIcon" data-tour="create-room" title="Create Room">+</span>
          <input
            className="roomSearchInput"
            data-tour="join-room"
            placeholder="Enter room code to join"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onJoin(e.target.value)}
          />
        </div>
        <hr className="hrmz" />

        <div className="publicheader">ALL ONLINE PUBLIC ROOMS — {rooms.length}</div>

        <div className="roombox" data-tour="room-card">
          {rooms.map((r) => (
            <div
              key={r.id}
              className={`roompack ${r.isPrivate ? "private" : ""}`}
              onClick={() => onJoin(r.id)}
              title={`Join ${r.name}${r.isPrivate ? " (private)" : ""}`}
            >
              <div className="roomCardTop">
                <div className="roomBannerContainer">
                  <img className="roomBanner" src={r.thumbnail} alt={r.name} />
                  <div className="roomViewerCountOverlay">
                    <div className="packMember">{r.viewerCount}</div>
                    <span className="packIcon">👥</span>
                  </div>
                </div>
                <div className="ownerAvatarOverlap">
                  <img
                    className="ownerAvatarImage"
                    src={`https://api.dicebear.com/7.x/bottts/svg?seed=${r.owner}`}
                    alt={r.owner}
                  />
                </div>
              </div>
              <div className="roomNameRow">
                <div className="roomName">
                  {r.name}
                  {r.isPrivate && <span className="private-badge" title="Private room">🔒</span>}
                </div>
              </div>
              <div className="packDescription">{r.description}</div>
            </div>
          ))}

          {/* Create room card */}
          <div className="roompack" style={{ padding: 20, cursor: "default" }}>
            <div className="logintitle" style={{ marginBottom: 8 }}>NEW ROOM</div>

            <input
              className="logininput"
              placeholder="Room name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              maxLength={30}
            />

            <label className="private-toggle">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => {
                  setIsPrivate(e.target.checked);
                  if (!e.target.checked) setPassword("");
                }}
              />
              <span>Private room (requires password)</span>
            </label>

            {isPrivate && (
              <input
                className="logininput"
                type="password"
                placeholder="Room password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={40}
                style={{ marginTop: 8 }}
              />
            )}

            <button
              className="btn createRoomButton"
              style={{ marginTop: 12 }}
              onClick={submitCreate}
            >
              + Create Room
            </button>
          </div>
        </div>

        <div className="packspacer" />

        <div className="roomtab" data-tour="room-tabs">
          <button className="roombuttonactive">Public Rooms</button>
          <button className="roombutton">Your Rooms</button>
        </div>
      </div>
    </div>
  );
}