import { useEffect, useState } from "react";

/**
 * Returns the height of the on-screen keyboard in CSS pixels.
 * 0 when no keyboard is open.
 */
export default function useKeyboardInset() {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      // When keyboard is open, visualViewport.height shrinks but
      // window.innerHeight stays the same. The difference is the keyboard.
      const diff = window.innerHeight - vv.height - vv.offsetTop;
      setInset(Math.max(0, Math.round(diff)));
    };

    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return inset;
}