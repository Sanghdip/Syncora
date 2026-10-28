import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSocket } from "../context/SocketContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useRoomSync } from "../context/RoomSyncContext.jsx";
import { WindowManagerProvider, useWindows } from "../context/WindowManager.jsx";
import useViewport from "../hooks/useViewport.js";
import FloatingReactions from "../components/FloatingReactions.jsx";

import RoomPill           from "../components/RoomPill.jsx";
import ChatPanel          from "../components/ChatPanel.jsx";
import SideRail           from "../components/SideRail.jsx";
import UserBadges         from "../components/UserBadges.jsx";
import EditRoomProfile    from "../components/EditRoomProfile.jsx";
import LiveWallpaper      from "../components/LiveWallpaper.jsx";
import WallpaperPicker    from "../components/WallpaperPicker.jsx";
import RoomDesktop        from "../components/RoomDesktop.jsx";
import RemotePanel        from "../components/RemotePanel.jsx";
import RemoteRequestToast from "../components/RemoteRequestToast.jsx";

/* ------------------------------------------------------------------ */
/*  Inner content — renders inside the WindowManagerProvider          */
/* ------------------------------------------------------------------ */
function RoomContent({
  socket,
  user,
  room,
  isHost,
  access,
  mySocketId,
  onApprove,
  onDeny,
  onOpenRemote,
  members,
  videoState,
  chatOpen,
  setChatOpen,
  settingsOpen,
  setSettingsOpen,
  profileOpen,
  setProfileOpen,
  wallpaperOpen,
  setWallpaperOpen,
  createdRooms,
  screenActive,
  screenHostId,
  leaveRoom,
  toggleFullscreen,
  logout,
  changeNickname,
  goLobby,
  roomWallpaper,
  setRoomWallpaper,
}) {
  const { closeKind, windows } = useWindows();
  const cameraOpen = windows.some((w) => w.kind === "camera" && !w.minimized);

  const toggleCameraWindow = () => {
    if (cameraOpen) closeKind("camera");
    else window.dispatchEvent(new CustomEvent("mz:open-window", { detail: "camera" }));
  };

  const renameUser = (targetSocketId, nickname) => {
    socket.emit("room:rename-user", { targetSocketId, nickname }, (res) => {
      if (!res?.ok) alert(res?.error || "Could not rename");
    });
  };

  const iHoldRemote = access?.holderId === mySocketId;

  return (
    <div className="room-viewport">
      <LiveWallpaper variant="room" overrideWallpaper={roomWallpaper} />
       <FloatingReactions /> {/* Add this line */}

      <RoomDesktop
        socket={socket}
        videoState={videoState}
        chatOpen={chatOpen}
        screenActive={screenActive}
        screenHostId={screenHostId}
        onToggleChat={() => setChatOpen((v) => !v)}
        onToggleFullscreen={toggleFullscreen}
      />

      {chatOpen && (
        <ChatPanel socket={socket} user={user} onClose={() => setChatOpen(false)} />
      )}

      <RoomPill
        roomName={room.name}
        camOn={cameraOpen}
        micOn={cameraOpen}
        isHost={isHost}
        holderAvatar={access?.holderAvatar}
        holderUsername={access?.holderUsername}
        iHoldRemote={iHoldRemote}
        onToggleCam={toggleCameraWindow}
        onToggleMic={toggleCameraWindow}
        onOpenRemote={onOpenRemote}
        onOpenSettings={() => setSettingsOpen((v) => !v)}
        onOpenProfile={() => setProfileOpen(true)}
        onBack={leaveRoom}
      />

      <UserBadges
        members={members}
        mySocketId={mySocketId}
        isHost={isHost}
        onRename={renameUser}
      />

      <SideRail
        user={user}
        rooms={createdRooms}
        onLogout={logout}
        onChangeNickname={changeNickname}
        onGoLobby={goLobby}
      />

      {settingsOpen && (
        <div className="room-settings" onClick={() => setSettingsOpen(false)}>
          <div className="room-settings-menu" onClick={(e) => e.stopPropagation()}>
            <button
              className="room-settings-item"
              onClick={() => { setSettingsOpen(false); setWallpaperOpen(true); }}
            >Change room wallpaper</button>
            <button
              className="room-settings-item"
              onClick={() => { setSettingsOpen(false); onOpenRemote(); }}
            >Remote control</button>
            <button
              className="room-settings-item"
              onClick={() => { setSettingsOpen(false); toggleFullscreen(); }}
            >Toggle fullscreen</button>
            <button
              className="room-settings-item danger"
              onClick={() => { setSettingsOpen(false); leaveRoom(); }}
            >Leave room</button>
          </div>
        </div>
      )}

      {profileOpen && (
        <EditRoomProfile
          room={room}
          canEdit={isHost}
          onSave={() => setProfileOpen(false)}
          onClose={() => setProfileOpen(false)}
        />
      )}

      <WallpaperPicker
        open={wallpaperOpen}
        onClose={() => setWallpaperOpen(false)}
        variant="room"
        onSaveOverride={setRoomWallpaper}
      />

      <RemoteRequestToast
        access={access}
        mySocketId={mySocketId}
        onApprove={onApprove}
        onDeny={onDeny}
        onOpenPanel={onOpenRemote}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Outer Room component — owns state, providers, and socket wiring    */
/* ------------------------------------------------------------------ */
export default function Room() {
  const nav = useNavigate();
  const { roomId } = useParams();
  const { socket, connected } = useSocket();
  const { user, state: authState, logout: authLogout } = useAuth();
  const sync = useRoomSync();
  const { isCompact } = useViewport();

  const [room, setRoom] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [members, setMembers] = useState([]);
  const [videoState, setVideoState] = useState({
    videoId: null, playing: false, timestamp: 0,
  });

  const [access, setAccess] = useState({
    holderId: null,
    holderUsername: null,
    holderAvatar: null,
    permitted: [],
    requests: [],
  });

  const [chatOpen, setChatOpen] = useState(
    typeof window !== "undefined" ? window.innerWidth >= 900 : true
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [wallpaperOpen, setWallpaperOpen] = useState(false);
  const [remoteOpen, setRemoteOpen] = useState(false);
  const [createdRooms, setCreatedRooms] = useState([]);

  const [screenActive, setScreenActive] = useState(false);
  const [screenHostId, setScreenHostId] = useState(null);

  const [pwPrompt, setPwPrompt] = useState(false);
  const [pwValue, setPwValue] = useState("");
  const [pwError, setPwError] = useState("");

  const mySocketId = socket?.id;

  const canControl = access.holderId != null && access.holderId === mySocketId;

  // Auto-collapse chat when viewport is narrow
  useEffect(() => { setChatOpen(!isCompact); }, [isCompact]);

  // Kick out if unauthenticated
  useEffect(() => {
  if (authState !== "unauthenticated") return;
  // Double-check with the server before kicking out
    fetch("/api/auth/me", { credentials: "include", cache: "no-store" })
    .then(r => r.json())
    .then(data => {
      if (!data?.user) nav("/login", { replace: true });
    })
    .catch(() => {
      // Network hiccup — don't redirect, let the socket retry
    });
  }, [authState, nav]);

  /* -------------------------------------------------------------- */
  /*  Join on mount                                                  */
  /* -------------------------------------------------------------- */
  useEffect(() => {
    if (!user) return;
    if (!socket || !connected) return;   // ← wait for the socket to actually connect
    if (room) return;

    let joined = false;
    const storedPw = sessionStorage.getItem(`mz_room_pw_${roomId}`) || "";

    const attempt = (password) => {
      socket.emit("room:join", { roomId, password }, (res) => {
        if (res?.ok) {
          joined = true;
          if (password) sessionStorage.setItem(`mz_room_pw_${roomId}`, password);
          setRoom(res.room);
          setIsHost(res.isOwner === true || res.role === "host");
          return;
        }
        if (res?.requiresPassword) {
          sessionStorage.removeItem(`mz_room_pw_${roomId}`);
          setPwPrompt(true);
          setPwValue("");
          setPwError(password ? "Incorrect password. Try again." : "");
          return;
        }
        alert(res?.error || "Failed to join room");
        nav("/lobby");
      });
    };
    attempt(storedPw);

    const onMembers = (m) => setMembers(m || []);
    const onVideo   = (v) => setVideoState(v || { videoId: null, playing: false, timestamp: 0 });
    const onKicked  = () => { alert("You were removed from this room."); nav("/lobby"); };
        const onRoomUpdated = (r) => {
      if (r?.id !== roomId) return;
      setRoom(r);
      setIsHost(r.ownerId && user?.id && r.ownerId === user.id);
    };
    const onScreenStarted = ({ hostSocketId }) => {
      setScreenActive(true);
      setScreenHostId(hostSocketId);
    };
    const onScreenStopped = () => {
      setScreenActive(false);
      setScreenHostId(null);
    };
    const onAccess = (state) => setAccess(state || {});

    socket.on("room:members", onMembers);
    socket.on("room:video-state", onVideo);
    socket.on("video:state-update", onVideo);
    socket.on("room:kicked", onKicked);
    socket.on("room:updated", onRoomUpdated);
    socket.on("screen:started", onScreenStarted);
    socket.on("screen:stopped", onScreenStopped);
    socket.on("access:state", onAccess);

    return () => {
      if (joined) socket.emit("room:leave");
      socket.off("room:members", onMembers);
      socket.off("room:video-state", onVideo);
      socket.off("video:state-update", onVideo);
      socket.off("room:kicked", onKicked);
      socket.off("room:updated", onRoomUpdated);
      socket.off("screen:started", onScreenStarted);
      socket.off("screen:stopped", onScreenStopped);
      socket.off("access:state", onAccess);
    };
        // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, connected, roomId, user]);

  /* -------------------------------------------------------------- */
  /*  Mirror RoomSync events into local state                       */
  /* -------------------------------------------------------------- */
  useEffect(() => {
    const offScreenStart = sync.subscribe("screen:started", ({ hostSocketId }) => {
      setScreenActive(true);
      setScreenHostId(hostSocketId);
    });
    const offScreenStop = sync.subscribe("screen:stopped", () => {
      setScreenActive(false);
      setScreenHostId(null);
    });
    const offYoutube = sync.subscribe("youtube.play", (p) => setVideoState(p));
    const offYoutubePause = sync.subscribe("youtube.pause", (p) => setVideoState(p));
    const offYoutubeSeek = sync.subscribe("youtube.seek", (p) => setVideoState(p));
    const offYoutubeLoad = sync.subscribe("youtube.load", (p) => setVideoState(p));

    return () => {
      offScreenStart();
      offScreenStop();
      offYoutube();
      offYoutubePause();
      offYoutubeSeek();
      offYoutubeLoad();
    };
  }, [sync]);

  /* -------------------------------------------------------------- */
  /*  Best-effort leave on tab close                                 */
  /* -------------------------------------------------------------- */
  useEffect(() => {
    if (!socket || !room) return;
    const tryLeave = () => { try { socket.emit("room:leave"); } catch {} };
    window.addEventListener("pagehide", tryLeave);
    window.addEventListener("beforeunload", tryLeave);
    return () => {
      window.removeEventListener("pagehide", tryLeave);
      window.removeEventListener("beforeunload", tryLeave);
    };
  }, [socket, room]);

  /* -------------------------------------------------------------- */
  /*  SideRail rooms list                                            */
  /* -------------------------------------------------------------- */
  useEffect(() => {
    if (!socket) return;
    const onList = (list) => setCreatedRooms(Array.isArray(list) ? list : []);
    socket.emit("lobby:list-rooms", { username: user?.username }, onList);
    socket.on("lobby:room-updated", onList);
    socket.on("lobby:room-removed", onList);
    return () => {
      socket.off("lobby:room-updated", onList);
      socket.off("lobby:room-removed", onList);
    };
  }, [socket, user?.username]);

  /* -------------------------------------------------------------- */
  /*  Remote control actions                                         */
  /* -------------------------------------------------------------- */
  const onPermit = (targetSocketId, allowed) => {
    socket.emit("access:permit", { targetSocketId, allowed }, (res) => {
      if (!res?.ok) alert(res?.error || "Could not change permission");
    });
  };
  const onRequestRemote = () => {
    socket.emit("access:request-remote", (res) => {
      if (!res?.ok) alert(res?.error || "Could not request");
    });
  };
  const onApprove = (targetSocketId) => {
    socket.emit("access:approve-request", { targetSocketId }, (res) => {
      if (!res?.ok) alert(res?.error || "Could not approve");
    });
  };
  const onDeny = (targetSocketId) => {
    socket.emit("access:deny-request", { targetSocketId }, (res) => {
      if (!res?.ok) alert(res?.error || "Could not deny");
    });
  };
  const onForceHolder = (targetSocketId) => {
    socket.emit("access:force-holder", { targetSocketId }, (res) => {
      if (!res?.ok) alert(res?.error || "Could not transfer");
    });
  };
  const onReleaseRemote = () => {
    socket.emit("access:release-remote", (res) => {
      if (!res?.ok) alert(res?.error || "Could not release");
    });
  };

  /* -------------------------------------------------------------- */
  /*  Navigation actions                                             */
  /* -------------------------------------------------------------- */
  const leaveRoom = () => {
    socket.emit("room:leave");
    nav("/lobby");
  };

  const toggleFullscreen = () => {
    const el = document.documentElement;
    if (!document.fullscreenElement) el.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  const logout = async () => {
    try { socket.emit("room:leave"); } catch {}
    await authLogout();
    nav("/login", { replace: true });
  };

  const goLobby = () => {
    socket.emit("room:leave");
    nav("/lobby");
  };

  const changeNickname = (name) => {
    const clean = String(name || "").trim();
    if (!clean) return;
    socket.emit("room:rename-user", { targetSocketId: socket.id, nickname: clean }, (res) => {
      if (!res?.ok) {
        alert(res?.error || "Could not rename");
      }
    });
  };

  const submitRoomPassword = () => {
    const pwd = pwValue.trim();
    if (!pwd || !socket) return;
    socket.emit("room:join", { roomId, password: pwd }, (res) => {
      if (res?.ok) {
        sessionStorage.setItem(`mz_room_pw_${roomId}`, pwd);
        setRoom(res.room);
        setIsHost(res.isOwner === true || res.role === "host");
        setPwPrompt(false);
        setPwValue("");
        setPwError("");
      } else {
        setPwError(res?.error || "Incorrect password");
      }
    });
  };

  /* -------------------------------------------------------------- */
  /*  Room wallpaper sync (uses the centralized sync engine)         */
  /* -------------------------------------------------------------- */
  const roomWallpaper = sync.state.wallpaper;
  const setRoomWallpaper = (next) => {
    sync.send("wallpaper.change", { wallpaper: next });
  };

  /* -------------------------------------------------------------- */
  /*  Loading + password gate                                        */
  /* -------------------------------------------------------------- */
  if (pwPrompt && !room) {
    return (
      <div className="room-viewport">
        <LiveWallpaper variant="room" overrideWallpaper={roomWallpaper} />
        <div className="pw-overlay" onClick={() => nav("/lobby")}>
          <div className="pw-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="pw-title">🔒 Private Room</h3>
            <p className="pw-sub">
              This room is password-protected. Enter the password to enter.
            </p>
            <input
              className="pw-input"
              type="password"
              autoFocus
              placeholder="Room password"
              value={pwValue}
              onChange={(e) => { setPwValue(e.target.value); if (pwError) setPwError(""); }}
              onKeyDown={(e) => e.key === "Enter" && submitRoomPassword()}
            />
            {pwError && <div className="pw-error">{pwError}</div>}
            <div className="pw-actions">
              <button className="pw-btn ghost" onClick={() => nav("/lobby")}>Cancel</button>
              <button
                className="pw-btn primary"
                onClick={submitRoomPassword}
                disabled={!pwValue.trim()}
              >Enter</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="room-viewport">
        <div className="dot-collision" />
      </div>
    );
  }

  /* -------------------------------------------------------------- */
  /*  Render                                                         */
  /* -------------------------------------------------------------- */
  return (
    <WindowManagerProvider
      socket={socket}
      roomId={roomId}
      canControl={canControl}
    >
      <RoomContent
        socket={socket}
        user={user}
        room={room}
        isHost={isHost}
        access={access}
        mySocketId={mySocketId}
        onApprove={onApprove}
        onDeny={onDeny}
        onOpenRemote={() => setRemoteOpen(true)}
        members={members}
        videoState={videoState}
        chatOpen={chatOpen}
        setChatOpen={setChatOpen}
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        profileOpen={profileOpen}
        setProfileOpen={setProfileOpen}
        wallpaperOpen={wallpaperOpen}
        setWallpaperOpen={setWallpaperOpen}
        createdRooms={createdRooms}
        screenActive={screenActive}
        screenHostId={screenHostId}
        leaveRoom={leaveRoom}
        toggleFullscreen={toggleFullscreen}
        logout={logout}
        changeNickname={changeNickname}
        goLobby={goLobby}
        roomWallpaper={roomWallpaper}
        setRoomWallpaper={setRoomWallpaper}
      />

      <RemotePanel
        open={remoteOpen}
        onClose={() => setRemoteOpen(false)}
        mySocketId={mySocketId}
        isHost={isHost}
        members={members}
        access={access}
        onPermit={onPermit}
        onRequestRemote={onRequestRemote}
        onApprove={onApprove}
        onDeny={onDeny}
        onForceHolder={onForceHolder}
        onReleaseRemote={onReleaseRemote}
      />
    </WindowManagerProvider>
  );
}