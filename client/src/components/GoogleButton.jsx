import { useEffect, useRef, useState } from "react";

const GSI_SRC = "https://accounts.google.com/gsi/client";

function loadGsi() {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GSI_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Google")));
      return;
    }
    const s = document.createElement("script");
    s.src = GSI_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Google"));
    document.head.appendChild(s);
  });
}

export default function GoogleButton({ onCredential, disabled }) {
  const ref = useRef(null);
  const credRef = useRef(onCredential);
  const initializedRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);

  // Keep the callback fresh without re-initializing Google
  useEffect(() => { credRef.current = onCredential; }, [onCredential]);

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setError("Google login not configured");
      return;
    }
    if (initializedRef.current) return;

    let cancelled = false;
    (async () => {
      try {
        await loadGsi();
        if (cancelled) return;

        if (!initializedRef.current) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: (response) => {
              if (response?.credential) credRef.current(response.credential);
            },
            auto_select: false,
            cancel_on_tap_outside: true,
            use_fedcm_for_prompt: true,
          });
          initializedRef.current = true;
        }

        if (ref.current) {
          window.google.accounts.id.renderButton(ref.current, {
            type: "standard",
            theme: "filled_black",
            size: "large",
            text: "continue_with",
            shape: "pill",
            logo_alignment: "left",
            width: 320,
          });
        }
        setReady(true);
      } catch (err) {
        setError(err.message || "Failed to load Google");
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return (
    <div className={`gbtn-wrap ${disabled ? "disabled" : ""}`}>
      <div ref={ref} />
      {!ready && !error && <div className="gbtn-loading">Loading Google…</div>}
      {error && <div className="gbtn-error">{error}</div>}
    </div>
  );
}