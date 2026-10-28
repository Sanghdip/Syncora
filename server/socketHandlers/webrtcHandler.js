import { rooms } from "./roomHandler.js";

export function registerWebRTCHandlers(io, socket) {

  // ---- Camera presence ----
  socket.on("camera:enable", () => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room) return;

    if (!room.activeCameras) room.activeCameras = new Set();
    room.activeCameras.add(socket.id);

    // Tell everyone else — they'll request our stream
    socket.to(roomId).emit("camera:live", {
      socketId: socket.id,
      user: socket.data.user,
    });

    // Send us the list of users who were already live
    socket.emit("camera:active", {
      socketIds: Array.from(room.activeCameras).filter((id) => id !== socket.id),
    });
  });

  socket.on("camera:disable", () => {
    const roomId = socket.data.roomId;
    const room = rooms.get(roomId);
    if (!room) return;
    room.activeCameras?.delete(socket.id);
    socket.to(roomId).emit("camera:off", { socketId: socket.id });
  });

  // ---- Signal relay (camera + screen share) ----
  socket.on("webrtc:signal", ({ to, signal, streamKind }) => {
    if (!to || !signal) return;

    // A viewer is asking for our stream → send a "new-viewer" event
    // to us so we can build an offer.
    if (signal.type === "camera-request") {
      io.to(to).emit("webrtc:new-viewer", {
        viewerSocketId: socket.id,
        viewerUser: socket.data.user,
        kind: "camera",
      });
      return;
    }

    if (signal.type === "screen-viewer-request") {
      io.to(to).emit("webrtc:new-viewer", {
        viewerSocketId: socket.id,
        viewerUser: socket.data.user,
        kind: "screen",
      });
      return;
    }

    // Everything else (offers, answers, ICE) goes straight through
    io.to(to).emit("webrtc:signal", {
      from: socket.id,
      fromUser: socket.data.user,
      signal,
      streamKind: streamKind || "camera",
    });
  });
}