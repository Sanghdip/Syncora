import { rooms } from "../socketHandlers/roomHandler.js";

/**
 * NightRoom Sync Engine
 *
 * One central place for:
 *   - full state snapshots (used on join, reconnect, version gap)
 *   - version bumping
 *   - unified `room:sync` broadcasting
 *   - routing client actions from `room:action` to internal handlers
 */

export function bumpVersion(room) {
  room.version = (room.version || 0) + 1;
  room.updatedAt = Date.now();
  return room.version;
}

export function getSnapshot(room) {
  if (!room) return null;
  return {
    roomId: room.id,
    version: room.version || 0,
    updatedAt: room.updatedAt || Date.now(),
    serverTime: Date.now(),

    host: room.owner,
    ownerId: room.ownerId,       // add this line
    hostSocketId: room.hostSocketId || null,
    remoteHolderId: room.remoteHolderId || null,
    permitted: Array.from(room.permitted || []),

    members: (room.members || []).map((m) => ({
      socketId: m.socketId,
      username: m.username,
      nickname: m.nickname,
      avatar: m.avatar,
      role: m.role,
    })),

    youtube: room.video || { videoId: null, playing: false, timestamp: 0 },

    windows: room.windows || [],
    taskbar: room.taskbar || null,

    wallpaper: room.wallpaper || null,

    screenShare: {
      active: !!room.screenActive,
      hostSocketId: room.screenHostId || null,
    },

    neko: {
      active: !!room.nekoActive,
      startedBy: room.nekoStartedBy || null,
    },

    settings: room.settings || {},
  };
}

/**
 * Unified broadcast — bumps version and sends one `room:sync` event.
 * Legacy events (window:open, video:state-update, etc.) can still be
 * emitted alongside during migration; new features should use this.
 */
export function broadcast(io, room, event, payload, actorSocketId = null) {
  if (!room) return;
  const version = bumpVersion(room);
  const msg = {
    type: "room:sync",
    roomId: room.id,
    version,
    event,
    payload: payload ?? {},
    serverTime: Date.now(),
    actorSocketId,
  };
  io.to(room.id).emit("room:sync", msg);
}

/**
 * Register per-socket sync entry points. Called once per connection
 * from index.js inside io.on("connection").
 */
export function registerSyncHandlers(io, socket) {
  // ---- Full state request (join, reconnect, version gap) ----
  socket.on("room:sync-request", () => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return;
    socket.emit("room:sync", {
      type: "room:sync",
      roomId: room.id,
      version: room.version || 0,
      event: "room:full-state",
      payload: getSnapshot(room),
      serverTime: Date.now(),
    });
  });

  // ---- Unified action channel ----
  // Client sends: { action: "youtube.play", payload: {...} }
  // Server validates, applies, broadcasts on `room:sync`.
  socket.on("room:action", ({ action, payload } = {}) => {
    const room = rooms.get(socket.data.roomId);
    if (!room) return;
    if (typeof action !== "string") return;

    switch (action) {
      // ---------- Wallpaper ----------
      case "wallpaper.change": {
        if (room.remoteHolderId !== socket.id) return;
        room.wallpaper = payload?.wallpaper || null;
        broadcast(io, room, "wallpaper.changed",
          { wallpaper: room.wallpaper }, socket.id);
        return;
      }

      // ---------- Active application ----------
      case "activeApplication.change": {
        if (room.remoteHolderId !== socket.id) return;
        room.activeApplication = payload?.app || null;
        broadcast(io, room, "activeApplication.changed",
          { app: room.activeApplication }, socket.id);
        return;
      }

      // ---------- YouTube ----------
      case "youtube.play":
      case "youtube.pause":
      case "youtube.seek":
      case "youtube.load": {
        if (room.remoteHolderId !== socket.id) return;
        const next = {
          videoId: payload?.videoId ?? room.video?.videoId ?? null,
          playing: action === "youtube.play"
            ? true
            : action === "youtube.pause"
              ? false
              : (payload?.playing ?? room.video?.playing ?? false),
          timestamp: Number(payload?.timestamp) || 0,
          updatedAt: Date.now(),
        };
        room.video = next;
        broadcast(io, room, action, next, socket.id);
        return;
      }

      // Everything else is out of scope of the unified channel for now —
      // legacy events (window:open, screen:host-start, neko:start, etc.)
      // continue to run independently and can be migrated in later.
      default:
        return;
    }
  });
}