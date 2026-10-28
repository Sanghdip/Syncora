import { useEffect } from "react";
import { useWindows } from "../context/WindowManager.jsx";
import DesktopWindow from "./DesktopWindow.jsx";
import DesktopTaskbar from "./DesktopTaskbar.jsx";
import YouTubeWindow from "./YouTubeWindow.jsx";
import ScreenShare from "./ScreenShare.jsx";
import CameraChat from "./CameraChat.jsx";
import VirtualBrowser from "./VirtualBrowser.jsx";

export default function RoomDesktop({
  socket,
  videoState,
  chatOpen,
  screenActive,
  screenHostId,
  onToggleChat,
  onToggleFullscreen,
}) {
  const {
    windows,
    canControl,
    open,
    close,
    update,
    updateFinal,
    bringToFront,
    toggleMinimize,
    toggleMaximize,
  } = useWindows();

  useEffect(() => {
    const handler = (e) => open(e.detail);
    window.addEventListener("mz:open-window", handler);
    return () => window.removeEventListener("mz:open-window", handler);
  }, [open]);

  const renderContent = (win) => {
    switch (win.kind) {
      case "youtube":
        return (
          <YouTubeWindow
            socket={socket}
            canControl={canControl}
            videoState={videoState}
          />
        );
      case "screen":
        return (
          <ScreenShare
            socket={socket}
            canControl={canControl}
            screenActive={screenActive}
            hostSocketId={screenHostId}
          />
        );
      case "camera":
        return <CameraChat socket={socket} />;
      case "browser":
        return (
          <VirtualBrowser
            socket={socket}
            canControl={canControl}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="desktop">
      {windows.map((win) => (
        <DesktopWindow
          key={win.id}
          win={win}
          onClose={() => close(win.id)}
          onFocus={() => bringToFront(win.id)}
          onUpdate={(patch) => update(win.id, patch)}
          onUpdateFinal={(patch) => updateFinal(win.id, patch)}
          onMinimize={() => toggleMinimize(win.id)}
          onMaximize={() => toggleMaximize(win.id)}
        >
          {renderContent(win)}
        </DesktopWindow>
      ))}

      <DesktopTaskbar
        windows={windows}
        chatOpen={chatOpen}
        onLaunch={open}
        onToggleChat={onToggleChat}
        onToggleFullscreen={onToggleFullscreen}
        onFocusWindow={bringToFront}
        onMinimizeWindow={toggleMinimize}
      />
    </div>
  );
}