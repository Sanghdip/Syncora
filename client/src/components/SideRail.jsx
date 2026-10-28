import { useMemo, useState } from "react";
import {
  ChevronLeft, ChevronRight,
  HomeIcon, UserIcon, LogoutIcon, PlusIcon,
} from "./Icons.jsx";

export default function SideRail({
  user,
  rooms = [],
  onLogout,
  onChangeNickname,
  onGoLobby,
}) {
  const [open, setOpen] = useState(false);
  const [nickname, setNickname] = useState(user?.username || "");
  const [editingNick, setEditingNick] = useState(false);

  const createdRooms = useMemo(
    () => rooms.filter((r) => r.owner === user?.username),
    [rooms, user]
  );

  const saveNickname = () => {
    const name = nickname.trim();
    if (!name) return;
    onChangeNickname?.(name);
    setEditingNick(false);
  };

  return (
    <>
      <button
        className={`rail-toggle ${open ? "open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        title={open ? "Close menu" : "Open menu"}
      >
        {open ? <ChevronLeft /> : <ChevronRight />}
      </button>

      <aside className={`side-rail ${open ? "open" : ""}`}>
        {/* Profile card */}
        <div className="rail-profile">
          <img src={user?.avatar} alt="" className="rail-avatar" />
          <div className="rail-username">
            {editingNick ? (
              <input
                className="rail-input"
                value={nickname}
                maxLength={20}
                autoFocus
                onChange={(e) => setNickname(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveNickname()}
                onBlur={saveNickname}
              />
            ) : (
              <span>{user?.username}</span>
            )}
            <button
              className="rail-nick-edit"
              onClick={() => setEditingNick((v) => !v)}
              title="Change nickname"
            >
              <UserIcon width={14} height={14} />
            </button>
          </div>
        </div>

        <div className="rail-section">
          <div className="rail-label">Menu</div>
          <button className="rail-item" onClick={onGoLobby}>
            <HomeIcon width={16} height={16} />
            <span>Lobby</span>
          </button>
          <button className="rail-item" onClick={onLogout}>
            <LogoutIcon width={16} height={16} />
            <span>Logout</span>
          </button>
        </div>

        <div className="rail-section">
          <div className="rail-label">Your Rooms ({createdRooms.length})</div>
          {createdRooms.length === 0 && (
            <div className="rail-empty">You haven't created any rooms yet.</div>
          )}
          <div className="rail-rooms">
            {createdRooms.map((r) => (
              <div key={r.id} className="rail-room">
                <div className="rail-room-name">{r.name}</div>
                <div className="rail-room-meta">{r.viewerCount || 0} in room</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rail-footer">
          <button className="rail-item" onClick={onGoLobby}>
            <PlusIcon width={16} height={16} />
            <span>Create new room</span>
          </button>
        </div>
      </aside>
    </>
  );
}