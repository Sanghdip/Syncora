import { useState } from "react";

export default function JoinByCode({ onJoin }) {
  const [code, setCode] = useState("");

  const submit = () => {
    const c = code.trim();
    if (!c) return;
    onJoin(c);
    setCode("");
  };

  return (
    <div className="join-code-bar">
      <input
        className="join-code-input"
        placeholder="Enter room code to join…"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        maxLength={40}
      />
      <button className="join-code-btn" onClick={submit}>Join</button>
    </div>
  );
}