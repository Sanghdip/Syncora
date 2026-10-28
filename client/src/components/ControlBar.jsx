import {
  CameraIcon, CameraOffIcon,
  ChatIcon, ScreenIcon, FullscreenIcon, SmileIcon,
} from "./Icons.jsx";

export default function ControlBar({
  camOn,
  screenOn,
  chatOpen,
  onToggleCam,
  onToggleScreen,
  onToggleChat,
  onToggleFullscreen,
  onQuickReaction,
}) {
  return (
    <div className="control-bar">
      <button
        className={`control-btn ${camOn ? "active" : ""}`}
        onClick={onToggleCam}
        title={camOn ? "Camera on" : "Camera off"}
      >
        {camOn ? <CameraIcon /> : <CameraOffIcon />}
      </button>

      <button
        className={`control-btn ${chatOpen ? "active" : ""}`}
        onClick={onToggleChat}
        title="Chat"
      >
        <ChatIcon />
      </button>

      <button
        className={`control-btn ${screenOn ? "active" : ""}`}
        onClick={onToggleScreen}
        title="Share screen"
      >
        <ScreenIcon />
      </button>

      <button
        className="control-btn"
        onClick={() => onQuickReaction?.("👍")}
        title="React 👍"
      >
        <SmileIcon />
      </button>

      <button
        className="control-btn"
        onClick={onToggleFullscreen}
        title="Fullscreen"
      >
        <FullscreenIcon />
      </button>
    </div>
  );
}