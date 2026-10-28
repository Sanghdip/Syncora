import { createContext, useContext, useEffect, useState } from "react";

const WallpaperContext = createContext(null);

const STORAGE_KEYS = {
  lobby: "mz_wallpaper",
  room:  "mz_room_wallpaper",
};

const DEFAULT = { type: "particles", url: "" };

// One slice per variant. Each has its own storage key + state.
function useWallpaperSlice(key) {
  const [wallpaper, setWallpaper] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key)) || DEFAULT;
    } catch {
      return DEFAULT;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(wallpaper));
    } catch {
      /* storage may be full or blocked */
    }
  }, [key, wallpaper]);

  return { wallpaper, setWallpaper };
}

export function WallpaperProvider({ children }) {
  const lobby = useWallpaperSlice(STORAGE_KEYS.lobby);
  const room  = useWallpaperSlice(STORAGE_KEYS.room);

  return (
    <WallpaperContext.Provider value={{ lobby, room }}>
      {children}
    </WallpaperContext.Provider>
  );
}

/**
 * useWallpaper("lobby") -> { wallpaper, setWallpaper }   (default)
 * useWallpaper("room")  -> { wallpaper, setWallpaper }
 */
export function useWallpaper(variant = "lobby") {
  const ctx = useContext(WallpaperContext);
  if (!ctx) {
    throw new Error("useWallpaper must be used inside <WallpaperProvider>");
  }
  return ctx[variant] || ctx.lobby;
}