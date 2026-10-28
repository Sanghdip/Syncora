import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";

const WindowContext = createContext(null);

let _seq = 1;
function localId(kind) {
  return `${kind}-${Date.now().toString(36)}-${_seq++}`;
}

const DEFAULT_SIZES = {
  youtube: { w: 720, h: 440 },
  screen:  { w: 780, h: 500 },
  camera:  { w: 420, h: 380 },
  browser: { w: 820, h: 560 },
};
const DEFAULT_TITLES = {
  youtube: "YouTube",
  screen:  "Screen Share",
  camera:  "Camera",
  browser: "Virtual Browser",
};
const MIN_W = 260;
const MIN_H = 160;

function isMobileNow() {
  if (typeof window === "undefined") return false;
  const w = window.innerWidth;
  const isTouch =
    (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0) ||
    window.matchMedia?.("(pointer: coarse)").matches || false;
  return w < 640 || (w < 1024 && isTouch);
}

function fitToViewport(size, vw, vh) {
  const maxW = Math.max(MIN_W, vw - 40);
  const maxH = Math.max(MIN_H, vh - 140);
  return { w: Math.min(size.w, maxW), h: Math.min(size.h, maxH) };
}

function dedupeByKind(list) {
  const seen = new Set();
  const out = [];
  for (const w of list) {
    if (!w || !w.kind) continue;
    if (seen.has(w.kind)) continue;
    seen.add(w.kind);
    out.push(w);
  }
  return out;
}

export function WindowManagerProvider({
  socket,
  roomId,
  canControl = false,
  children,
}) {
  const [windows, setWindows] = useState([]);
  const [taskbarPos, setTaskbarPos] = useState(null);
  const [isMobile, setIsMobile] = useState(isMobileNow);
  const zRef = useRef(10);
  const lastEmitRef = useRef({});

  useEffect(() => {
    let raf;
    const check = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setIsMobile(isMobileNow()));
    };
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    const onState = (state) => {
      const clean = dedupeByKind(state?.windows || []);
      setWindows(clean);
      setTaskbarPos(state?.taskbar ?? null);
      const maxZ = clean.reduce((m, x) => Math.max(m, x.z || 0), 10);
      zRef.current = maxZ + 1;
    };

    const onOpen = ({ win }) => {
      if (!win?.id || !win?.kind) return;
      setWindows((prev) => {
        if (prev.some((w) => w.id === win.id)) return prev;
        if (prev.some((w) => w.kind === win.kind)) return prev;
        if (win.z > zRef.current) zRef.current = win.z;
        return [...prev, win];
      });
    };

    const onClose = ({ id }) => {
      setWindows((prev) => prev.filter((w) => w.id !== id));
    };

    const onUpdate = ({ id, patch }) => {
      setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)));
      if (patch?.z && patch.z > zRef.current) zRef.current = patch.z;
    };

    const onTaskbar = ({ pos }) => setTaskbarPos(pos ?? null);

    socket.on("room:state", onState);
    socket.on("window:open", onOpen);
    socket.on("window:close", onClose);
    socket.on("window:update", onUpdate);
    socket.on("taskbar:update", onTaskbar);

    socket.emit("room:state-request", () => {});

    return () => {
      socket.off("room:state", onState);
      socket.off("window:open", onOpen);
      socket.off("window:close", onClose);
      socket.off("window:update", onUpdate);
      socket.off("taskbar:update", onTaskbar);
    };
  }, [socket]);

  const emitWindowUpdate = useCallback((id, patch) => {
    if (!socket) return;
    const now = performance.now();
    const last = lastEmitRef.current[id] || 0;
    if (now - last < 16) return;
    lastEmitRef.current[id] = now;
    socket.emit("window:update", { id, patch });
  }, [socket]);

  const emitWindowUpdateNow = useCallback((id, patch) => {
    if (!socket) return;
    lastEmitRef.current[id] = performance.now();
    socket.emit("window:update", { id, patch });
  }, [socket]);

  const open = useCallback((kind, opts = {}) => {
    if (!canControl) return;
    setWindows((prev) => {
      const existing = prev.find((w) => w.kind === kind);
      if (existing) {
        const z = ++zRef.current;
        const patch = { z, minimized: false };
        socket?.emit("window:update", { id: existing.id, patch });
        return prev.map((w) => (w.id === existing.id ? { ...w, ...patch } : w));
      }

      if (isMobile) {
        const win = {
          id: localId(kind),
          kind,
          title: opts.title || DEFAULT_TITLES[kind] || kind,
          x: 0, y: 0,
          w: window.innerWidth,
          h: window.innerHeight,
          z: ++zRef.current,
          minimized: false, maximized: true,
          prevBounds: null, rotation: 0,
        };
        socket?.emit("window:open", { win });
        return [win];
      }

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const preferred = DEFAULT_SIZES[kind] || { w: 620, h: 420 };
      const size = fitToViewport(preferred, vw, vh);
      const offset = Math.min(prev.length * 28, 180);
      const x = Math.max(20, Math.min(vw - size.w - 20, 40 + offset));
      const y = Math.max(70, Math.min(vh - size.h - 100, 80 + offset));
      const win = {
        id: localId(kind),
        kind,
        title: opts.title || DEFAULT_TITLES[kind] || kind,
        x, y, w: size.w, h: size.h,
        z: ++zRef.current,
        minimized: false, maximized: false,
        prevBounds: null, rotation: 0,
      };
      socket?.emit("window:open", { win });
      return [...prev, win];
    });
  }, [canControl, socket, isMobile]);

  const close = useCallback((id) => {
    if (!canControl) return;
    setWindows((prev) => prev.filter((w) => w.id !== id));
    socket?.emit("window:close", { id });
  }, [canControl, socket]);

  const closeKind = useCallback((kind) => {
    if (!canControl) return;
    setWindows((prev) => {
      prev.filter((w) => w.kind === kind).forEach((w) =>
        socket?.emit("window:close", { id: w.id })
      );
      return prev.filter((w) => w.kind !== kind);
    });
  }, [canControl, socket]);

  const update = useCallback((id, patch) => {
    if (!canControl) return;
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)));
    emitWindowUpdate(id, patch);
  }, [canControl, emitWindowUpdate]);

  const updateFinal = useCallback((id, patch) => {
    if (!canControl) return;
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)));
    emitWindowUpdateNow(id, patch);
  }, [canControl, emitWindowUpdateNow]);

  const bringToFront = useCallback((id) => {
    if (!canControl) return;
    const z = ++zRef.current;
    const patch = { z, minimized: false };
    setWindows((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)));
    socket?.emit("window:update", { id, patch });
  }, [canControl, socket]);

  const toggleMinimize = useCallback((id) => {
    if (!canControl) return;
    setWindows((prev) => {
      const w = prev.find((x) => x.id === id);
      if (!w) return prev;
      const patch = { minimized: !w.minimized };
      socket?.emit("window:update", { id, patch });
      return prev.map((x) => (x.id === id ? { ...x, ...patch } : x));
    });
  }, [canControl, socket]);

  const toggleMaximize = useCallback((id) => {
    if (!canControl || isMobile) return;
    setWindows((prev) => {
      const w = prev.find((x) => x.id === id);
      if (!w) return prev;
      let patch;
      if (w.maximized) {
        patch = {
          maximized: false,
          x: w.prevBounds?.x ?? w.x,
          y: w.prevBounds?.y ?? w.y,
          w: w.prevBounds?.w ?? w.w,
          h: w.prevBounds?.h ?? w.h,
          prevBounds: null,
        };
      } else {
        patch = { maximized: true, prevBounds: { x: w.x, y: w.y, w: w.w, h: w.h } };
      }
      socket?.emit("window:update", { id, patch });
      return prev.map((x) => (x.id === id ? { ...x, ...patch } : x));
    });
  }, [canControl, socket, isMobile]);

  const setTaskbarPosition = useCallback((pos) => {
    if (!canControl) return;
    setTaskbarPos(pos);
    socket?.emit("taskbar:update", { pos });
  }, [canControl, socket]);

  useEffect(() => {
    if (isMobile) return;
    let raf;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        setWindows((prev) =>
          prev.map((w) => {
            if (w.maximized) return w;
            const maxW = Math.max(MIN_W, vw - 20);
            const maxH = Math.max(MIN_H, vh - 100);
            const nw = Math.min(w.w, maxW);
            const nh = Math.min(w.h, maxH);
            const nx = Math.max(0, Math.min(vw - nw, w.x));
            const ny = Math.max(0, Math.min(vh - nh - 20, w.y));
            if (nw === w.w && nh === w.h && nx === w.x && ny === w.y) return w;
            return { ...w, w: nw, h: nh, x: nx, y: ny };
          })
        );
      });
    };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [isMobile]);

  const value = useMemo(() => ({
    windows, isMobile, canControl,
    taskbarPos, setTaskbarPosition,
    open, close, closeKind, update, updateFinal,
    bringToFront, toggleMinimize, toggleMaximize,
  }), [
    windows, isMobile, canControl, taskbarPos, setTaskbarPosition,
    open, close, closeKind, update, updateFinal,
    bringToFront, toggleMinimize, toggleMaximize,
  ]);

  return <WindowContext.Provider value={value}>{children}</WindowContext.Provider>;
}

export function useWindows() {
  const ctx = useContext(WindowContext);
  if (!ctx) throw new Error("useWindows must be used inside WindowManagerProvider");
  return ctx;
}