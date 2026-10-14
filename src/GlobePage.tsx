import { useCallback, useEffect, useState } from "react";
import { io } from "socket.io-client";
import type { CSSProperties } from "react";
import { UsersRound, UserRoundCheck, UserPlus } from "lucide-react";
import AppHeader from "./AppHeader";
import NowBar from "./NowBar";
import LoadingDots from "./components/LoadingDots";
import VerificationBadge from "./VerificationBadge";
import { navigate } from "./utils/navigate";

type GlobeUser = { id: string; name: string; username: string; profilePicture?: string; isVerified?: boolean; verifiedAt?: string | null; following: boolean; isOnline?: boolean; activeStatusHidden?: boolean };
type GlobeTab = "discover" | "followers";
const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase() || "G";
}

export default function GlobePage() {
  const [tab, setTab] = useState<GlobeTab>(() => new URLSearchParams(window.location.search).get("tab") === "followers" ? "followers" : "discover");
  const [users, setUsers] = useState<GlobeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!notice && !error) return;
    const timer = window.setTimeout(() => { setNotice(""); setError(""); }, 5000);
    return () => window.clearTimeout(timer);
  }, [notice, error]);

  const loadUsers = useCallback(async (activeTab: GlobeTab, showLoader = true) => {
    const token = localStorage.getItem("hallschat_token");
    if (!token) { navigate("/signin", { replace: true }); return; }
    if (showLoader) setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiBase}/api/social/halls?view=${activeTab}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Unable to load this list.");
      setUsers(Array.isArray(payload.users) ? payload.users : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load people right now.");
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers(tab);
    const token = localStorage.getItem("hallschat_token");
    if (!token) return;
    let hasConnected = false;
    const socket = io(apiBase, { auth: { token }, transports: ["websocket", "polling"] });
    socket.on("connect", () => {
      if (hasConnected) void loadUsers(tab, false);
      hasConnected = true;
    });
    socket.on("presence:update", (event: { userId?: string; isOnline?: boolean; activeStatusHidden?: boolean }) => {
      if (!event.userId) return;
      if (event.activeStatusHidden === true) {
        setUsers(current => current.map(person => person.id === event.userId ? { ...person, activeStatusHidden: true, isOnline: undefined } : person));
        return;
      }
      if (typeof event.isOnline === "boolean") setUsers(current => current.map(person => person.id === event.userId ? { ...person, activeStatusHidden: false, isOnline: event.isOnline } : person));
    });
    return () => { socket.removeAllListeners(); socket.disconnect(); };
  }, [tab, loadUsers]);

  async function toggleFollow(person: GlobeUser) {
    const token = localStorage.getItem("hallschat_token");
    if (!token) { navigate("/signin", { replace: true }); return; }
    setBusyId(person.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${apiBase}/api/social/follow/${encodeURIComponent(person.id)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "That follow action couldn't be completed.");
      setNotice(payload.following ? `You are now following @${person.username}.` : `You unfollowed @${person.username}.`);
      if (tab === "followers") {
        setUsers(current => current.map(item => item.id === person.id ? { ...item, following: Boolean(payload.following) } : item));
      } else {
        setUsers(current => current.map(item => item.id === person.id ? { ...item, following: Boolean(payload.following) } : item));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update follow status.");
    } finally {
      setBusyId("");
    }
  }

  const filteredUsers = users;

  const panel: React.CSSProperties = { border: "1px solid var(--theme-line)", borderRadius: 16, background: "var(--theme-surface)" };
  const muted: React.CSSProperties = { color: "var(--theme-muted)" };

  return <main className="home-page social-home globe-page globe-directory-page">
    <AppHeader homeHref="/home" />
    <section className="home-shell social-shell theme-token-scope" style={{ paddingBottom: 112 }}>
      <div style={{ width: "100%", maxWidth: 760, margin: "0 auto", padding: "0 0 24px", boxSizing: "border-box" }}>
        <div className="globe-directory-tabs" style={{ ...panel, padding: 5, display: "flex", gap: 8, marginBottom: 15 }}>
          {([{ id: "discover", label: "Discover people", icon: UserPlus }, { id: "followers", label: "Your followers", icon: UserRoundCheck }] as const).map(({ id, label, icon: Icon }) =>
            <button className="globe-directory-tab" key={id} type="button" onClick={() => { setTab(id); setNotice(""); }} aria-pressed={tab === id} style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "center", alignItems: "center", gap: 7, padding: "8px 10px", borderRadius: 9, border: tab === id ? "1px solid var(--theme-tabs-active-border)" : "1px solid var(--theme-border-subtle)", background: tab === id ? "var(--theme-tabs-active-bg)" : "var(--theme-tabs-bg)", color: tab === id ? "var(--theme-tabs-active-text)" : "var(--theme-tabs-text)", fontSize: ".8rem", fontWeight: 750 }}>
              <Icon size={16} /><span>{label}</span>
            </button>
          )}
        </div>


        {loading ? <div style={{ ...panel, display: "grid", placeItems: "center", padding: 36 }}><LoadingDots /></div> :
          filteredUsers.length ? <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filteredUsers.map((person) => <div className="globe-person-card" key={person.id} style={{ ...panel, display: "flex", alignItems: "center", gap: 11, padding: "13px 12px", boxShadow: "var(--theme-shadow-card-soft)" }}>
              <button className="globe-person-avatar" type="button" onClick={() => navigate("/users/" + encodeURIComponent(person.id))} aria-label={"View " + person.name + " profile"} style={{ width: 44, height: 44, flexShrink: 0, display: "grid", placeItems: "center", overflow: "hidden", borderRadius: "50%", border: "1px solid var(--theme-avatar-border)", background: "var(--theme-avatar-gradient)", color: "var(--theme-avatar-initials-text)", fontSize: ".82rem", fontWeight: 800, padding: 0 }}>{person.profilePicture ? <img src={person.profilePicture} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : initials(person.name)}</button>
              <div style={{ minWidth: 0, flex: 1 }}>
                <button className="globe-person-name" type="button" onClick={() => navigate("/users/" + encodeURIComponent(person.id))} style={{ display: "flex", alignItems: "center", gap: 4, maxWidth: "100%", padding: 0, border: 0, background: "transparent", color: "var(--theme-text-primary)", fontSize: ".88rem", fontWeight: 750, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{person.name}</span>{person.isVerified && person.verifiedAt && <VerificationBadge size={14} />}</button>
                <div style={{ ...muted, marginTop: 4, fontSize: ".78rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>@{person.username}</div><div className={`presence-label ${person.activeStatusHidden ? "" : person.isOnline ? "presence-online" : "presence-offline"}`}>{!person.activeStatusHidden && <span className="presence-dot" />}{person.activeStatusHidden ? "Recent" : person.isOnline ? "Online" : "Offline"}</div>
              </div>
              <button className={`globe-follow-button ${person.following ? "is-following" : "is-not-following"}`} type="button" disabled={busyId === person.id} onClick={() => void toggleFollow(person)} style={{ minWidth: 94, minHeight: 36, padding: "8px 11px", borderRadius: 999, border: person.following ? "1px solid var(--theme-action-secondary-border)" : "1px solid var(--theme-primary)", background: person.following ? "var(--theme-action-secondary-bg)" : "linear-gradient(135deg,var(--theme-primary-hover),var(--theme-primary))", color: person.following ? "var(--theme-action-secondary-text)" : "var(--theme-primary-contrast)", fontSize: ".75rem", fontWeight: 800, opacity: busyId === person.id ? .7 : 1 }}>
                {busyId === person.id ? <LoadingDots /> : person.following ? "Following" : "Follow"}
              </button>
            </div>)}
          </div> : <div className="globe-directory-empty" style={{ ...panel, padding: "30px 18px", textAlign: "center" }}>
            <div style={{ width: 48, height: 48, margin: "0 auto 12px", borderRadius: 16, display: "grid", placeItems: "center", background: "var(--theme-accent-soft)", color: "var(--theme-empty-state-icon)" }}>{tab === "discover" ? <UsersRound size={22} /> : <UserRoundCheck size={22} />}</div>
            <strong style={{ display: "block", fontSize: ".92rem" }}>{tab === "discover" ? "You're all caught up" : "Your circle is just getting started"}</strong>
            <p style={{ ...muted, margin: "7px auto 0", maxWidth: 300, fontSize: ".82rem", lineHeight: 1.6 }}>{tab === "discover" ? "There aren't any other discoverable accounts yet." : "When people follow you, they'll show up here."}</p>
          </div>
        }
      </div>
    </section>
    {(error || notice) && <div className={`halls-toast theme-token-scope ${error ? "halls-toast-error" : "halls-toast-success"}`} role={error ? "alert" : "status"}><span>{error || notice}</span>{error && <button type="button" onClick={() => { setError(""); void loadUsers(tab); }} aria-label="Retry loading people" title="Retry">↻</button>}<button type="button" onClick={() => { setError(""); setNotice(""); }} aria-label="Dismiss notification">×</button></div>}
    <NowBar />
  </main>;
}
