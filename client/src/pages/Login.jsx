import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import LiveWallpaper from "../components/LiveWallpaper.jsx";
import GoogleButton from "../components/GoogleButton.jsx";

export default function Login() {
  const nav = useNavigate();
  const { state, user, loginWithGoogle, continueAsGuest, error: authError } = useAuth();
  const [busy, setBusy] = useState(null); // "google" | "guest" | null
  const [error, setError] = useState("");
  const navigatedRef = useRef(false);

  // Already logged in → go straight to the app. The ref guard ensures
  // navigate() fires exactly once even if `state` flaps during auth.
  useEffect(() => {
    if (navigatedRef.current) return;
    if (state === "authenticated" || state === "guest") {
      navigatedRef.current = true;
      nav("/lobby", { replace: true });
    }
  }, [state, nav]);

  const handleCredential = async (credential) => {
    if (busy) return;
    setBusy("google");
    setError("");
    try {
      await loginWithGoogle(credential);
      if (!navigatedRef.current) {
        navigatedRef.current = true;
        nav("/lobby", { replace: true });
      }
    } catch (err) {
      setError(err.message || "Google sign-in failed");
    } finally {
      setBusy(null);
    }
  };

  const handleGuest = async () => {
    if (busy) return;
    setBusy("guest");
    setError("");
    try {
      await continueAsGuest();
      if (!navigatedRef.current) {
        navigatedRef.current = true;
        nav("/lobby", { replace: true });
      }
    } catch (err) {
      setError(err.message || "Could not start guest session");
    } finally {
      setBusy(null);
    }
  };

  if (state === "loading") {
    return (
      <div className="nr-loading">
        <LiveWallpaper />
        <div className="nr-loading-inner">Loading Syncora…</div>
      </div>
    );
  }

  // Already authenticated (e.g. user opened /login directly) → the
  // effect above will redirect. Render the wallpaper in the meantime.
  if (state === "authenticated" || state === "guest") {
    return (
      <div className="nr-loading">
        <LiveWallpaper />
        <div className="nr-loading-inner">Redirecting…</div>
      </div>
    );
  }

  return (
    <>
      <LiveWallpaper />
      <div className="nr-login">
        <div className="nr-login-card">
          <img src="/logo.svg" alt="Syncora" className="nr-login-logo" />
          <h1 className="nr-login-title">Welcome to Syncora</h1>
          <p className="nr-login-sub">
            Connect with people. Join rooms. Start instantly.
          </p>

          <div className="nr-login-actions">
            <GoogleButton
              onCredential={handleCredential}
              disabled={busy !== null}
            />
            {busy === "google" && (
              <div className="nr-login-hint">Signing you in…</div>
            )}

            <div className="nr-login-or">
              <span />
              OR
              <span />
            </div>

            <button
              className="nr-guest-btn"
              onClick={handleGuest}
              disabled={busy !== null}
            >
              {busy === "guest" ? "Starting…" : "Continue as Guest"}
            </button>
          </div>

          {(error || authError) && (
            <div className="nr-login-error">{error || authError}</div>
          )}

          <div className="nr-login-footer">
            Free · No password required · Powered by Google
          </div>
        </div>
      </div>
    </>
  );
}