import {
  CameraIcon, CameraOffIcon,
  MicIcon, MicOffIcon,
  GearIcon, UserIcon, BackIcon,
} from "./Icons.jsx";

export default function RoomPill({
  roomName,
  camOn, micOn,
  isHost,
  holderAvatar,
  holderUsername,
  iHoldRemote,
  onToggleCam, onToggleMic,
  onOpenSettings, onOpenProfile,
  onOpenRemote,
  onBack,
}) {
  return (
    <>
      <button className="room-back" onClick={onBack} title="Leave room">
        <BackIcon />
      </button>

      <div className="room-pill">
        <span className="room-pill-name">{roomName}</span>
        <span className="room-pill-divider" />

        <button
          className={`room-pill-btn ${camOn ? "on" : "off"}`}
          onClick={onToggleCam}
          title={camOn ? "Camera on" : "Camera off"}
        >
          {camOn ? <CameraIcon /> : <CameraOffIcon />}
        </button>

        <button
          className={`room-pill-btn ${micOn ? "on" : "off"}`}
          onClick={onToggleMic}
          title={micOn ? "Mic on" : "Mic off"}
        >
          {micOn ? <MicIcon /> : <MicOffIcon />}
        </button>

        {/* Remote control button — shows the current holder's avatar */}
        <button
          className={`room-pill-btn remote-btn ${iHoldRemote ? "holding" : ""}`}
          onClick={onOpenRemote}
          title={
            holderUsername
              ? `Remote held by ${holderUsername}${iHoldRemote ? " (you)" : ""}`
              : "Open remote control"
          }
        >
          {holderAvatar ? (
            <img className="remote-avatar" src={holderAvatar} alt="" />
          ) : (
            <span className="remote-dot" />
          )}
        </button>

        <button
          className="room-pill-btn"
          onClick={onOpenSettings}
          title="Settings"
        >
          <GearIcon />
        </button>

        <button
          className="room-pill-btn"
          onClick={onOpenProfile}
          title="Room profile"
        >
          <UserIcon />
        </button>
      </div>
    </>
  );
}