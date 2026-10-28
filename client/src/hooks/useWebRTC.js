// WebRTC ICE configuration.
// STUN discovers public IPs. TURN relays traffic when direct P2P fails
// (symmetric NAT, corporate firewalls, CGNAT, etc).
// A working TURN server is REQUIRED for reliable screen sharing.

export const ICE_SERVERS = {
  iceServers: [
    // Google STUN servers
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },

    // TURN server — replace these with your own credentials.
    // The public ones are unreliable; you need a real TURN server
    // for screen share to work like Mzelo's.
    {
      urls: "turn:YOUR_TURN_SERVER:3478",
      username: "YOUR_USERNAME",
      credential: "YOUR_PASSWORD",
    },
    {
      urls: "turn:YOUR_TURN_SERVER:3478?transport=tcp",
      username: "YOUR_USERNAME",
      credential: "YOUR_PASSWORD",
    },
  ],
  iceCandidatePoolSize: 10,
};

export default function useWebRTC() {}