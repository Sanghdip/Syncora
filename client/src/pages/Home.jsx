import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import LiveWallpaper from "../components/LiveWallpaper.jsx";

export default function Home() {
  const nav = useNavigate();
  const { state } = useAuth();
  const navigatedRef = useRef(false);

  const isAuthed = state === "authenticated" || state === "guest";

  // Redirect authenticated users to the lobby
  useEffect(() => {
    if (navigatedRef.current) return;
    if (isAuthed) {
      navigatedRef.current = true;
      nav("/lobby", { replace: true });
    }
  }, [isAuthed, nav]);

  const handleGetStarted = () => {
    nav(isAuthed ? "/lobby" : "/login");
  };

  return (
    <>
      <LiveWallpaper />
      <div className="nr-login">
        <div className="nr-login-card">
          <img src="/logo.svg" alt="Syncora" className="nr-login-logo" />
          <h1 className="nr-login-title">Syncora</h1>
          <p className="nr-login-sub">
            Watch together. Share screens. Talk face to face.
            <br />
            All in one room. All in real time.
          </p>
          <button
            className="nr-guest-btn"
            onClick={handleGetStarted}
          >
            Get Started
          </button>
        </div>
      </div>
    </>
  );
}
