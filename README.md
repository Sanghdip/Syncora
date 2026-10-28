# Syncora

A watch-party platform with YouTube sync, screen share, camera chat, and a shared virtual browser.

## Features
- 🔐 Login / lobby / rooms
- 📺 YouTube sync (play/pause/seek)
- 🖥️ Screen sharing (WebRTC)
- 🎥 Camera + voice chat (WebRTC)
- 🌐 Shared virtual browser (Neko + Docker)
- 💬 Realtime chat (Socket.IO)
- 👑 Host roles & permissions

## Quick Start

```bash
# 1. Start virtual browser
docker compose up -d

# 2. Start server
cd server && npm install && npm run dev

# 3. Start client (new terminal)
cd client && npm install && npm run dev