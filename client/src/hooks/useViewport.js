import { useEffect, useState } from "react";

function readEnv() {
  if (typeof window === "undefined") {
    return {
      w: 1280, h: 720,
      isTouch: false,
      isPhone: false,
      isTablet: false,
      isMobile: false,
      isCompact: false,
      isNarrow: false,
      isShort: false,
      isTiny: false,
    };
  }
  const w = window.innerWidth;
  const h = window.innerHeight;
  const isTouch =
    (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0) ||
    window.matchMedia?.("(pointer: coarse)").matches ||
    false;

  const isPhone  = w < 640;
  const isTablet = w >= 640 && w < 1024;
  const isMobile = isPhone || (isTablet && isTouch);

  return {
    w, h,
    isTouch,
    isPhone,
    isTablet,
    isMobile,
    isCompact: w < 900,
    isNarrow:  w < 720,
    isShort:   h < 620,
    isTiny:    w < 540,
  };
}

export default function useViewport() {
  const [env, setEnv] = useState(readEnv);

  useEffect(() => {
    let raf;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setEnv(readEnv()));
    };
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    document.addEventListener("fullscreenchange", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      document.removeEventListener("fullscreenchange", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);

  return env;
}