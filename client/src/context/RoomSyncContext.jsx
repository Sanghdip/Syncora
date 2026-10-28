import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import { useSocket } from "./SocketContext.jsx";

const RoomSyncContext = createContext(null);

const EMPTY_STATE = {
  roomId: null,
  version: 0,
  serverTime: 0,
  host: null,
  hostSocketId: null,
  remoteHolderId: null,
  permitted: [],
  members: [],
  youtube: { videoId: null, playing: false, timestamp: 0 },
  windows: [],
  taskbar: null,
  wallpaper: null,
  activeApplication: null,
  screenShare: { active: false, hostSocketId: null },
  neko: { active: false, startedBy: null },
  settings: {},
};

export function RoomSyncProvider({ children }) {
  const { socket, connected } = useSocket();
  const [state, setState] = useState(EMPTY_STATE);
  const [status, setStatus] = useState("idle"); // idle | syncing | synced | desynced
  const [lastEvent, setLastEvent] = useState(null);
  const [reconnectCount, setReconnectCount] = useState(0);

  const myVersionRef = useRef(0);
  const listenersRef = useRef(new Map()); // event -> Set<fn>

  // ---- Emit a listener map helper ----
  const emitToListeners = useCallback((event, payload) => {
    const set = listenersRef.current.get(event);
    if (!set) return;
    set.forEach((fn) => {
      try { fn(payload); } catch (e) { console.error("[RoomSync] listener error", e); }
    });
    // wildcard
    const all = listenersRef.current.get("*");
    if (all) all.forEach((fn) => { try { fn({ event, payload }); } catch {} });
  }, []);

  // ---- Wire up socket ----
  useEffect(() => {
    if (!socket) return;

    const applySnapshot = (snap) => {
      myVersionRef.current = snap.version || 0;
      setState((prev) => ({ ...prev, ...snap }));
      setStatus("synced");
    };

    const onSync = (msg) => {
      if (!msg) return;
      setLastEvent(msg);

      if (msg.event === "room:full-state") {
        applySnapshot(msg.payload);
        return;
      }

      // Version gap → request full resync
      const incoming = msg.version || 0;
      if (incoming > myVersionRef.current + 1) {
        console.warn("[RoomSync] version gap:", myVersionRef.current, "→", incoming);
        setStatus("desynced");
        socket.emit("room:sync-request");
        return;
      }
      myVersionRef.current = Math.max(myVersionRef.current, incoming);

      // Apply the delta to our snapshot
      setState((prev) => applyDelta(prev, msg));
      setStatus("synced");

      // Notify subscribers
      emitToListeners(msg.event, msg.payload);
      emitToListeners("*", { event: msg.event, payload: msg.payload, msg });
    };

    const onConnect = () => {
      setStatus("syncing");
      socket.emit("room:sync-request");
    };
    const onDisconnect = () => {
      setStatus("idle");
    };
    const onReconnect = () => {
      setReconnectCount((c) => c + 1);
      setStatus("syncing");
      socket.emit("room:sync-request");
    };

    socket.on("room:sync", onSync);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.io.on("reconnect", onReconnect);

    return () => {
      socket.off("room:sync", onSync);
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.io.off("reconnect", onReconnect);
    };
  }, [socket, emitToListeners]);

  // ---- Send an action through the unified channel ----
  const send = useCallback((action, payload) => {
    if (!socket) return;
    socket.emit("room:action", { action, payload });
  }, [socket]);

  const requestResync = useCallback(() => {
    if (!socket) return;
    setStatus("syncing");
    socket.emit("room:sync-request");
  }, [socket]);

  const subscribe = useCallback((event, fn) => {
    if (!listenersRef.current.has(event)) listenersRef.current.set(event, new Set());
    listenersRef.current.get(event).add(fn);
    return () => {
      listenersRef.current.get(event)?.delete(fn);
    };
  }, []);

  const value = useMemo(() => ({
    state,
    status,
    lastEvent,
    reconnectCount,
    connected,
    send,
    subscribe,
    requestResync,
  }), [state, status, lastEvent, reconnectCount, connected, send, subscribe, requestResync]);

  return (
    <RoomSyncContext.Provider value={value}>
      {children}
    </RoomSyncContext.Provider>
  );
}

export function useRoomSync() {
  const ctx = useContext(RoomSyncContext);
  if (!ctx) throw new Error("useRoomSync must be used inside <RoomSyncProvider>");
  return ctx;
}

/**
 * Apply a `room:sync` delta message to the local snapshot.
 */
function applyDelta(prev, msg) {
  const { event, payload } = msg;
  const next = { ...prev, version: msg.version, serverTime: msg.serverTime };

  switch (event) {
    case "wallpaper.changed":
      next.wallpaper = payload.wallpaper;
      break;
    case "activeApplication.changed":
      next.activeApplication = payload.app;
      break;
    case "youtube.play":
    case "youtube.pause":
    case "youtube.seek":
    case "youtube.load":
      next.youtube = {
        videoId: payload.videoId,
        playing: payload.playing,
        timestamp: payload.timestamp,
        updatedAt: payload.updatedAt || Date.now(),
      };
      break;
    case "window:open":
      if (payload?.win) {
        if (!next.windows.some((w) => w.id === payload.win.id)) {
          next.windows = [...next.windows, payload.win];
        }
      }
      break;
    case "window:close":
      next.windows = next.windows.filter((w) => w.id !== payload.id);
      break;
    case "window:update":
      next.windows = next.windows.map((w) =>
        w.id === payload.id ? { ...w, ...payload.patch } : w
      );
      break;
    case "taskbar:update":
      next.taskbar = payload.pos ?? null;
      break;
    case "screen:started":
      next.screenShare = { active: true, hostSocketId: payload.hostSocketId };
      break;
    case "screen:stopped":
      next.screenShare = { active: false, hostSocketId: null };
      break;
    case "neko:started":
      next.neko = { active: true, startedBy: payload.bySocketId };
      break;
    case "neko:stopped":
      next.neko = { active: false, startedBy: null };
      break;
    case "room:members":
      next.members = payload;
      break;
    default:
      // Unknown event — state unchanged. Listeners still fire.
      break;
  }
  return next;
}