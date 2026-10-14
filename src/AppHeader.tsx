import { useEffect, useState, type CSSProperties } from "react";
import { Bell } from "lucide-react";
import { io } from "socket.io-client";
import { navigate } from "./utils/navigate";
import { dismissBackgroundTaskResult, getBackgroundTaskState, subscribeBackgroundTasks, type BackgroundTaskSnapshot } from "./utils/backgroundTasks";

const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");

export default function AppHeader({ homeHref = "#top" }: { homeHref?: string }) {
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [unreadCount, setUnreadCount] = useState(0);
  const [taskState, setTaskState] = useState<BackgroundTaskSnapshot>(() => getBackgroundTaskState());
  const [alertColor, setAlertColor] = useState(() => {
    const saved = localStorage.getItem("hallschat_alert_color");
    return saved && /^#[0-9a-f]{6}$/i.test(saved) ? saved.toLowerCase() : "#e11d48";
  });
  const [alertColorEnabled, setAlertColorEnabled] = useState(() => localStorage.getItem("hallschat_alert_color_enabled") !== "false");

  useEffect(() => subscribeBackgroundTasks(setTaskState), []);

  useEffect(() => {
    const syncAlertColor = () => {
      const saved = localStorage.getItem("hallschat_alert_color");
      setAlertColor(saved && /^#[0-9a-f]{6}$/i.test(saved) ? saved.toLowerCase() : "#e11d48");
      setAlertColorEnabled(localStorage.getItem("hallschat_alert_color_enabled") !== "false");
    };
    window.addEventListener("hallschat:alert-color-changed", syncAlertColor);
    window.addEventListener("storage", syncAlertColor);
    return () => {
      window.removeEventListener("hallschat:alert-color-changed", syncAlertColor);
      window.removeEventListener("storage", syncAlertColor);
    };
  }, []);

  const activeTask = taskState.tasks[taskState.tasks.length - 1];
  const taskResult = activeTask ? null : taskState.lastResult;
  const uploadRelated = (label: string, status = "") => /upload|photo|picture|image|attachment|story|logo/i.test(`${label} ${status}`);
  const headerStatus = activeTask
    ? (uploadRelated(activeTask.label, activeTask.status) ? "Uploading" : "Sending")
    : taskResult
      ? taskResult.error ? (uploadRelated(taskResult.label, taskResult.status) ? "Upload Failed" : "Send Failed") : uploadRelated(taskResult.label, taskResult.status) ? "Uploaded" : "Sent"
      : "";

  // Match CryBots: illuminate the header while unread alerts exist, and also
  // while the upload manager has a live task.
  const headerAlertActive = alertColorEnabled && (unreadCount > 0 || Boolean(activeTask));
  const headerAlertStyle: CSSProperties | undefined = headerAlertActive ? {
    borderColor: alertColor + "b8",
    boxShadow: "0 0 0 1px color-mix(in srgb, " + alertColor + " 72%, transparent), 0 0 18px color-mix(in srgb, " + alertColor + " 48%, transparent), 0 14px 30px rgba(0,0,0,0.24)",
    animation: "halls-alert-color-pulse 1.2s ease-in-out infinite",
    ["--halls-alert-color" as string]: alertColor,
  } : undefined;

  useEffect(() => {
    if (activeTask || !taskResult) return;
    const timer = window.setTimeout(() => dismissBackgroundTaskResult(), 4000);
    return () => window.clearTimeout(timer);
  }, [activeTask?.id, taskResult?.id, taskState.revision]);

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
    className="topbar hallschat-clickable-header theme-fixed-dark"
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
      {headerStatus && <small className={`halls-header-upload-status${taskResult?.error ? " is-failed" : taskResult ? " is-complete" : " is-active"}`} role={taskResult?.error ? "alert" : "status"} aria-live="polite">{headerStatus}</small>}
    </div>
    <span className="header-artwork header-artwork-right" aria-hidden="true">
      <span className="header-logo"><img src="/crown-chat.svg?v=7" alt="" /></span>
    </span>
    {unreadCount > 0 ? <span className="halls-header-alert-badge" style={headerAlertActive ? { background: alertColor, boxShadow: "0 0 0 1px " + alertColor + "66, 0 0 12px " + alertColor + "88" } : undefined} aria-hidden="true">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
  </header>;
}
