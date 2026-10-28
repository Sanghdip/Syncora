import "dotenv/config";                     // MUST be first — loads .env before anything else

import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import session from "express-session";
import pgSession from "connect-pg-simple";
import cookieParser from "cookie-parser";
import helmet from "helmet";

import { pool, initSchema } from "./db.js";
import * as Users from "./models/users.js";
import authRouter from "./routes/auth.js";
import gifRoutes from "./routes/gifs.js";

import { registerSyncHandlers } from "./sync/roomSync.js";
import { registerRoomHandlers }   from "./socketHandlers/roomHandler.js";
import { registerChatHandlers }   from "./socketHandlers/chatHandler.js";
import { registerVideoHandlers }  from "./socketHandlers/videoHandler.js";
import { registerWebRTCHandlers } from "./socketHandlers/webrtcHandler.js";
import { registerNekoHandlers }   from "./socketHandlers/nekoHandler.js";

// Init DB schema (tables). Idempotent — safe to run every startup.
await initSchema();

const PORT = process.env.PORT || 4000;
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_PROD = NODE_ENV === "production";

// ---- Session store (Postgres via connect-pg-simple) -------------------
const PgStore = pgSession(session);

const sessionMiddleware = session({
 
  store: new PgStore({
    pool: pool,           // your Neon pool
    tableName: "session",
    createTableIfMissing: true,
}),
  name: "nr.sid",
  secret: process.env.SESSION_SECRET || "dev-only-insecure-secret-change-me",
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: IS_PROD,                          // HTTPS only in production
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: "/",
  },
});

// ---- CORS ------------------------------------------------------------
const ALLOWED = [
  "http://localhost:3000",
  process.env.CLIENT_ORIGIN,
].filter(Boolean);

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);
    if (ALLOWED.includes(origin)) return cb(null, true);
    if (/^https?:\/\/(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))[^/]*:3000$/.test(origin)) {
      return cb(null, true);
    }
    cb(new Error("Not allowed by CORS"));
  },
  credentials: true,
};

// ---- App -------------------------------------------------------------
const app = express();
app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
}));
app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(sessionMiddleware);

// Attach current user to every request
app.use(async (req, _res, next) => {
  req.user = null;
  if (req.session?.userId) {
    try {
      const row = await Users.findById(req.session.userId);
      if (row) req.user = Users.toPublicUser(row);
      else req.session.userId = null;
    } catch (err) {
      console.error("user middleware error:", err);
    }
  }
  next();
});

app.get("/", (_req, res) => res.send("Syncora server running ✅"));
app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

app.use("/api/auth", authRouter);
app.use("/api/gifs", gifRoutes);

// ---- Socket.IO -------------------------------------------------------
const server = http.createServer(app);
const io = new Server(server, {
  cors: { ...corsOptions, methods: ["GET", "POST"] },
  pingInterval: 10000,
  pingTimeout: 5000,
});

// Wrap session middleware for Socket.IO
const wrap = (mw) => (socket, next) => mw(socket.request, {}, next);
io.use(wrap(sessionMiddleware));

// Attach authenticated user to socket.data
io.use(async (socket, next) => {
  const sess = socket.request.session;
  if (!sess?.userId) return next(new Error("Not authenticated"));
  try {
    const row = await Users.findById(sess.userId);
    if (!row) return next(new Error("User not found"));
    socket.data.userId = row.id;
    socket.data.user = Users.toPublicUser(row);
    next();
  } catch (err) {
    next(new Error("Auth lookup failed"));
  }
});

io.on("connection", (socket) => {
  console.log("🔌 connected:", socket.id, "as", socket.data.user?.username);

  registerRoomHandlers(io, socket);
  registerChatHandlers(io, socket);
  registerVideoHandlers(io, socket);
  registerWebRTCHandlers(io, socket);
  registerNekoHandlers(io, socket);
  registerSyncHandlers(io, socket);
});

server.listen(PORT, () => {
  console.log(`🚀 Server on http://localhost:${PORT} (${NODE_ENV})`);
  console.log(`🌍 Allowed origins: ${ALLOWED.join(", ")} + any LAN :3000`);
});