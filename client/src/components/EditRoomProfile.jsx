import { useEffect, useRef, useState } from "react";

const MAX_THUMB_BYTES = 250 * 1024; // 250 KB — socket.io friendly

export default function EditRoomProfile({ room, onSave, onClose, canEdit }) {
  const [name, setName] = useState(room?.name || "");
  const [description, setDescription] = useState(room?.description || "");
  const [thumbnail, setThumbnail] = useState(room?.thumbnail || "");
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  // Sync if room changes while open
  useEffect(() => {
    setName(room?.name || "");
    setDescription(room?.description || "");
    setThumbnail(room?.thumbnail || "");
    setError("");
  }, [room?.id]);

  const pickImage = () => {
    if (!canEdit) return;
    fileRef.current?.click();
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file");
      return;
    }
    if (file.size > MAX_THUMB_BYTES) {
      setError("Image is too large — keep it under 250 KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setThumbnail(reader.result);
      setError("");
    };
    reader.readAsDataURL(file);
  };

  const save = () => {
    const n = name.trim();
    if (!n) return setError("Room name is required");
    if (n.length > 30) return setError("Room name must be 30 characters or fewer");
    if (description.length > 150) return setError("Description must be 150 characters or fewer");
    onSave({ name: n, description: description.trim(), thumbnail });
  };

  return (
    <div className="ep-overlay" onClick={onClose}>
      <div className="ep-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ep-header">
          <h2>Edit Room Profile</h2>
          <button className="ep-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="ep-body">
          {/* Left: form */}
          <div className="ep-form">
            <label className="ep-label">ROOM NAME</label>
            <input
              className="ep-input"
              value={name}
              maxLength={30}
              disabled={!canEdit}
              onChange={(e) => { setName(e.target.value); if (error) setError(""); }}
              placeholder="Room name"
            />

            <label className="ep-label">ROOM DESCRIPTION</label>
            <textarea
              className="ep-textarea"
              value={description}
              maxLength={150}
              disabled={!canEdit}
              onChange={(e) => { setDescription(e.target.value); if (error) setError(""); }}
              placeholder="What's this room about?"
              rows={5}
            />

            {error && <div className="ep-error">{error}</div>}

            {canEdit && (
              <button className="ep-save" onClick={save}>Save</button>
            )}
            {!canEdit && (
              <div className="ep-readonly">Only the host can edit this room.</div>
            )}
          </div>

          {/* Right: circular image */}
          <div className="ep-image-col">
            <button
              type="button"
              className={`ep-image-btn ${canEdit ? "clickable" : ""}`}
              onClick={pickImage}
              title={canEdit ? "Click to change" : "Read only"}
            >
              <img
                src={thumbnail || `https://picsum.photos/seed/${room?.id}/400/400`}
                alt="Room"
                className="ep-image"
              />
            </button>
            {canEdit && (
              <div className="ep-image-hint" onClick={pickImage}>
                Click the image to change
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={onFile}
            />
          </div>
        </div>
      </div>
    </div>
  );
}