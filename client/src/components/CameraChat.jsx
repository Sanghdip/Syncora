import { useEffect, useRef, useState } from "react";
import { ICE_SERVERS } from "../hooks/useWebRTC.js";

/**
 * Google-Meet-style mesh camera.
 * Every user with camera on broadcasts to every other user.
 * Auto-grid tiles based on participant count.
 */

// ---- Auto-grid helper ----
function gridCols(count) {
  if (count <= 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 2;
  if (count <= 6) return 3;
  if (count <= 9) return 3;
  if (count <= 12) return 4;
  return Math.ceil(Math.sqrt(count));
}

export default function CameraChat({ socket }) {
  const [enabled, setEnabled] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState({}); // socketId -> { stream, user }
  const [micOn, setMicOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);

  const localVideoRef  = useRef(null);
  const localStreamRef = useRef(null);
  const peersRef       = useRef({});       // socketId -> RTCPeerConnection
  const pendingCands   = useRef({});       // socketId -> RTCIceCandidateInit[]
  const userMapRef     = useRef({});       // socketId -> user

  // ---- Attach local stream to its <video> once enabled ----
  useEffect(() => {
    if (enabled && localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [enabled]);

  // ---- ICE queue helpers ----
  const applyCandidate = async (socketId, candidate) => {
    const pc = peersRef.current[socketId];
    if (!pc || !pc.remoteDescription) {
      if (!pendingCands.current[socketId]) pendingCands.current[socketId] = [];
      pendingCands.current[socketId].push(candidate);
      return;
    }
    try { await pc.addIceCandidate(candidate); } catch {}
  };

  const flushCandidates = async (socketId) => {
    const pc = peersRef.current[socketId];
    if (!pc) return;
    const list = pendingCands.current[socketId] || [];
    pendingCands.current[socketId] = [];
    for (const c of list) {
      try { await pc.addIceCandidate(c); } catch {}
    }
  };

  // ---- Create an offer for a viewer (we are the sharer) ----
  const createOfferFor = async (viewerSocketId) => {
    if (!localStreamRef.current) return;
    if (peersRef.current[viewerSocketId]) return; // already have a peer

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peersRef.current[viewerSocketId] = pc;

    localStreamRef.current.getTracks().forEach((t) =>
      pc.addTrack(t, localStreamRef.current)
    );

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("webrtc:signal", {
          to: viewerSocketId,
          signal: { candidate: e.candidate },
          streamKind: "camera",
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("[cam] sharer→", viewerSocketId, pc.connectionState);
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
        delete peersRef.current[viewerSocketId];
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("webrtc:signal", {
      to: viewerSocketId,
      signal: { sdp: offer },
      streamKind: "camera",
    });
  };

  // ---- Ask a sharer for their stream (we are the viewer) ----
  const requestStream = (sharerSocketId) => {
    if (peersRef.current[sharerSocketId]) return;
    socket.emit("webrtc:signal", {
      to: sharerSocketId,
      signal: { type: "camera-request" },
      streamKind: "camera",
    });
  };

  // ---- Main signaling effect ----
  useEffect(() => {
    if (!socket) return;

    // Someone turned their camera on → ask them for the stream
    const onLive = ({ socketId, user }) => {
      if (user) userMapRef.current[socketId] = user;
      requestStream(socketId);
    };

    // Someone turned off
    const onOff = ({ socketId }) => {
      peersRef.current[socketId]?.close();
      delete peersRef.current[socketId];
      delete pendingCands.current[socketId];
      setRemoteStreams((prev) => {
        const copy = { ...prev };
        delete copy[socketId];
        return copy;
      });
    };

    // Server tells us who's already live (on join / after enabling)
    const onActive = ({ socketIds }) => {
      (socketIds || []).forEach((id) => requestStream(id));
    };

    // A viewer asked us for our stream → send offer
    const onNewViewer = ({ viewerSocketId, viewerUser, kind }) => {
      if (kind !== "camera" || !localStreamRef.current) return;
      if (viewerUser) userMapRef.current[viewerSocketId] = viewerUser;
      createOfferFor(viewerSocketId);
    };

    // Offers / answers / ICE
    const onSignal = async ({ from, fromUser, signal, streamKind }) => {
      if (streamKind && streamKind !== "camera") return;
      if (fromUser) userMapRef.current[from] = fromUser;

      // ---- Offer → we're the viewer, build PC ----
      if (signal?.sdp?.type === "offer") {
        peersRef.current[from]?.close();
        pendingCands.current[from] = [];

        const pc = new RTCPeerConnection(ICE_SERVERS);
        peersRef.current[from] = pc;

        pc.ontrack = (e) => {
          const [stream] = e.streams;
          if (!stream) return;
          setRemoteStreams((prev) => ({
            ...prev,
            [from]: { stream, user: userMapRef.current[from] },
          }));
        };

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            socket.emit("webrtc:signal", {
              to: from,
              signal: { candidate: e.candidate },
              streamKind: "camera",
            });
          }
        };

        pc.onconnectionstatechange = () => {
          console.log("[cam] viewer←", from, pc.connectionState);
          if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
            setRemoteStreams((prev) => {
              const copy = { ...prev };
              delete copy[from];
              return copy;
            });
            delete peersRef.current[from];
          }
        };

        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        await flushCandidates(from);

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("webrtc:signal", {
          to: from,
          signal: { sdp: answer },
          streamKind: "camera",
        });
        return;
      }

      // ---- Answer → we're the sharer ----
      if (signal?.sdp?.type === "answer") {
        const pc = peersRef.current[from];
        if (!pc) return;
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        await flushCandidates(from);
        return;
      }

      // ---- ICE ----
      if (signal?.candidate) {
        await applyCandidate(from, signal.candidate);
      }
    };

    socket.on("camera:live", onLive);
    socket.on("camera:off", onOff);
    socket.on("camera:active", onActive);
    socket.on("webrtc:new-viewer", onNewViewer);
    socket.on("webrtc:signal", onSignal);

    return () => {
      socket.off("camera:live", onLive);
      socket.off("camera:off", onOff);
      socket.off("camera:active", onActive);
      socket.off("webrtc:new-viewer", onNewViewer);
      socket.off("webrtc:signal", onSignal);
    };
  }, [socket]);

  // ---- Start / Stop ----
  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      });

      localStreamRef.current = stream;
      setMicOn(true);
      setVideoOn(true);
      setEnabled(true);

      // Announce to the room. Server will tell us who's already live.
      socket.emit("camera:enable");
    } catch (err) {
      console.warn(err);
      alert("Camera/mic permission denied or unavailable.");
    }
  };

  const stop = () => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;

    Object.values(peersRef.current).forEach((pc) => pc.close());
    peersRef.current = {};
    pendingCands.current = {};

    setEnabled(false);
    setRemoteStreams({});

    socket.emit("camera:disable");
  };

  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMicOn(track.enabled);
  };

  const toggleVideo = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setVideoOn(track.enabled);
  };

  // Cleanup on unmount
  useEffect(() => () => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    Object.values(peersRef.current).forEach((pc) => pc.close());
  }, []);

  // ---- Grid ----
  const remoteList = Object.entries(remoteStreams);
  const tileCount = (enabled ? 1 : 0) + remoteList.length;
  const cols = gridCols(tileCount);

  return (
    <div className="cc-root">
      <div className="cc-toolbar">
        <span className="cc-title">📹 Camera</span>

        {!enabled ? (
          <button className="cc-btn primary" onClick={start}>
            ▶ Join
          </button>
        ) : (
          <>
            <button
              className={`cc-btn ${micOn ? "" : "danger"}`}
              onClick={toggleMic}
              title={micOn ? "Mute mic" : "Unmute mic"}
            >
              {micOn ? "🎤" : "🔇"}
            </button>
            <button
              className={`cc-btn ${videoOn ? "" : "danger"}`}
              onClick={toggleVideo}
              title={videoOn ? "Hide camera" : "Show camera"}
            >
              {videoOn ? "📹" : "🚫"}
            </button>
            <button className="cc-btn danger" onClick={stop} title="Leave camera">
              ✕ Leave
            </button>
          </>
        )}
      </div>

      <div className="cc-body">
        {tileCount === 0 ? (
          <div className="cc-placeholder">
            Click ▶ Join to turn on your camera.
            <br />
            <span className="cc-muted">
              Everyone in the room will see each other.
            </span>
          </div>
        ) : (
          <div
            className="cc-grid"
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
          >
            {enabled && (
              <div className="cc-tile">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="cc-video"
                  style={{ transform: "scaleX(-1)" }}
                />
                <div className="cc-label">
                  You {micOn ? "🎤" : "🔇"}
                </div>
              </div>
            )}

            {remoteList.map(([socketId, info]) => (
              <div key={socketId} className="cc-tile">
                <video
                  ref={(el) => {
                    if (el && info.stream) el.srcObject = info.stream;
                  }}
                  autoPlay
                  playsInline
                  className="cc-video"
                />
                <div className="cc-label">
                  {info.user?.nickname || info.user?.username || "User"}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}