import { io } from "socket.io-client";
import { API_BASE } from "../utils/config";

const REALTIME_BASE = API_BASE || "https://api.gantabyaa.in";

export function createAdminRealtimeSocket({ token, onStatus, onEvent } = {}) {
  if (!token) return null;

  const socket = io(REALTIME_BASE, {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    autoConnect: false,
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
  });

  socket.on("connect", () => {
    onStatus?.("connected");
    socket.emit("join_analytics");
  });
  socket.on("disconnect", () => onStatus?.("disconnected"));
  socket.on("connect_error", (error) => onStatus?.("error", error));
  socket.onAny((event, payload) => onEvent?.(event, payload));
  socket.connect();

  return socket;
}

export function createNotificationSocket(token, onMessage) {
  if (!token || typeof WebSocket === "undefined") return null;

  const base = REALTIME_BASE.replace(/^http/, "ws");
  const socket = new WebSocket(`${base}/api/v1/notifications/ws?token=${encodeURIComponent(token)}`);
  socket.onmessage = (event) => {
    try {
      onMessage?.(JSON.parse(event.data));
    } catch {
      // Ignore malformed server messages.
    }
  };
  return socket;
}
