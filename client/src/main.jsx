import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import { SocketProvider } from "./context/SocketContext.jsx";
import { RoomSyncProvider } from "./context/RoomSyncContext.jsx";
import { WallpaperProvider } from "./context/WallpaperContext.jsx";

import "./css/libs.css";
import "./css/app.css";
import "./css/lobby.css";
import "./css/wallpaper.css";
import "./css/room.css";
import "./css/desktop.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <WallpaperProvider>
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <SocketProvider>
            <RoomSyncProvider>
              <App />
            </RoomSyncProvider>
          </SocketProvider>
        </BrowserRouter>
      </WallpaperProvider>
    </AuthProvider>
  </React.StrictMode>
);