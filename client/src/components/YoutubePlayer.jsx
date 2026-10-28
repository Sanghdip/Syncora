import { useEffect, useRef } from "react";
import YouTube from "react-youtube";

const SEEK_THRESHOLD = 0.7;
const RATE_THRESHOLD = 0.2;
const SYNC_INTERVAL = 500;
const HEARTBEAT = 1500;
const RATE_NUDGE = 0.05;

export default function YouTubePlayer({ socket, isHost, videoState }) {
  const playerRef = useRef(null);
  const loadedIdRef = useRef(null);
  const serverOffsetRef = useRef(0);
  const targetRef = useRef({ time: 0, playing: false, setAtServer: 0 });
  const rateTimerRef = useRef(null);

  useEffect(() => {
    if (!socket) return;
    let cancelled = false;
    const samples = [];

    const ping = () =>
      new Promise((resolve) => {
        const t0 = Date.now();
        socket.emit("time:ping", t0, (res) => {
          if (!res?.serverTime) return resolve(null);
          const t1 = Date.now();
          const rtt = t1 - t0;
          resolve(res.serverTime - (t0 + rtt / 2));
        });
      });

    (async () => {
      for (let i = 0; i < 4; i++) {
        if (cancelled) return;
        try {
          const off = await ping();
          if (off != null) samples.push(off);
        } catch {}
        await new Promise((r) => setTimeout(r, 80));
      }
      if (cancelled || !samples.length) return;
      samples.sort((a, b) => a - b);
      serverOffsetRef.current = samples[Math.floor(samples.length / 2)];
    })();

    return () => { cancelled = true; };
  }, [socket]);

  useEffect(() => {
    if (!videoState?.videoId) return;
    targetRef.current = {
      time: Number(videoState.timestamp) || 0,
      playing: !!videoState.playing,
      setAtServer: videoState.updatedAt || (Date.now() + serverOffsetRef.current),
    };
  }, [videoState]);

  useEffect(() => {
    const p = playerRef.current;
    if (!p || !videoState?.videoId) return;
    if (loadedIdRef.current === videoState.videoId) return;

    loadedIdRef.current = videoState.videoId;
    const args = {
      videoId: videoState.videoId,
      startSeconds: videoState.timestamp || 0,
    };
    try {
      if (videoState.playing) p.loadVideoById(args);
      else p.cueVideoById(args);
    } catch (e) {
      console.warn("[yt] load failed", e);
    }
  }, [videoState]);

  const syncOnce = () => {
    const p = playerRef.current;
    if (!p) return;
    const tgt = targetRef.current;
    if (!tgt.playing && !tgt.time) return;

    const nowServer = Date.now() + serverOffsetRef.current;
    const elapsed = Math.max(0, (nowServer - tgt.setAtServer) / 1000);
    const target = tgt.time + elapsed;

    try {
      const pState = p.getPlayerState?.();
      if (!tgt.playing) {
        if (pState === 1) p.pauseVideo?.();
        const cur = p.getCurrentTime?.() ?? 0;
        if (Math.abs(cur - target) > SEEK_THRESHOLD) p.seekTo(target, true);
        return;
      }
      if (pState !== 1) p.playVideo?.();
      const cur = p.getCurrentTime?.() ?? 0;
      const drift = cur - target;
      const abs = Math.abs(drift);
      if (abs > SEEK_THRESHOLD) {
        p.seekTo(target, true);
        p.setPlaybackRate?.(1);
      } else if (abs > RATE_THRESHOLD) {
        const rate = drift > 0 ? 1 - RATE_NUDGE : 1 + RATE_NUDGE;
        p.setPlaybackRate?.(rate);
        if (rateTimerRef.current) clearTimeout(rateTimerRef.current);
        rateTimerRef.current = setTimeout(() => {
          try { p.setPlaybackRate?.(1); } catch {}
        }, 2200);
      } else {
        p.setPlaybackRate?.(1);
      }
    } catch {}
  };

  useEffect(() => {
    if (isHost) return;
    const id = setInterval(syncOnce, SYNC_INTERVAL);
    return () => {
      clearInterval(id);
      if (rateTimerRef.current) clearTimeout(rateTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost]);

  useEffect(() => {
    if (!isHost) return;
    const id = setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      if (p.getPlayerState?.() !== 1) return;
      socket.emit("video:state-change", {
        videoId: videoState.videoId,
        playing: true,
        timestamp: p.getCurrentTime?.() ?? 0,
      });
    }, HEARTBEAT);
    return () => clearInterval(id);
  }, [isHost, socket, videoState.videoId]);

  const emitState = (playing) => {
    const p = playerRef.current;
    if (!p) return;
    socket.emit("video:state-change", {
      videoId: videoState.videoId,
      playing,
      timestamp: p.getCurrentTime?.() ?? 0,
    });
  };

  const opts = {
    height: "100%",
    width: "100%",
    playerVars: {
      autoplay: 0,
      controls: isHost ? 1 : 0,
      disablekb: isHost ? 0 : 1,
      modestbranding: 1,
      rel: 0,
      playsinline: 1,
      origin: window.location.origin,
    },
  };

  const handleReady = (e) => {
    playerRef.current = e.target;
    loadedIdRef.current = videoState.videoId;
  };

  return (
    <div className="yt-root">
      <div className="yt-frame">
        <YouTube
          videoId={videoState.videoId}
          opts={opts}
          onReady={handleReady}
          onPlay={() => isHost && emitState(true)}
          onPause={() => isHost && emitState(false)}
          onEnd={() => isHost && emitState(false)}
          className="yt-iframe"
          iframeClassName="yt-iframe-el"
        />
      </div>
      {!isHost && (
        <div className="yt-footer">
          🔒 Only the remote holder controls playback.
        </div>
      )}
    </div>
  );
}