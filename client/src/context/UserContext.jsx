// WebRTC helpers are in ScreenShare.jsx and CameraChat.jsx.
// Extract shared logic here later.

export const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" }
  ]
};

export default function useWebRTC() {}