import { rooms } from "./roomHandler.js";

export function registerNekoHandlers(io, socket) {
  const ADMIN_PWD = process.env.NEKO_PASSWORD_ADMIN || "syncora-admin";
  const GUEST_PWD = process.env.NEKO_PASSWORD       || "syncora-guest";

  function publicNeko(room) {
    return {
      active: !!room.nekoActive,
      startedBy: room.nekoStartedBy || null,
    };
  }

  socket.on("neko:credentials", (cb) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return cb?.({ ok: false, error: "Not in a room" });

    const isHolder = room.remoteHolderId === socket.id;
    if (isHolder) {
      return cb?.({
        ok: true,
        active: !!room.nekoActive,
        password: ADMIN_PWD,
        role: "admin",
      });
    }
    return cb?.({
      ok: true,
      active: !!room.nekoActive,
      password: GUEST_PWD,
      role: "viewer",
    });
  });

  socket.on("neko:state", (cb) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return cb?.({ ok: false });
    cb?.({ ok: true, ...publicNeko(room) });
  });

  socket.on("neko:start", (cb) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return cb?.({ ok: false, error: "Not in a room" });
    if (room.remoteHolderId !== socket.id) {
      return cb?.({ ok: false, error: "Only the remote holder can start the browser" });
    }
    room.nekoActive = true;
    room.nekoStartedBy = socket.id;
    io.to(room.id).emit("neko:started", { bySocketId: socket.id });
    cb?.({ ok: true });
  });

  socket.on("neko:stop", (cb) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return cb?.({ ok: false, error: "Not in a room" });
    if (room.remoteHolderId !== socket.id) {
      return cb?.({ ok: false, error: "Only the remote holder can stop the browser" });
    }
    room.nekoActive = false;
    room.nekoStartedBy = null;
    io.to(room.id).emit("neko:stopped");
    cb?.({ ok: true });
  });

  socket.on("neko:close", () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    if (room.remoteHolderId !== socket.id) return;
    room.nekoActive = false;
    room.nekoStartedBy = null;
    io.to(roomId).emit("neko:stopped");
  });
}
