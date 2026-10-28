import { useEffect, useMemo, useState } from "react";
import YouTubePlayer from "./YouTubePlayer.jsx";

export default function YouTubeWindow({ socket, canControl, videoState }) {
  const [input, setInput] = useState("");
  const [localState, setLocalState] = useState(null);

  const effectiveState = useMemo(
    () => localState || videoState,
    [localState, videoState]
  );

  useEffect(() => {
    if (localState && videoState?.videoId === localState.videoId) {
      setLocalState(null);
    }
  }, [videoState, localState]);

  const submit = () => {
    if (!canControl) return;
    const match = input.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
    const id = match ? match[1] : input.trim();
    if (id.length !== 11) return alert("Invalid YouTube URL or ID");
    const next = { videoId: id, playing: true, timestamp: 0 };
    setLocalState(next);
    socket.emit("video:state-change", next);
    setInput("");
  };

  return (
    <div className="dw-youtube">
      {canControl && (
        <div className="dw-yt-bar">
          <input
            className="dw-yt-input"
            placeholder="Paste a YouTube URL or 11-char video ID"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <button className="dw-yt-btn" onClick={submit}>▶ Play</button>
        </div>
      )}

      <div className="dw-yt-stage">
        {effectiveState?.videoId ? (
          <YouTubePlayer
            socket={socket}
            isHost={canControl}
            videoState={effectiveState}
          />
        ) : (
          <div className="dw-placeholder">
            {canControl
              ? "Paste a YouTube link above to start watching."
              : "Waiting for the remote holder to start a video…"}
          </div>
        )}
      </div>
    </div>
  );
}