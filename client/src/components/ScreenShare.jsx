import { useEffect, useRef, useState } from "react";
import { ICE_SERVERS } from "../hooks/useWebRTC.js";

export default function ScreenShare({
  socket,
  canControl,
  screenActive,
  hostSocketId,
}) {
  const [sharing, setSharing] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);
  const [status, setStatus] = useState("idle");

  const localStreamRef   = useRef(null);
  const localPreviewRef  = useRef(null);
  const remoteVideoRef   = useRef(null);
  const peersRef         = useRef({});
  const pendingCands     = useRef({});
  const sharingRef       = useRef(false);

  const log = (...args) => console.log("[screen]", ...args);

  useEffect(() => {
    if (sharing && localPreviewRef.current && localStreamRef.current) {
      localPreviewRef.current.srcObject = localStreamRef.current;
    }
  }, [sharing]);

  useEffect(() => {
    const v = remoteVideoRef.current;
    if (!v) return;
    if (remoteStream) {
      v.srcObject = remoteStream;
      v.play?.().catch(() => {});
    } else {
      v.srcObject = null;
    }
  }, [remoteStream]);

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

  const teardownLocal = () => {
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    Object.values(peersRef.current).forEach((pc) => {
      try { pc.close(); } catch {}
    });
    peersRef.current = {};
    pendingCands.current = {};
    if (localPreviewRef.current) localPreviewRef.current.srcObject = null;
  };

  const start = async () => {
    if (!canControl || screenActive || sharingRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
      });

      teardownLocal();
      localStreamRef.current = stream;
      stream.getVideoTracks()[0].onended = () => stop();

      sharingRef.current = true;
      setSharing(true);
      socket.emit("screen:host-start");
      log("host started sharing");
    } catch (err) {
      console.warn("Screen share cancelled", err);
    }
  };

  const stop = () => {
    log("host stopping share");
    sharingRef.current = false;
    teardownLocal();
    setSharing(false);
    socket.emit("screen:host-stop");
  };

  const createOfferFor = async (viewerSocketId) => {
    if (!localStreamRef.current) return;

    // Skip if a live pc already exists for this viewer
    const existing = peersRef.current[viewerSocketId];
    if (existing && !["failed", "closed", "disconnected"].includes(existing.connectionState)) {
      log("host: skipping createOfferFor, pc already exists for", viewerSocketId, existing.connectionState);
      return;
    }

    if (existing) {
      try { existing.close(); } catch {}
      delete peersRef.current[viewerSocketId];
      pendingCands.current[viewerSocketId] = [];
    }

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
          streamKind: "screen",
        });
      }
    };
    pc.onconnectionstatechange = () => {
      log("host pc state →", pc.connectionState, "for", viewerSocketId);
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
        delete peersRef.current[viewerSocketId];
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    log("host sending offer to", viewerSocketId);
    socket.emit("webrtc:signal", {
      to: viewerSocketId,
      signal: { sdp: offer },
      streamKind: "screen",
    });
  };

  useEffect(() => {
    if (!socket) return;
    log("screen listeners registered");

    const onNewViewer = ({ viewerSocketId, kind }) => {
      if (kind !== "screen") return;
      if (!sharingRef.current) return;
      log("host received new-viewer, creating offer for", viewerSocketId);
      createOfferFor(viewerSocketId);
    };

    const onSignal = async ({ from, signal, streamKind }) => {
      if (streamKind !== "screen") return;

      // ---- Host path ----
      if (sharingRef.current) {
        if (signal?.sdp?.type === "answer") {
          const pc = peersRef.current[from];
          if (!pc) return;
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          await flushCandidates(from);
          return;
        }
        if (signal?.candidate) {
          await applyCandidate(from, signal.candidate);
          return;
        }
        if (signal?.type === "screen-viewer-request") {
          createOfferFor(from);
          return;
        }
        return;
      }

      // ---- Viewer path ----
      if (signal?.sdp?.type === "offer") {
        // Skip if a live pc already exists (ignore duplicate offers)
        const existingPc = peersRef.current[from];
        if (existingPc && !["failed", "closed", "disconnected"].includes(existingPc.connectionState)) {
          log("viewer: ignoring duplicate offer, pc state =", existingPc.connectionState);
          return;
        }

        if (existingPc) {
          try { existingPc.close(); } catch {}
          delete peersRef.current[from];
        }
        pendingCands.current[from] = [];

        const pc = new RTCPeerConnection(ICE_SERVERS);
        peersRef.current[from] = pc;

        pc.ontrack = (e) => {
          log("viewer got track", { kind: e.track.kind });
          if (e.track.kind !== "video") return;
          const [stream] = e.streams;
          if (stream) {
            setRemoteStream(stream);
            setStatus("connected");

            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
              videoTrack.onended = () => {
                setRemoteStream(null);
                setStatus("idle");
                if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
              };
            }
          }
        };
        pc.onicecandidate = (e) => {
          if (e.candidate) {
            socket.emit("webrtc:signal", {
              to: from,
              signal: { candidate: e.candidate },
              streamKind: "screen",
            });
          }
        };
        pc.onconnectionstatechange = () => {
          log("viewer pc state →", pc.connectionState, "from", from);
          if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
            setRemoteStream(null);
            setStatus("idle");
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
            delete peersRef.current[from];
          }
        };

        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        await flushCandidates(from);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        log("viewer sending answer to", from);
        socket.emit("webrtc:signal", {
          to: from,
          signal: { sdp: answer },
          streamKind: "screen",
        });
        return;
      }

      if (signal?.candidate) {
        await applyCandidate(from, signal.candidate);
      }
    };

    socket.on("webrtc:new-viewer", onNewViewer);
    socket.on("webrtc:signal", onSignal);

    return () => {
      log("screen listeners unregistered");
      socket.off("webrtc:new-viewer", onNewViewer);
      socket.off("webrtc:signal", onSignal);
    };
  }, [socket]);

  // ---- Viewer retry loop ----
  useEffect(() => {
    if (sharing) return;
    if (!screenActive || !hostSocketId) {
      setRemoteStream(null);
      setStatus("idle");
      const pc = peersRef.current[hostSocketId];
      if (pc) {
        try { pc.close(); } catch {}
        delete peersRef.current[hostSocketId];
        delete pendingCands.current[hostSocketId];
      }
      return;
    }

    setStatus("requesting");
    let attempts = 0;
    let stopped = false;

    const request = () => {
      if (stopped) return;
      attempts++;
      log("viewer → screen-viewer-request attempt", attempts);
      socket.emit("webrtc:signal", {
        to: hostSocketId,
        signal: { type: "screen-viewer-request" },
        streamKind: "screen",
      });
    };

    request();
    const iv = setInterval(() => {
      if (stopped) { clearInterval(iv); return; }
      const pc = peersRef.current[hostSocketId];
      // Stop retrying as soon as we have a pc for this host
      if (pc) { clearInterval(iv); return; }
      if (attempts >= 15) { clearInterval(iv); setStatus("failed"); return; }
      request();
    }, 1000);

    return () => { stopped = true; clearInterval(iv); };
  }, [sharing, screenActive, hostSocketId, socket]);

  useEffect(() => {
    return () => {
      teardownLocal();
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    };
  }, []);

  const amSharing = sharing;
  const someoneElseIsSharing = !sharing && screenActive;

  return (
    <div className="ss-root">
      <div className="ss-toolbar">
        <span className="ss-title">🖥️ Screen Share</span>
        {canControl && !amSharing && !screenActive && (
          <button className="ss-btn primary" onClick={start}>▶ Share</button>
        )}
        {amSharing && (
          <button className="ss-btn danger" onClick={stop}>⏹ Stop</button>
        )}
        {!canControl && !amSharing && screenActive && (
          <span className="ss-live">● Live</span>
        )}
        {!canControl && !amSharing && !screenActive && (
          <span className="ss-wait">Waiting…</span>
        )}
        {canControl && !amSharing && screenActive && (
          <span className="ss-live">● Someone is sharing</span>
        )}
      </div>
      <div className="ss-body">
        {amSharing && (
          <video ref={localPreviewRef} autoPlay muted playsInline className="ss-video" />
        )}
        {someoneElseIsSharing && remoteStream && (
          <video ref={remoteVideoRef} autoPlay playsInline className="ss-video" />
        )}
        {!amSharing && !remoteStream && (
          <div className="ss-placeholder">
            {canControl
              ? "Click ▶ Share to broadcast your screen to the room."
              : screenActive
                ? "Connecting to remote screen…"
                : "Waiting for the remote holder to start screen sharing…"}
          </div>
        )}
      </div>
    </div>
  );
}