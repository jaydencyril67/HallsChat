import { useEffect, useState } from "react";
import { CalendarDays, FileText, Mail, UserRound, AtSign, ArrowLeft, UsersRound } from "lucide-react";
import AppHeader from "./AppHeader";
import NowBar from "./NowBar";
import LoadingDots from "./components/LoadingDots";
import { navigate } from "./utils/navigate";

type Account = { id: string; name: string; username: string; email: string; createdAt?: string };
type Post = { id: string; content: string; createdAt: string; author: { id: string; name: string; username: string } | null; likeCount?: number; images?: string[]; poll?: { question: string } | null };
const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");

export default function ProfilePage() {
  const [user, setUser] = useState<Account | null>(null);
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("hallschat_token");
    if (!token) { navigate("/signin", { replace: true }); return; }
    fetch(`${apiBase}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.user) throw new Error(payload.message || "Your profile couldn't be loaded.");
        return payload.user as Account;
      })
      .then(account => { if (!cancelled) setUser(account); })
      .catch(err => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Your profile couldn't be loaded.");
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    fetch(`${apiBase}/api/social/feed?limit=100`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || "Your posts couldn't be loaded.");
        return Array.isArray(payload.posts) ? payload.posts as Post[] : [];
      })
      .then(items => { if (!cancelled) setAllPosts(items); })
      .catch(() => { if (!cancelled) setPosts([]); })
      .finally(() => { if (!cancelled) setPostsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const initials = user?.name?.trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase() || "H";
  const panel: React.CSSProperties = { border: "1px solid rgba(255,210,219,.11)", borderRadius: 17, background: "linear-gradient(145deg,rgba(57,17,27,.58),rgba(28,9,15,.8))" };
  const muted: React.CSSProperties = { color: "rgba(246,220,225,.58)" };

  return <main className="home-page social-home halls-page">
    <AppHeader homeHref="/home" />
    <section className="home-shell social-shell" style={{ paddingBottom: 112 }}>
      <div style={{ width: "100%", maxWidth: 760, margin: "0 auto", padding: "12px 0 24px", boxSizing: "border-box" }}>
        <button type="button" onClick={() => navigate("/home")} style={{ display: "inline-flex", alignItems: "center", gap: 7, margin: "0 0 17px", padding: "8px 11px", border: "1px solid rgba(255,210,219,.12)", borderRadius: 10, background: "rgba(255,255,255,.025)", color: "#e9cbd1", fontSize: ".78rem" }}><ArrowLeft size={15} /> Back to home</button>
        {error ? <div role="alert" style={{ ...panel, padding: 18, color: "#ff9cab" }}>{error}<button type="button" onClick={() => navigate("/signin")} style={{ display: "block", marginTop: 12, padding: 0, border: 0, background: "none", color: "#ffd4db", textDecoration: "underline" }}>Sign in again</button></div> : <>
          <div style={{ ...panel, overflow: "hidden", marginBottom: 17 }}>
            <div style={{ height: 112, background: "radial-gradient(ellipse at 78% 15%,rgba(231,82,104,.32),transparent 48%),linear-gradient(125deg,#48121f,#21090f 78%)", borderBottom: "1px solid rgba(255,255,255,.06)" }} />
            <div style={{ padding: "0 18px 20px" }}>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginTop: -34 }}>
                <div aria-label="Profile initials" style={{ width: 72, height: 72, display: "grid", placeItems: "center", border: "4px solid #21090f", borderRadius: 22, background: "linear-gradient(145deg,#a72a43,#48121f)", color: "#fff0f3", fontSize: "1.25rem", fontWeight: 850 }}>{loading ? <LoadingDots /> : initials}</div>
                <span style={{ marginBottom: 7, padding: "6px 9px", border: "1px solid rgba(232,90,110,.24)", borderRadius: 999, color: "#f09aa7", fontSize: ".68rem", fontWeight: 800, letterSpacing: ".06em" }}>MY PROFILE</span>
              </div>
              <h1 style={{ margin: "13px 0 4px", color: "#fff0f3", fontSize: "clamp(1.4rem,5vw,1.9rem)", letterSpacing: "-.04em", overflowWrap: "anywhere" }}>{loading ? "Loading profile…" : user?.name || "HallsChat member"}</h1>
              <p style={{ margin: 0, color: "#e69aa7", fontSize: ".88rem" }}>{user?.username ? `@${user.username}` : "Your HallsChat account"}</p>
              <p style={{ margin: "12px 0 0", ...muted, fontSize: ".84rem", lineHeight: 1.7 }}>Your space on HallsChat. Keep up with your posts and the details connected to your account.</p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10, marginBottom: 18 }}>
            <div style={{ ...panel, padding: 14 }}><div style={{ display: "flex", alignItems: "center", gap: 8, color: "#f08b9b", fontSize: ".75rem", fontWeight: 750 }}><FileText size={16} /> Your posts</div><strong style={{ display: "block", marginTop: 10, fontSize: "1.45rem", color: "#fff0f3" }}>{postsLoading ? "—" : posts.length}</strong><span style={{ display: "block", marginTop: 3, ...muted, fontSize: ".72rem" }}>Posts in your recent feed</span></div>
            <div style={{ ...panel, padding: 14 }}><div style={{ display: "flex", alignItems: "center", gap: 8, color: "#f08b9b", fontSize: ".75rem", fontWeight: 750 }}><UsersRound size={16} /> Community</div><strong style={{ display: "block", marginTop: 10, fontSize: "1.45rem", color: "#fff0f3" }}>Halls</strong><span style={{ display: "block", marginTop: 3, ...muted, fontSize: ".72rem" }}>Discover people to follow</span></div>
          </div>

          <section style={{ ...panel, padding: 16, marginBottom: 18 }}>
            <h2 style={{ margin: "0 0 14px", color: "#fff0f3", fontSize: ".98rem" }}>Account details</h2>
            <div style={{ display: "grid", gap: 15 }}>
              <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}><UserRound size={17} color="#e77b8d" /><div style={{ minWidth: 0 }}><span style={{ display: "block", ...muted, fontSize: ".72rem" }}>Full name</span><strong style={{ display: "block", marginTop: 4, color: "#f3dfe3", fontSize: ".84rem", overflowWrap: "anywhere" }}>{loading ? "Loading…" : user?.name || "Not available"}</strong></div></div>
              <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}><AtSign size={17} color="#e77b8d" /><div style={{ minWidth: 0 }}><span style={{ display: "block", ...muted, fontSize: ".72rem" }}>Username</span><strong style={{ display: "block", marginTop: 4, color: "#f3dfe3", fontSize: ".84rem", overflowWrap: "anywhere" }}>{user?.username ? `@${user.username}` : "Not available"}</strong></div></div>
              <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}><Mail size={17} color="#e77b8d" /><div style={{ minWidth: 0, flex: 1 }}><span style={{ display: "block", ...muted, fontSize: ".72rem" }}>Email address</span><strong style={{ display: "block", marginTop: 4, color: "#f3dfe3", fontSize: ".84rem", overflowWrap: "anywhere" }}>{user?.email || "Not available"}</strong></div></div>
              {user?.createdAt && <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}><CalendarDays size={17} color="#e77b8d" /><div><span style={{ display: "block", ...muted, fontSize: ".72rem" }}>Member since</span><strong style={{ display: "block", marginTop: 4, color: "#f3dfe3", fontSize: ".84rem" }}>{new Date(user.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</strong></div></div>}
            </div>
          </section>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="button button-primary" onClick={() => navigate("/halls")}><UsersRound size={16} /> Find people</button>
            <button type="button" className="button button-secondary" onClick={() => navigate("/settings")}>Settings</button>
          </div>
          <p style={{ margin: "18px 2px 8px", ...muted, fontSize: ".72rem", lineHeight: 1.6 }}>Profile editing and profile photos can be connected when those account features are available.</p>
        </>}
      </div>
    </section>
    <NowBar />
  </main>;
}
