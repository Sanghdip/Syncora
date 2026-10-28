import { useNavigate } from "react-router-dom";
import LiveWallpaper from "../components/LiveWallpaper.jsx";

export default function NotFound() {
  const nav = useNavigate();

  return (
    <>
      <LiveWallpaper />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          textAlign: "center",
          color: "#e6e7ea",
        }}
      >
        <div>
          <div
            style={{
              fontSize: 84,
              fontWeight: 800,
              lineHeight: 1,
              background: "linear-gradient(135deg, #a855f7, #4338ca)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              marginBottom: 12,
            }}
          >
            404
          </div>

          <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 600 }}>
            Page not found
          </h1>
          <p style={{ margin: "0 0 24px", color: "#949ba4", fontSize: 14 }}>
            The page you're looking for doesn't exist.
          </p>

          <button
            className="btn createRoomButton"
            onClick={() => nav("/")}
            style={{ padding: "10px 22px", borderRadius: 10 }}
          >
            Go home
          </button>
        </div>
      </div>
    </>
  );
}