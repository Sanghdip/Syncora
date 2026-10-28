import { nanoid } from "nanoid";
import * as Rooms from "../models/rooms.js";

// ---- In-memory live session state ----------------------------------------
// Keyed by room id. Holds per-session data (windows, video, screen, etc).
// The DB is the source of truth for room existence, owner, and chat.
export const rooms = new Map();
export const users = new Map();

function publicRoom(r) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    owner: r.owner,          // display name for the UI
    ownerId: r.ownerId,      // permanent user id
    viewerCount: r.members.length,
    thumbnail: r.thumbnail,
    isPrivate: !!r.isPrivate,
  };
}

function publicAccess(room) {
  const holder = room.members.find((m) => m.socketId === room.remoteHolderId);
  return {
    holderId: room.remoteHolderId || null,
    holderUsername: holder?.username || null,
    holderAvatar: holder?.avatar || null,
    permitted: Array.from(room.permitted || []),
    requests: (room.remoteRequests || []).map((r) => ({
      socketId: r.socketId,
      username: r.username,
      avatar: r.avatar,
      requestedAt: r.requestedAt,
    })),
  };
}

function avatarFor(seed) {
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(seed)}`;
}

function canControl(socket, room) {
  if (!room) return false;
  return room.remoteHolderId === socket.id;
}

function emitAccess(io, room) {
  io.to(room.id).emit("access:state", publicAccess(room));
}

function dedupeWindows(list) {
  const seen = new Set();
  const out = [];
  for (const w of list || []) {
    if (!w?.kind || seen.has(w.kind)) continue;
    seen.add(w.kind);
    out.push(w);
  }
  return out;
}

// ---- Hydrate in-memory room from DB (first join after restart) -----------
async function hydrateRoom(dbRoom) {
  if (rooms.has(dbRoom.id)) return rooms.get(dbRoom.id);

  const live = {
    id: dbRoom.id,
    name: dbRoom.name,
    description: dbRoom.description || "",
    ownerId: dbRoom.owner_id,                // permanent
    owner: dbRoom.owner_name || "Owner",     // display name (resolved from DB row)
    members: [],
    video: { videoId: null, playing: false, timestamp: 0 },
    thumbnail: dbRoom.thumbnail || `https://picsum.photos/seed/${dbRoom.id}/400/225`,
    nekoPassword: null,
    isPrivate: !dbRoom.is_public,
    password: dbRoom.password || "",
    permissions: {},
    screenActive: false,
    screenHostId: null,
    activeCameras: new Set(),
    windows: [],
    taskbar: null,
    hostSocketId: null,
    remoteHolderId: null,
    permitted: new Set(),
    remoteRequests: [],
    nekoActive: false,
    nekoStartedBy: null,
    version: 0,
    updatedAt: Date.now(),
    wallpaper: null,
    activeApplication: null,
    settings: {},
  };
  rooms.set(dbRoom.id, live);
  return live;
}

// ---- Leave (no owner reassignment, no room deletion) ---------------------
function leaveRoom(io, socket) {
  const roomId = socket.data.roomId;
  if (!roomId) return;
  const room = rooms.get(roomId);
  if (!room) {
    socket.data.roomId = null;
    socket.data.roomPassword = null;
    users.delete(socket.id);
    return;
  }

  const leaving = users.get(socket.id);
  const wasMember = room.members.some((m) => m.socketId === socket.id);
  if (!wasMember && !leaving) { socket.data.roomId = null; return; }

  room.members = room.members.filter((m) => m.socketId !== socket.id);
  if (room.permissions) delete room.permissions[socket.id];
  if (room.activeCameras) room.activeCameras.delete(socket.id);
  room.permitted?.delete(socket.id);
  room.remoteRequests = (room.remoteRequests || []).filter((r) => r.socketId !== socket.id);
  socket.leave(roomId);

  if (room.screenHostId === socket.id) {
    room.screenActive = false;
    room.screenHostId = null;
    io.to(roomId).emit("screen:stopped");
  }
  socket.to(roomId).emit("camera:off", { socketId: socket.id });

  const wasHolder = room.remoteHolderId === socket.id;
  const wasHostSocket = room.hostSocketId === socket.id;

  // NOTE: Do NOT delete the room when empty, do NOT reassign owner.
  if (room.members.length === 0) {
    // Keep in-memory entry so reconnects are cheap, but that's optional.
    // We keep it. The DB row is the source of truth either way.
  }

  if (wasHostSocket) room.hostSocketId = room.members[0]?.socketId || null;
  if (wasHolder) {
    const hostStillHere = room.members.some((m) => m.socketId === room.hostSocketId);
    room.remoteHolderId = hostStillHere
      ? room.hostSocketId
      : (room.members[0]?.socketId || null);
  }

  io.to(roomId).emit("room:members", room.members);
  io.to(roomId).emit("room:permissions", room.permissions);
  emitAccess(io, room);
  io.emit("lobby:room-updated", publicRoom(room));

  io.to(roomId).emit("room:member-left", { socketId: socket.id, user: leaving || null });
  users.delete(socket.id);
  socket.data.roomId = null;
  socket.data.roomPassword = null;
}

export function registerRoomHandlers(io, socket) {
  // ---- Floating Emoji Reactions ----
  socket.on("room:reaction", ({ emoji } = {}) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return;
    if (typeof emoji !== "string" || emoji.length > 8) return;
    const user = socket.data.user;
    if (!user) return;
    io.to(room.id).emit("room:reaction", {
      id: `${socket.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      emoji,
      userId: user.id,
      username: user.nickname || user.username,
      timestamp: Date.now(),
    });
  });

  // ---- Lobby: list rooms (from DB) ----
  socket.on("lobby:list-rooms", async (payload, cb) => {
    if (typeof payload === "function") { cb = payload; payload = {}; }
    try {
      const rows = await Rooms.listPublic(50);
      const list = rows.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description || "",
        owner: r.owner_name || "Owner",
        ownerId: r.owner_id,
        viewerCount: rooms.get(r.id)?.members.length || 0,
        thumbnail: r.thumbnail || `https://picsum.photos/seed/${r.id}/400/225`,
        isPrivate: !r.is_public,
      }));
      cb(list);
    } catch (err) {
      console.error("lobby:list-rooms error:", err);
      cb([]);
    }
  });

  // ---- Create room (persisted to DB) ----
  socket.on("room:create", async ({ name, description, isPrivate, password }, cb) => {
    const user = socket.data.user;
    if (!user) return cb({ ok: false, error: "Not authenticated" });

    const priv = !!isPrivate;
    const pwd = priv ? String(password || "").trim() : "";
    if (priv && !pwd) return cb({ ok: false, error: "Private rooms require a password" });

    try {
      const dbRoom = await Rooms.createRoom({
        name: (name || "Untitled Room").slice(0, 30),
        description: (description || "").slice(0, 150),
        ownerId: user.id,
        isPublic: !priv,
      });

      // If you support password/description, persist them too — for now keep in memory.
      const live = await hydrateRoom({
        ...dbRoom,
        owner_name: user.displayName || user.username,
        password: pwd,
        thumbnail: `https://picsum.photos/seed/${dbRoom.id}/400/225`,
      });
      live.isPrivate = priv;
      live.password = pwd;

      io.emit("lobby:room-updated", publicRoom(live));
      cb({ ok: true, room: publicRoom(live), role: "host", isOwner: true });
    } catch (err) {
      console.error("room:create error:", err);
      cb({ ok: false, error: "Failed to create room" });
    }
  });

  // ---- Join room ----
  socket.on("room:join", async ({ roomId, password }, cb) => {
    const user = socket.data.user;
    if (!user) return cb({ ok: false, error: "Not authenticated" });

    try {
      const dbRoom = await Rooms.findById(roomId);
      if (!dbRoom) return cb({ ok: false, error: "Room not found" });

      const room = await hydrateRoom(dbRoom);

      const isOwner = room.ownerId === user.id;
      if (room.isPrivate && room.password && !isOwner && room.password !== password) {
        return cb({ ok: false, error: "Incorrect password", requiresPassword: true });
      }

      if (!room.windows) room.windows = [];
      if (!room.activeCameras) room.activeCameras = new Set();
      if (!room.permitted) room.permitted = new Set();
      if (!room.remoteRequests) room.remoteRequests = [];

      room.windows = dedupeWindows(room.windows);
      room.members = room.members.filter((m) => m.username !== user.username);

      user.socketId = socket.id;
      user.role = isOwner ? "host" : "guest";
      if (!user.avatar) user.avatar = avatarFor(user.username);
      if (!user.nickname) user.nickname = user.username;
      users.set(socket.id, user);
      room.members.push(user);

      if (!room.permissions) room.permissions = {};
      room.permissions[socket.id] = { youtube: true, screen: true, camera: true, browser: true };

      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.user = user;
      socket.data.roomPassword = room.isPrivate ? room.password : null;

      if (isOwner) {
        room.hostSocketId = socket.id;
        if (!room.remoteHolderId) room.remoteHolderId = socket.id;
      }

      const pub = publicRoom(room);
      io.to(roomId).emit("room:members", room.members);
      io.to(roomId).emit("room:video-state", room.video);
      io.to(roomId).emit("room:permissions", room.permissions);
      io.emit("lobby:room-updated", pub);

      socket.emit("room:state", {
        windows: room.windows,
        taskbar: room.taskbar || null,
      });
      socket.emit("access:state", publicAccess(room));

      // Load chat history from DB (not memory)
      const history = await Rooms.getHistory(roomId, 100);
      socket.emit("chat:history", history);

      socket.emit("room:sync-request");

      if (room.screenActive && room.screenHostId) {
        socket.emit("screen:started", { hostSocketId: room.screenHostId });
      }

      emitAccess(io, room);

      cb({
        ok: true,
        room: pub,
        role: user.role,
        isOwner,
        ownerId: room.ownerId,
        holderId: room.remoteHolderId,
        permitted: Array.from(room.permitted),
      });
    } catch (err) {
      console.error("room:join error:", err);
      cb({ ok: false, error: "Failed to join room" });
    }
  });

  // ---- Leave ----
  socket.on("room:leave", () => {
    const room = rooms.get(socket.data.roomId);
    if (room && room.screenHostId === socket.id) {
      room.screenActive = false;
      room.screenHostId = null;
      io.to(room.id).emit("screen:stopped");
    }
    leaveRoom(io, socket);
  });

  // ---- Disconnect ----
  socket.on("disconnect", (reason) => {
    console.log(`🔌 disconnected: ${socket.id} (${reason})`);

    // If this socket was sharing its screen, tell the room to stop viewing
    const room = rooms.get(socket.data.roomId);
    if (room && room.screenHostId === socket.id) {
      room.screenActive = false;
      room.screenHostId = null;
      io.to(room.id).emit("screen:stopped");
    }

    leaveRoom(io, socket);
  });

  socket.on("room:state-request", () => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return;
    socket.emit("room:state", {
      windows: dedupeWindows(room.windows || []),
      taskbar: room.taskbar || null,
    });
    socket.emit("access:state", publicAccess(room));
  });

  // ---- Admin: clear chat ----
  socket.on("room:clear-chat", async ({ roomId }, cb) => {
    try {
      const room = rooms.get(roomId);
      const uid = socket.data.userId;
      const isOwner = room ? room.ownerId === uid : await Rooms.isOwner(roomId, uid);
      if (!isOwner) return cb?.({ ok: false, error: "Only the owner can clear chat" });

      await Rooms.clearMessages(roomId);
      io.to(roomId).emit("chat:cleared");
      cb?.({ ok: true });
    } catch (err) {
      console.error("room:clear-chat error:", err);
      cb?.({ ok: false, error: "Failed to clear chat" });
    }
  });

  // ---- Admin: delete room ----
  socket.on("room:delete", async ({ roomId }, cb) => {
    try {
      const room = rooms.get(roomId);
      const uid = socket.data.userId;
      const isOwner = room ? room.ownerId === uid : await Rooms.isOwner(roomId, uid);
      if (!isOwner) return cb?.({ ok: false, error: "Only the owner can delete the room" });

      io.to(roomId).emit("room:deleted", { roomId });
      io.socketsLeave(roomId);
      rooms.delete(roomId);
      await Rooms.deleteRoom(roomId);
      io.emit("lobby:room-removed", roomId);
      cb?.({ ok: true });
    } catch (err) {
      console.error("room:delete error:", err);
      cb?.({ ok: false, error: "Failed to delete room" });
    }
  });

  // ---- Remote access control ----
  socket.on("access:permit", ({ targetSocketId, allowed }, cb) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return cb?.({ ok: false, error: "Not in a room" });
    if (room.ownerId !== socket.data.userId) {
      return cb?.({ ok: false, error: "Only the host can change permissions" });
    }
    if (!room.permitted) room.permitted = new Set();
    const target = room.members.find((m) => m.socketId === targetSocketId);
    if (!target) return cb?.({ ok: false, error: "User not found" });
    if (allowed) room.permitted.add(targetSocketId);
    else {
      room.permitted.delete(targetSocketId);
      if (room.remoteHolderId === targetSocketId) room.remoteHolderId = room.hostSocketId;
      room.remoteRequests = (room.remoteRequests || []).filter((r) => r.socketId !== targetSocketId);
    }
    emitAccess(io, room);
    cb?.({ ok: true });
  });

  socket.on("access:request-remote", (cb) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return cb?.({ ok: false, error: "Not in a room" });
    const isOwner = room.ownerId === socket.data.userId;
    const isPermitted = room.permitted?.has(socket.id);
    if (!isOwner && !isPermitted) return cb?.({ ok: false, error: "Not permitted" });
    if (room.remoteHolderId === socket.id) return cb?.({ ok: false, error: "Already hold remote" });
    if (!room.remoteRequests) room.remoteRequests = [];
    if (!room.remoteRequests.some((r) => r.socketId === socket.id)) {
      room.remoteRequests.push({
        socketId: socket.id,
        username: socket.data.user?.nickname || socket.data.user?.username,
        avatar: socket.data.user?.avatar,
        requestedAt: Date.now(),
      });
    }
    emitAccess(io, room);
    cb?.({ ok: true });
  });

  socket.on("access:approve-request", ({ targetSocketId }, cb) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return cb?.({ ok: false, error: "Not in a room" });
    const isOwner = room.ownerId === socket.data.userId;
    const isHolder = room.remoteHolderId === socket.id;
    if (!isOwner && !isHolder) return cb?.({ ok: false, error: "Not allowed" });
    if (!room.permitted?.has(targetSocketId) && targetSocketId !== room.hostSocketId) {
      return cb?.({ ok: false, error: "User isn't permitted" });
    }
    room.remoteHolderId = targetSocketId;
    room.remoteRequests = (room.remoteRequests || []).filter((r) => r.socketId !== targetSocketId);
    emitAccess(io, room);
    cb?.({ ok: true });
  });

  socket.on("access:deny-request", ({ targetSocketId }, cb) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return cb?.({ ok: false, error: "Not in a room" });
    const isOwner = room.ownerId === socket.data.userId;
    const isHolder = room.remoteHolderId === socket.id;
    if (!isOwner && !isHolder) return cb?.({ ok: false, error: "Not allowed" });
    room.remoteRequests = (room.remoteRequests || []).filter((r) => r.socketId !== targetSocketId);
    emitAccess(io, room);
    cb?.({ ok: true });
  });

  socket.on("access:force-holder", ({ targetSocketId }, cb) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return cb?.({ ok: false, error: "Not in a room" });
    if (room.ownerId !== socket.data.userId) return cb?.({ ok: false, error: "Only host" });
    if (targetSocketId !== room.hostSocketId && !room.permitted?.has(targetSocketId)) {
      return cb?.({ ok: false, error: "User isn't permitted" });
    }
    if (!room.members.some((m) => m.socketId === targetSocketId)) {
      return cb?.({ ok: false, error: "User not found" });
    }
    room.remoteHolderId = targetSocketId;
    room.remoteRequests = (room.remoteRequests || []).filter((r) => r.socketId !== targetSocketId);
    emitAccess(io, room);
    cb?.({ ok: true });
  });

  socket.on("access:release-remote", (cb) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return cb?.({ ok: false, error: "Not in a room" });
    if (room.remoteHolderId !== socket.id) return cb?.({ ok: false, error: "Not holder" });
    room.remoteHolderId = room.hostSocketId;
    room.remoteRequests = (room.remoteRequests || []).filter((r) => r.socketId !== socket.id);
    emitAccess(io, room);
    cb?.({ ok: true });
  });

  // ---- Windows / taskbar ----
  socket.on("window:open", ({ win }) => {
    const room = rooms.get(socket.data.roomId);
    if (!room || !canControl(socket, room)) return;
    if (!win?.id || !win?.kind) return;
    if (!room.windows) room.windows = [];
    if (room.windows.some((w) => w.id === win.id)) return;
    if (room.windows.some((w) => w.kind === win.kind)) return;
    room.windows.push(win);
    socket.to(room.id).emit("window:open", { win });
  });

  socket.on("window:close", ({ id }) => {
    const room = rooms.get(socket.data.roomId);
    if (!room || !canControl(socket, room)) return;
    if (!id) return;
    room.windows = (room.windows || []).filter((w) => w.id !== id);
    socket.to(room.id).emit("window:close", { id });
  });

  socket.on("window:update", ({ id, patch }) => {
    const room = rooms.get(socket.data.roomId);
    if (!room || !canControl(socket, room)) return;
    if (!id || !patch) return;
    const w = (room.windows || []).find((x) => x.id === id);
    if (!w) return;
    Object.assign(w, patch);
    socket.to(room.id).emit("window:update", { id, patch });
  });

  socket.on("taskbar:update", ({ pos }) => {
    const room = rooms.get(socket.data.roomId);
    if (!room || !canControl(socket, room)) return;
    room.taskbar = pos;
    socket.to(room.id).emit("taskbar:update", { pos });
  });

  // ---- Screen share ----
  // NOTE: these do NOT require canControl(). Screen share is independent of
  // remote control. The sharer is tracked by screenHostId, and only that
  // socket can stop the share.
  socket.on("screen:host-start", () => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return;
    room.screenActive = true;
    room.screenHostId = socket.id;
    io.to(room.id).emit("screen:started", { hostSocketId: socket.id });
  });

  socket.on("screen:host-stop", () => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return;
    if (room.screenHostId !== socket.id) return;
    room.screenActive = false;
    room.screenHostId = null;
    io.to(room.id).emit("screen:stopped");
  });

  socket.on("room:rename-user", ({ targetSocketId, nickname }, cb) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return cb?.({ ok: false, error: "Not in a room" });
    const name = String(nickname || "").trim().slice(0, 24);
    if (!name) return cb?.({ ok: false, error: "Nickname cannot be empty" });
    const isOwner = room.ownerId === socket.data.userId;
    const isSelf = targetSocketId === socket.id;
    if (!isOwner && !isSelf) return cb?.({ ok: false, error: "Not allowed" });
    const target = room.members.find((m) => m.socketId === targetSocketId);
    if (!target) return cb?.({ ok: false, error: "User not found" });
    target.nickname = name;
    target.avatar = avatarFor(name);
    io.to(room.id).emit("room:members", room.members);
    emitAccess(io, room);
    cb?.({ ok: true });
  });

  socket.on("room:update-profile", ({ name, description, thumbnail }, cb) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return cb?.({ ok: false, error: "Not in a room" });
    if (room.ownerId !== socket.data.userId) return cb?.({ ok: false, error: "Only host" });
    if (typeof name === "string" && name.trim()) room.name = name.trim().slice(0, 30);
    if (typeof description === "string") room.description = description.slice(0, 150);
    if (typeof thumbnail === "string" && thumbnail) room.thumbnail = thumbnail;
    const pub = publicRoom(room);
    io.to(room.id).emit("room:updated", pub);
    io.emit("lobby:room-updated", pub);
    cb?.({ ok: true, room: pub });
  });

  socket.on("room:kick", ({ targetSocketId }) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return;
    if (room.ownerId !== socket.data.userId) return;
    io.to(targetSocketId).emit("room:kicked", { roomId: room.id });
    io.sockets.sockets.get(targetSocketId)?.leave(room.id);
  });
}