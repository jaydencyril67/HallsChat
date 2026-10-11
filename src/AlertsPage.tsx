import { Bell, CheckCheck, CircleAlert, Inbox, Trash2, ExternalLink } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { io } from "socket.io-client";
import AppHeader from "./AppHeader";
import NowBar from "./NowBar";
import LoadingDots from "./components/LoadingDots";
import { navigate } from "./utils/navigate";

type AlertType = "message" | "call" | "follow" | "like" | "comment" | "system";
type AlertItem = {
  id: string;
  title: string;
  message: string;
  type: AlertType;
  href: string;
  readAt: string | null;
  createdAt: string;
  actor?: { id: string; name: string; username: string; profilePicture?: string } | null;
};
type AlertFilter = "all" | "unread";
const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");
const apiHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("hallschat_token") || ""}", "Content-Type": "application/json" });

function timeLabel(value: string) {
  const date = new Date(value);
  const elapsed = Math.max(0, Date.now() - date.getTime());
  if (elapsed < 60_000) return "Just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  if (elapsed < 604_800_000) return `${Math.floor(elapsed / 86_400_000)}d ago`;
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function AlertsPage() {
  const [filter, setFilter] = useState<AlertFilter>("all");
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");

  const loadAlerts = useCallback(async (quiet = false) => {
    if (!localStorage.getItem("hallschat_token")) {
      navigate("/signin", { replace: true });
      return;
    }
    if (quiet) setRefreshing(true);
    try {
      const response = await fetch(`${apiBase}/api/alerts?limit=100`, { headers: apiHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "We couldn't load alerts.");
      setAlerts(Array.isArray(data.alerts) ? data.alerts : []);
      setUnreadCount(Number(data.unreadCount) || 0);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't load alerts right now.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAlerts();
    const timer = window.setInterval(() => { void loadAlerts(true); }, 15000);
    const token = localStorage.getItem("hallschat_token");
    const socket = token ? io(apiBase, { auth: { token }, transports: ["websocket", "polling"] }) : null;
    socket?.on("alert:new", (incoming: AlertItem) => {
      setAlerts(current => [incoming, ...current.filter(item => item.id !== incoming.id)].slice(0, 100));
      setUnreadCount(current => current + (incoming.readAt ? 0 : 1));
    });
    socket?.on("alert:count", (payload: { unreadCount?: number }) => {
      if (typeof payload?.unreadCount === "number") setUnreadCount(payload.unreadCount);
    });
    return () => {
      window.clearInterval(timer);
      socket?.disconnect();
    };
  }, [loadAlerts]);

  const markAllRead = async () => {
    if (markingAll || unreadCount === 0) return;
    setMarkingAll(true);
    try {
      const response = await fetch(`${apiBase}/api/alerts/read-all`, { method: "PATCH", headers: apiHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Couldn't mark alerts as read.");
      const readAt = new Date().toISOString();
      setAlerts(current => current.map(item => ({ ...item, readAt: item.readAt || readAt })));
      setUnreadCount(0);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't mark alerts as read.");
    } finally {
      setMarkingAll(false);
    }
  };

  const openAlert = async (item: AlertItem) => {
    if (!item.readAt) {
      try {
        const response = await fetch(`${apiBase}/api/alerts/${encodeURIComponent(item.id)}/read`, { method: "PATCH", headers: apiHeaders() });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Couldn't update this alert.");
        setAlerts(current => current.map(alert => alert.id === item.id ? { ...alert, readAt: new Date().toISOString() } : alert));
        setUnreadCount(Number(data.unreadCount) || 0);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't update this alert.");
        return;
      }
    }
    navigate(item.href && item.href.startsWith("/") && !item.href.startsWith("//") ? item.href : "/home");
  };

  const deleteAlert = async (id: string) => {
    if (deletingId) return;
    setDeletingId(id);
    try {
      const response = await fetch(`${apiBase}/api/alerts/${encodeURIComponent(id)}`, { method: "DELETE", headers: apiHeaders() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Couldn't delete this alert.");
      setAlerts(current => current.filter(item => item.id !== id));
      setUnreadCount(Number(data.unreadCount) || 0);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete this alert.");
    } finally {
      setDeletingId("");
    }
  };

  const visibleAlerts = filter === "unread" ? alerts.filter(item => !item.readAt) : alerts;

  return (
    <main className="home-page social-home halls-alerts-page">
      <AppHeader homeHref="/home" />
      <section className="home-shell social-shell halls-alerts-shell">
        <div className="halls-alerts-controls">
          <div className="halls-alerts-toolbar" role="tablist" aria-label="Alert filter">
            <button type="button" role="tab" aria-selected={filter === "all"} className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}><Inbox size={15} /> All alerts <span>{alerts.length}</span></button>
            <button type="button" role="tab" aria-selected={filter === "unread"} className={filter === "unread" ? "active" : ""} onClick={() => setFilter("unread")}><CircleAlert size={15} /> Unread <span>{unreadCount}</span></button>
          </div>
          {unreadCount > 0 ? <button type="button" className="halls-alerts-mark-all" onClick={() => void markAllRead()} disabled={markingAll}>{markingAll ? <LoadingDots /> : <><CheckCheck size={15} /> Mark all read</>}</button> : null}
        </div>
        {error ? <div className="halls-alerts-error" role="alert">{error}<button type="button" onClick={() => void loadAlerts()}>Retry</button></div> : null}
        {refreshing ? <p className="halls-alerts-refreshing"><LoadingDots /> Checking for new alerts…</p> : null}
        <section className="halls-alerts-list" aria-live="polite">
          {loading ? <div className="halls-alerts-empty"><LoadingDots /><p>Loading your alerts…</p></div> : null}
          {!loading && !error && visibleAlerts.length === 0 ? <div className="halls-alerts-empty"><div className="halls-alerts-empty-icon">{filter === "unread" ? <CheckCheck size={26} /> : <Inbox size={27} />}</div><h2>{filter === "unread" ? "You're all caught up" : "No alerts yet"}</h2><p>{filter === "unread" ? "There are no unread alerts to show." : "New messages, calls, followers and social activity will appear here."}</p></div> : null}
          {visibleAlerts.map(item => (
            <article key={item.id} className={`halls-alert-item ${item.readAt ? "" : "unread"}`}>
              <button type="button" className="halls-alert-item-main" onClick={() => void openAlert(item)}>
                <span className={`halls-alert-type-icon halls-alert-type-${item.type}`}><Bell size={18} /></span>
                <span className="halls-alert-copy"><strong>{item.title}</strong><span>{item.message}</span><small>{timeLabel(item.createdAt)}{item.actor?.name ? ` · ${item.actor.name}` : ""}</small></span>
                {!item.readAt ? <span className="halls-alert-unread-dot" aria-label="Unread" /> : null}
                <ExternalLink className="halls-alert-open-icon" size={15} />
              </button>
              <button type="button" className="halls-alert-delete" aria-label={`Delete alert: ${item.title}`} disabled={deletingId === item.id} onClick={() => void deleteAlert(item.id)}>{deletingId === item.id ? <LoadingDots /> : <Trash2 size={16} />}</button>
            </article>
          ))}
        </section>
      </section>
      <NowBar />
    </main>
  );
}
