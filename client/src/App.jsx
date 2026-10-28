import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "./context/AuthContext.jsx";

import Home     from "./pages/Home.jsx";
import Login    from "./pages/Login.jsx";
import Lobby    from "./pages/Lobby.jsx";
import Room     from "./pages/Room.jsx";
import NotFound from "./pages/NotFound.jsx";

function RequireAuth({ children }) {
  const { state } = useAuth();
  const location = useLocation();
  const [graceExpired, setGraceExpired] = useState(false);

  // If state becomes unauthenticated, wait 300ms before redirecting.
  // If it flips back to authenticated/guest in that window, we stay put.
  useEffect(() => {
    if (state !== "unauthenticated") {
      setGraceExpired(false);
      return;
    }
    const t = setTimeout(() => setGraceExpired(true), 300);
    return () => clearTimeout(t);
  }, [state]);

  if (state === "loading") {
    return <div className="nr-loading-simple">Loading…</div>;
  }

  if (state === "unauthenticated") {
    if (!graceExpired) {
      return <div className="nr-loading-simple">Loading…</div>;
    }
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/"             element={<Home />} />
      <Route path="/login"        element={<Login />} />
      <Route path="/lobby"        element={<RequireAuth><Lobby /></RequireAuth>} />
      <Route path="/room/:roomId" element={<RequireAuth><Room /></RequireAuth>} />
      <Route path="/404"          element={<NotFound />} />
      <Route path="*"             element={<Navigate to="/404" replace />} />
    </Routes>
  );
}