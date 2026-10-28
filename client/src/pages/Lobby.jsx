import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import RoomList from "../components/RoomList.jsx";
import Tour from "../components/Tour.jsx";
import LiveWallpaper from "../components/LiveWallpaper.jsx";
import WallpaperPicker from "../components/WallpaperPicker.jsx";
import JoinByCode from "../components/JoinByCode.jsx";

export default function Lobby() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { socket } = useSocket();

  const [rooms, setRooms] = useState([]);
  const [showTour, setShowTour] = useState(false);
  const [showWallpaper, setShowWallpaper] = useState(false);
  const [pendingJoin, setPendingJoin] = useState(null);
  const [pendingPassword, setPendingPassword] = useState("");
  const [pendingError, setPendingError] = useState("");

  // Pull just the string — a fresh object reference each render would
  // make this effect re-fire in a loop.
  const username = user?.username;

  /* ---------------- Rooms list + live updates ---------------- */
  useEffect(() => {
    if (!socket || !username) return;

    let active = true;

    const applyList = (list) => {
      if (active) setRooms(Array.isArray(list) ? list : []);
    };

    const onUpdate = (room) => {
      if (!active || !room) return;
      if (room.isPrivate && room.owner !== username) return;
      setRooms((prev) => {
        const exists = prev.find((r) => r.id === room.id);
        return exists
          ? prev.map((r) => (r.id === room.id ? room : r))
          : [...prev, room];
      });
    };

    const onRemove = (roomId) => {
      if (!active) return;
      setRooms((p) => p.filter((r) => r.id !== roomId));
    };

    socket.emit("lobby:list-rooms", { username }, applyList);
    socket.on("lobby:room-updated", onUpdate);
    socket.on("lobby:room-removed", onRemove);

    return () => {
      active = false;
      socket.off("lobby:room-updated", onUpdate);
      socket.off("lobby:room-removed", onRemove);
    };
  }, [socket, username]);

  /* ---------------- First-time tour ---------------- */
  useEffect(() => {
    if (localStorage.getItem("mz_tour_seen")) return;
    const t = setTimeout(() => setShowTour(true), 600);
    return () => clearTimeout(t);
  }, []);

  /* ---------------- Actions ---------------- */
  const createRoom = (name, description, isPrivate, password) => {
    if (!socket) return;
    socket.emit(
      "room:create",
      { name, description, isPrivate, password },
      ({ ok, room, error }) => {
        if (!ok) {
          alert(error || "Failed to create room");
          return;
        }
        if (isPrivate && password) {
          sessionStorage.setItem(`mz_room_pw_${room.id}`, password);
        }
        nav(`/room/${room.id}`);
      }
    );
  };

  const joinRoom = (code, password) => {
    if (!code?.trim() || !socket) return;
    const roomId = code.trim();
    const pw = password ?? sessionStorage.getItem(`mz_room_pw_${roomId}`) ?? "";

    socket.emit("room:join", { roomId, password: pw }, (res) => {
      if (res?.ok) {
        if (pw) sessionStorage.setItem(`mz_room_pw_${roomId}`, pw);
        nav(`/room/${roomId}`);
        return;
      }
      if (res?.requiresPassword) {
        setPendingJoin({ roomId });
        setPendingPassword("");
        setPendingError(pw ? "Incorrect password. Try again." : "");
        return;
      }
      alert(res?.error || "Failed to join room");
    });
  };

  const submitPassword = () => {
    const id = pendingJoin?.roomId;
    if (!id) return;
    const pwd = pendingPassword.trim();
    if (!pwd) return;
    setPendingJoin(null);
    setPendingPassword("");
    setPendingError("");
    joinRoom(id, pwd);
  };

  const cancelPassword = () => {
    setPendingJoin(null);
    setPendingPassword("");
    setPendingError("");
  };

  const finishTour = () => {
    localStorage.setItem("mz_tour_seen", "1");
    setShowTour(false);
  };

  return (
    <div className="mzcontainer">
      <LiveWallpaper />

      <JoinByCode onJoin={(code) => joinRoom(code)} />

      {/* Sidebar */}
      <div className="mzsidebar">
        <div className="sidebarhome" data-tour="nav-lobby">
          <div className="sidebar-home-button" title="Lobby" />
        </div>

        <div className="sidebarspace" />

        <div
          className="sidebarprofile"
          title="Change wallpaper"
          onClick={() => setShowWallpaper(true)}
          style={{ cursor: "pointer" }}
        >
          <div
            className="sidebar-profile-button"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
            }}
          >
            🎨
          </div>
        </div>
      </div>

      <RoomList
        rooms={rooms}
        onCreate={createRoom}
        onJoin={joinRoom}
      />

      {showTour && <Tour onDone={finishTour} />}

      <WallpaperPicker
        open={showWallpaper}
        onClose={() => setShowWallpaper(false)}
      />

      {/* Password prompt for private rooms */}
      {pendingJoin && (
        <div className="pw-overlay" onClick={cancelPassword}>
          <div className="pw-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="pw-title">🔒 Private Room</h3>
            <p className="pw-sub">
              This room is password-protected. Enter the password to join.
            </p>
            <input
              className="pw-input"
              type="password"
              autoFocus
              placeholder="Room password"
              value={pendingPassword}
              onChange={(e) => {
                setPendingPassword(e.target.value);
                if (pendingError) setPendingError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && submitPassword()}
            />
            {pendingError && <div className="pw-error">{pendingError}</div>}
            <div className="pw-actions">
              <button className="pw-btn ghost" onClick={cancelPassword}>
                Cancel
              </button>
              <button
                className="pw-btn primary"
                onClick={submitPassword}
                disabled={!pendingPassword.trim()}
              >
                Join
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}