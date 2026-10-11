import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { UsersRound, UserRoundCheck, UserPlus } from "lucide-react";
import AppHeader from "./AppHeader";
import NowBar from "./NowBar";
import LoadingDots from "./components/LoadingDots";
import { navigate } from "./utils/navigate";

type HallUser = { id: string; name: string; username: string; following: boolean };
type HallTab = "discover" | "followers";
const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase() || "H";
}

export default function HallsPage() {
  const [tab, setTab] = useState<HallTab>("discover");
  const [users, setUsers] = useState<HallUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!notice && !error) return;
    const timer = window.setTimeout(() => { setNotice(""); setError(""); }, 5000);
    return () => window.clearTimeout(timer);
  }, [notice, error]);

  const loadUsers = useCallback(async (activeTab: HallTab) => {
    const token = localStorage.getItem("hallschat_token");
    if (!token) { navigate("/signin", { replace: true }); return; }
    setLoading(true);
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
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadUsers(tab); }, [tab, loadUsers]);

  async function toggleFollow(person: HallUser) {
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

  const panel: CSSProperties = { border: "1px solid rgba(255,210,219,.11)", borderRadius: 17, background: "linear-gradient(145deg,rgba(57,17,27,.58),rgba(28,9,15,.8))" };
  const muted: React.CSSProperties = { color: "rgba(246,220,225,.58)" };

  return <main className="home-page social-home halls-page">
    <AppHeader homeHref="/home" />
    <section className="home-shell social-shell" style={{ paddingBottom: 112 }}>
      <div style={{ width: "100%", maxWidth: 760, margin: "0 auto", padding: "12px 0 24px", boxSizing: "border-box" }}>
        <div style={{ ...panel, padding: 5, display: "flex", gap: 8, marginBottom: 15 }}>
          {([{ id: "discover", label: "Discover people", icon: UserPlus }, { id: "followers", label: "Your followers", icon: UserRoundCheck }] as const).map(({ id, label, icon: Icon }) =>
            <button key={id} type="button" onClick={() => { setTab(id); setNotice(""); }} aria-pressed={tab === id} style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "center", alignItems: "center", gap: 7, padding: "8px 10px", borderRadius: 9, border: tab === id ? "1px solid rgba(229,70,92,.7)" : "1px solid rgba(255,210,219,.11)", background: "rgba(255,255,255,.035)", color: tab === id ? "#ff9cab" : "rgba(246,220,225,.66)", fontSize: ".8rem", fontWeight: 750 }}>
              <Icon size={16} /><span>{label}</span>
            </button>
          )}
        </div>


        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, margin: "18px 2px 10px" }}>
          <h2 style={{ margin: 0, fontSize: ".93rem", fontWeight: 800 }}>{tab === "discover" ? "People on HallsChat" : "People following you"}</h2>
          <span style={{ ...muted, fontSize: ".75rem", whiteSpace: "nowrap" }}>{loading ? "Loading…" : `${filteredUsers.length} ${filteredUsers.length === 1 ? "person" : "people"}`}</span>
        </div>

        {loading ? <div style={{ ...panel, display: "grid", placeItems: "center", padding: 36 }}><LoadingDots /></div> :
          filteredUsers.length ? <div style={{ ...panel, overflow: "hidden" }}>
            {filteredUsers.map((person, index) => <div key={person.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "13px 12px", borderBottom: index === filteredUsers.length - 1 ? 0 : "1px solid rgba(255,210,219,.075)" }}>
              <div aria-hidden="true" style={{ width: 44, height: 44, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: "50%", border: "1px solid rgba(236,102,121,.3)", background: "linear-gradient(145deg,#713040,#35121d)", color: "#ffe4e9", fontSize: ".82rem", fontWeight: 800 }}>{initials(person.name)}</div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ color: "#fff0f3", fontSize: ".88rem", fontWeight: 750, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{person.name}</div>
                <div style={{ ...muted, marginTop: 4, fontSize: ".78rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>@{person.username}</div>
              </div>
              <button type="button" disabled={busyId === person.id} onClick={() => void toggleFollow(person)} style={{ minWidth: 94, minHeight: 36, padding: "8px 11px", borderRadius: 999, border: person.following ? "1px solid rgba(255,210,219,.2)" : "1px solid rgba(222,68,89,.65)", background: person.following ? "rgba(255,255,255,.045)" : "linear-gradient(135deg,#c52d44,#8f172c)", color: "#fff6f7", fontSize: ".75rem", fontWeight: 800, opacity: busyId === person.id ? .7 : 1 }}>
                {busyId === person.id ? <LoadingDots /> : person.following ? "Following" : "Follow"}
              </button>
            </div>)}
          </div> : <div style={{ ...panel, padding: "30px 18px", textAlign: "center" }}>
            <div style={{ width: 48, height: 48, margin: "0 auto 12px", borderRadius: 16, display: "grid", placeItems: "center", background: "rgba(184,32,50,.14)", color: "#ff9cab" }}>{tab === "discover" ? <UsersRound size={22} /> : <UserRoundCheck size={22} />}</div>
            <strong style={{ display: "block", fontSize: ".92rem" }}>{tab === "discover" ? "You're all caught up" : "Your circle is just getting started"}</strong>
            <p style={{ ...muted, margin: "7px auto 0", maxWidth: 300, fontSize: ".82rem", lineHeight: 1.6 }}>{tab === "discover" ? "There aren't any other discoverable accounts yet." : "When people follow you, they'll show up here."}</p>
          </div>
        }
      </div>
    </section>
    {(error || notice) && <div className={`halls-toast ${error ? "halls-toast-error" : "halls-toast-success"}`} role={error ? "alert" : "status"}><span>{error || notice}</span>{error && <button type="button" onClick={() => { setError(""); void loadUsers(tab); }} aria-label="Retry loading people" title="Retry">↻</button>}<button type="button" onClick={() => { setError(""); setNotice(""); }} aria-label="Dismiss notification">×</button></div>}
    <NowBar />
  </main>;
}
