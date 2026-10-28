import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext.jsx";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { state } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    const authed = state === "authenticated" || state === "guest";

    // Not logged in → tear down any existing socket
    if (!authed) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    // Already connected for this auth session
    if (socketRef.current) return;

    const s = io(import.meta.env.VITE_SERVER_URL || undefined, {
      transports: ["websocket", "polling"],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
    });

    socketRef.current = s;
    setSocket(s);
    if (typeof window !== "undefined") window.__socket = s;

    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));
    s.on("connect_error", (e) => {
      // Silence the expected "Not authenticated" during login transitions
      if (e.message !== "Not authenticated") {
        console.warn("Socket error:", e.message);
      }
    });

    // NOTE: no cleanup here. StrictMode's fake unmount would kill the
    // socket mid-handshake and spam the console. The effect runs again
    // when `state` changes (e.g. logout), which is where we disconnect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Real unmount cleanup (only when SocketProvider itself is removed)
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}