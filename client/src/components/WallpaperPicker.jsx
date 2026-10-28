import { useEffect, useState } from "react";
import { useWallpaper } from "../context/WallpaperContext.jsx";

const PRESETS = [
  { id: "particles", label: "Particles", swatch: "linear-gradient(135deg,#4a2f8a,#7c5cff)" },
  { id: "aurora",    label: "Aurora",    swatch: "linear-gradient(135deg,#0a2a5c,#7c5cff,#c74a9c)" },
  { id: "stars",     label: "Stars",     swatch: "linear-gradient(135deg,#05060a,#1a2350)" },
  { id: "none",      label: "None",      swatch: "linear-gradient(135deg,#1a1a1a,#2a2a2a)" },
];

/**
 * @param {"lobby" | "room"} variant — which wallpaper slot to edit
 */
export default function WallpaperPicker({ open, onClose, variant = "lobby" }) {
  const { wallpaper, setWallpaper } = useWallpaper(variant);
  const [draft, setDraft] = useState(wallpaper);

  // Sync when reopened (or when variant switches)
  useEffect(() => {
    if (open) setDraft(wallpaper);
  }, [open, wallpaper, variant]);

  if (!open) return null;

  const apply = () => {
    setWallpaper(draft);
    onClose();
  };

  const setPreset = (id) => setDraft({ type: id, url: "" });

  const setUrl = (url) => setDraft({ type: "video", url });

  const title = variant === "room" ? "Room Wallpaper" : "Lobby Wallpaper";

  return (
    <div className="wp-overlay" onClick={onClose}>
      <div className="wp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wp-header">
          <h2>{title}</h2>
          <button className="wp-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="wp-body">
          <div className="wp-section">
            <div className="wp-label">Presets</div>
            <div className="wp-grid">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  className={`wp-tile ${draft.type === p.id ? "active" : ""}`}
                  onClick={() => setPreset(p.id)}
                >
                  <div className="wp-swatch" style={{ background: p.swatch }} />
                  <div className="wp-tile-label">{p.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="wp-section">
            <div className="wp-label">Live from web</div>
            <input
              className="wp-input"
              placeholder="Paste image URL, .mp4 / .webm URL, or YouTube link"
              value={draft.type === "video" || draft.type === "image" ? draft.url : ""}
              onChange={(e) => setUrl(e.target.value)}
              onFocus={() => {
                if (draft.type !== "video" && draft.type !== "image") {
                  setDraft({ type: "video", url: "" });
                }
              }}
            />
            <div className="wp-hint">
              • Image: <code>https://…/pic.jpg</code> (or .gif for animation)<br />
              • Video: <code>https://…/clip.mp4</code> or <code>.webm</code><br />
              • YouTube: <code>https://www.youtube.com/watch?v=…</code> (plays muted, loops)
            </div>

            {draft.url && (
              <div className="wp-preview">
                {/youtube\.com|youtu\.be/i.test(draft.url) ? (
                  <div className="wp-preview-note">
                    YouTube background will load when you save.
                  </div>
                ) : (
                  <div className="wp-preview-note">
                    Saving will set this as your wallpaper. Preview happens on the real page.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="wp-footer">
          <button className="wp-btn ghost" onClick={onClose}>Cancel</button>
          <button className="wp-btn primary" onClick={apply}>Save</button>
        </div>
      </div>
    </div>
  );
}