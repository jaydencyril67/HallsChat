import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { io } from "socket.io-client";
import { navigate } from "./utils/navigate";

const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");

export default function AppHeader({ homeHref = "#top" }: { homeHref?: string }) {
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    updateOnlineStatus();
    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("hallschat_token");
    if (!token) { setUnreadCount(0); return; }
    let cancelled = false;
    const loadCount = async () => {
      try {
        const response = await fetch(`${apiBase}/api/alerts/unread-count`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await response.json();
        if (response.ok && !cancelled) setUnreadCount(Number(data.unreadCount) || 0);
      } catch { /* Keep the last known badge count while offline. */ }
    };
    void loadCount();
    const timer = window.setInterval(() => { void loadCount(); }, 15000);
    const socket = io(apiBase, { auth: { token }, transports: ["websocket", "polling"] });
    socket.on("alert:count", (payload: { unreadCount?: number }) => {
      if (typeof payload?.unreadCount === "number") setUnreadCount(payload.unreadCount);
    });
    socket.on("alert:new", () => { void loadCount(); });
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      socket.disconnect();
    };
  }, []);

  const openAlerts = () => {
    if (localStorage.getItem("hallschat_token")) navigate("/notifications");
    else if (homeHref !== "#top") navigate(homeHref);
  };

  return <header
    className="topbar hallschat-clickable-header"
    role="button"
    tabIndex={0}
    aria-label={localStorage.getItem("hallschat_token") ? `Open alerts${unreadCount ? `, ${unreadCount} unread` : ""}` : "HallsChat home"}
    onClick={openAlerts}
    onKeyDown={event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openAlerts();
      }
    }}
  >
    <span className="header-artwork" aria-hidden="true">
      <span className="header-logo"><img src="/crown-chat.svg?v=7" alt="" /></span>
    </span>
    <div className="header-brand">
      <strong>{isOnline ? "HALLSCHAT" : "NO INTERNET"}</strong>
      {!isOnline && <small>Check your connection</small>}
    </div>
    <span className="header-artwork header-artwork-right" aria-hidden="true">
      <span className="header-logo"><img src="/crown-chat.svg?v=7" alt="" /></span>
    </span>
    {unreadCount > 0 ? <span className="halls-header-alert-badge" aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
  </header>;
}
