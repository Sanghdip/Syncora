import * as Rooms from "../models/rooms.js";
import { rooms } from "./roomHandler.js";

export function registerChatHandlers(io, socket) {

  // ---- Send message ----
  socket.on("chat:message", async ({ text }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const sender = socket.data.user;
    if (!sender) return;

    const body = String(text || "").slice(0, 2000).trim();
    if (!body) return;

    try {
      // Persist to Postgres
      const saved = await Rooms.saveMessage({
        roomId,
        userId: socket.data.userId,
        text: body,
      });

      const msg = {
        id: saved.id,
        user: {
          username: sender.username,
          nickname: sender.nickname || sender.username,
          avatar: sender.avatar,
          socketId: socket.id,
        },
        text: body,
        timestamp: saved.createdAt,
      };

      io.to(roomId).emit("chat:message", msg);
    } catch (err) {
      console.error("chat:message error:", err);
    }
  });

  // ---- Manual history request ----
  socket.on("chat:history-request", async (cb) => {
    const roomId = socket.data.roomId;
    if (!roomId) return typeof cb === "function" ? cb([]) : null;
    try {
      const history = await Rooms.getHistory(roomId, 100);
      if (typeof cb === "function") cb(history);
      else socket.emit("chat:history", history);
    } catch (err) {
      console.error("chat:history-request error:", err);
      if (typeof cb === "function") cb([]);
    }
  });

  socket.on("chat:request-history", async () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    try {
      const history = await Rooms.getHistory(roomId, 100);
      socket.emit("chat:history", history);
    } catch (err) {
      console.error("chat:request-history error:", err);
    }
  });
}