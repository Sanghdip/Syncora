import { useCallback, useState } from "react";

export default function useNeko(socket) {
  const [creds, setCreds] = useState(null);

  const request = useCallback(() => {
    if (!socket) return Promise.reject("no socket");
    return new Promise((resolve, reject) => {
      socket.emit("neko:credentials", (res) => {
        if (res.ok) { setCreds(res); resolve(res); }
        else        { reject(res.error); }
      });
    });
  }, [socket]);

  const close = useCallback(() => {
    if (!socket) return;
    socket.emit("neko:close");
    setCreds(null);
  }, [socket]);

  return { creds, request, close };
}