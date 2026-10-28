import { useRoomSync } from "../context/RoomSyncContext.jsx";

export default function SyncDebug() {
  const { state, status, lastEvent, reconnectCount, connected } = useRoomSync();

  if (!import.meta.env.DEV) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 8,
        left: 8,
        zIndex: 999999,
        background: "rgba(0,0,0,0.72)",
        color: "#dcddde",
        fontFamily: "ui-monospace, monospace",
        fontSize: 11,
        padding: "8px 10px",
        borderRadius: 8,
        lineHeight: 1.55,
        pointerEvents: "none",
        maxWidth: 240,
      }}
    >
      <div style={{ color: "#57f287", fontWeight: 700 }}>RoomSync</div>
      <div>status: {status}</div>
      <div>socket: {connected ? "up" : "down"}</div>
      <div>version: {state.version}</div>
      <div>room: {state.roomId || "—"}</div>
      <div>windows: {state.windows.length}</div>
      <div>wallpaper: {state.wallpaper?.type || "—"}</div>
      <div>yt: {state.youtube?.videoId || "—"}</div>
      <div>last: {lastEvent?.event || "—"}</div>
      <div>reconnect: {reconnectCount}</div>
    </div>
  );
}