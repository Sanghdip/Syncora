import { rooms } from "./roomHandler.js";

export function registerVideoHandlers(io, socket) {

  // ---- Clock sync ----
  socket.on("time:ping", (clientTime, cb) => {
    if (typeof clientTime === "function") {
      cb = clientTime;
      clientTime = null;
    }
    cb?.({ clientTime, serverTime: Date.now() });
  });

  // ---- Video state change — ONLY the remote holder can drive playback ----
  socket.on("video:state-change", ({ videoId, playing, timestamp }) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return;

    // Admin is NOT enough here. Only the current remote holder can change
    // the video for the room. Everyone else (including the host when someone
    // else holds the remote) is treated as a viewer.
    if (room.remoteHolderId !== socket.id) return;

    const state = {
      videoId: videoId ?? room.video?.videoId ?? null,
      playing: !!playing,
      timestamp: Number(timestamp) || 0,
      updatedAt: Date.now(),
    };

    room.video = state;

    io.to(room.id).emit("video:state-update", state);
  });
}