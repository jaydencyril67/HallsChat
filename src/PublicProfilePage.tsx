import { useEffect, useState, type CSSProperties } from "react";
import { ArrowLeft, MessageCircle, UserRoundCheck, UserPlus, Image as ImageIcon, CalendarDays } from "lucide-react";
import AppHeader from "./AppHeader";
import NowBar from "./NowBar";
import LoadingDots from "./components/LoadingDots";
import ImagePreviewModal from "./components/ImagePreviewModal";
import { navigate } from "./utils/navigate";

type ProfilePost = { id: string; content: string; images: string[]; createdAt: string; likeCount: number; commentCount: number };
type PublicUser = { id: string; name: string; username: string; profilePicture?: string; coverPhoto?: string; createdAt?: string; followersCount: number; followingCount: number; isFollowing: boolean; isSelf: boolean; canMessage: boolean; isOnline: boolean };
const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase() || "H";
const timeAgo = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return Math.floor(seconds / 60) + "m";
  if (seconds < 86400) return Math.floor(seconds / 3600) + "h";
  if (seconds < 604800) return Math.floor(seconds / 86400) + "d";
  return date.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
};

export default function PublicProfilePage({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<PublicUser | null>(null);
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("hallschat_token");
    if (!token) { navigate("/signin", { replace: true }); return; }
    setLoading(true);
    setError("");
    fetch(apiBase + "/api/social/users/" + encodeURIComponent(userId), { headers: { Authorization: "Bearer " + token } })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.user) throw new Error(payload.message || "This profile couldn't be loaded.");
        return payload as { user: PublicUser; posts: ProfilePost[] };
      })
      .then(payload => { if (!cancelled) { setProfile(payload.user); setPosts(Array.isArray(payload.posts) ? payload.posts : []); } })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "This profile couldn't be loaded."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  async function toggleFollow() {
    if (!profile || busy) return;
    const token = localStorage.getItem("hallschat_token");
    if (!token) { navigate("/signin", { replace: true }); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch(apiBase + "/api/social/follow/" + encodeURIComponent(profile.id), {
        method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "That follow action couldn't be completed.");
      setProfile(current => current ? { ...current, isFollowing: Boolean(payload.following), followersCount: Math.max(0, current.followersCount + (payload.following ? 1 : -1)) } : current);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update follow status.");
    } finally { setBusy(false); }
  }

  const panel: CSSProperties = { border: "1px solid rgba(255,210,219,.11)", borderRadius: 17, background: "linear-gradient(145deg,rgba(57,17,27,.58),rgba(28,9,15,.8))" };
  const muted: CSSProperties = { color: "rgba(246,220,225,.58)" };

  return <main className="home-page social-home public-profile-page">
    <AppHeader homeHref="/home" />
    <section className="home-shell social-shell" style={{ paddingBottom: 112 }}>
      <div style={{ width: "100%", maxWidth: 760, margin: "0 auto", padding: "0 0 24px", boxSizing: "border-box" }}>
        <button type="button" onClick={() => window.history.length > 1 ? window.history.back() : navigate("/halls")} style={{ display: "inline-flex", alignItems: "center", gap: 7, margin: "0 0 13px", padding: "8px 11px", border: "1px solid rgba(255,210,219,.12)", borderRadius: 10, background: "rgba(255,255,255,.035)", color: "#f4dfe3", fontSize: ".78rem", fontWeight: 700 }}><ArrowLeft size={15} /> Back</button>
        {loading ? <div style={{ ...panel, display: "grid", placeItems: "center", minHeight: 260 }}><LoadingDots /></div> :
          error && !profile ? <div style={{ ...panel, padding: 28, textAlign: "center" }}><h2 style={{ margin: "0 0 8px", fontSize: "1rem" }}>Profile unavailable</h2><p style={{ ...muted, fontSize: ".84rem" }}>{error}</p><button type="button" onClick={() => navigate("/halls")} style={{ padding: "10px 15px", border: 0, borderRadius: 10, background: "#b82032", color: "#fff", fontWeight: 800 }}>Back to Halls</button></div> :
          profile && <>
            <section style={{ ...panel, overflow: "hidden", marginBottom: 14 }}>
              <div aria-label="Profile cover photo" style={{ height: 178, background: profile.coverPhoto ? "linear-gradient(0deg,rgba(18,5,9,.25),rgba(18,5,9,.05)),url(" + JSON.stringify(profile.coverPhoto) + ") center/cover no-repeat" : "radial-gradient(ellipse at 80% 15%,rgba(238,83,108,.35),transparent 38%),linear-gradient(125deg,#681c2c,#240a12 76%)", borderBottom: "1px solid rgba(255,255,255,.07)" }} />
              <div style={{ padding: "0 17px 18px" }}>
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginTop: -43, flexWrap: "wrap" }}>
                  <div style={{ width: 94, height: 94, display: "grid", placeItems: "center", overflow: "hidden", borderRadius: "50%", border: "4px solid #260a12", background: "linear-gradient(145deg,#713040,#35121d)", color: "#ffe4e9", fontSize: "1.35rem", fontWeight: 850, boxShadow: "0 6px 20px rgba(0,0,0,.3)" }}>{profile.profilePicture ? <img src={profile.profilePicture} alt={profile.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials(profile.name)}</div>
                  <div style={{ display: "flex", gap: 8, paddingBottom: 3, flexWrap: "wrap" }}>
                    {profile.isSelf ? <button type="button" onClick={() => navigate("/profile")} style={{ minHeight: 38, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "9px 13px", border: "1px solid rgba(222,68,89,.65)", borderRadius: 999, background: "linear-gradient(135deg,#c52d44,#8f172c)", color: "#fff6f7", fontSize: ".78rem", fontWeight: 800 }}>Edit profile</button> : <>
                      <button type="button" disabled={busy} onClick={() => void toggleFollow()} style={{ minWidth: 112, minHeight: 38, display: "inline-flex", justifyContent: "center", alignItems: "center", gap: 7, padding: "9px 13px", border: profile.isFollowing ? "1px solid rgba(255,210,219,.2)" : "1px solid rgba(222,68,89,.65)", borderRadius: 999, background: profile.isFollowing ? "rgba(255,255,255,.045)" : "linear-gradient(135deg,#c52d44,#8f172c)", color: "#fff6f7", fontSize: ".78rem", fontWeight: 800 }}>{busy ? <LoadingDots /> : profile.isFollowing ? <><UserRoundCheck size={15} /> Following</> : <><UserPlus size={15} /> Follow</>}</button>
                      {profile.canMessage ? <button type="button" onClick={() => navigate("/chats?user=" + encodeURIComponent(profile.id))} style={{ minHeight: 38, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "9px 13px", border: "1px solid rgba(255,210,219,.18)", borderRadius: 999, background: "rgba(255,255,255,.06)", color: "#fff6f7", fontSize: ".78rem", fontWeight: 800 }}><MessageCircle size={15} /> Message</button> : <span title="This person must follow you before you can message them" style={{ minHeight: 38, display: "inline-flex", alignItems: "center", padding: "9px 13px", border: "1px solid rgba(255,210,219,.1)", borderRadius: 999, color: "rgba(246,220,225,.48)", fontSize: ".72rem" }}>Message unavailable</span>}
                    </>}
                  </div>
                </div>
                <div style={{ marginTop: 13 }}>
                  <h1 style={{ margin: 0, color: "#fff0f3", fontSize: "1.25rem", fontWeight: 850, letterSpacing: "-.02em" }}>{profile.name}</h1>
                  <div style={{ ...muted, marginTop: 4, fontSize: ".85rem" }}>@{profile.username}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 9, color: profile.isOnline ? "#62dfa1" : "rgba(246,220,225,.5)", fontSize: ".74rem", fontWeight: 650 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: profile.isOnline ? "#62dfa1" : "#8d747b" }} />{profile.isOnline ? "Online now" : "Offline"}</div>
                </div>
                <div style={{ display: "flex", gap: 22, marginTop: 17, paddingTop: 14, borderTop: "1px solid rgba(255,210,219,.09)" }}>
                  <div><strong style={{ color: "#fff0f3", fontSize: ".95rem" }}>{profile.followersCount}</strong><span style={{ ...muted, marginLeft: 5, fontSize: ".78rem" }}>followers</span></div>
                  <div><strong style={{ color: "#fff0f3", fontSize: ".95rem" }}>{profile.followingCount}</strong><span style={{ ...muted, marginLeft: 5, fontSize: ".78rem" }}>following</span></div>
                  <div><strong style={{ color: "#fff0f3", fontSize: ".95rem" }}>{posts.length}</strong><span style={{ ...muted, marginLeft: 5, fontSize: ".78rem" }}>posts</span></div>
                </div>
                {profile.createdAt && <div style={{ ...muted, display: "flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: ".74rem" }}><CalendarDays size={14} /> Joined {new Date(profile.createdAt).toLocaleDateString([], { month: "long", year: "numeric" })}</div>}
              </div>
            </section>
            {error && <div role="alert" style={{ ...panel, padding: 12, marginBottom: 12, color: "#ff9cab", fontSize: ".8rem" }}>{error}</div>}
            <section style={{ ...panel, padding: 15 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 13 }}><h2 style={{ margin: 0, fontSize: ".96rem", color: "#fff0f3" }}>Posts</h2><span style={{ ...muted, fontSize: ".75rem" }}>Latest 30</span></div>
              {posts.length ? <div style={{ display: "grid", gap: 12 }}>
                {posts.map(post => <article key={post.id} style={{ border: "1px solid rgba(255,210,219,.09)", borderRadius: 13, padding: 13, background: "rgba(0,0,0,.12)" }}>
                  <div style={{ ...muted, display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 9, fontSize: ".72rem" }}><span>@{profile.username}</span><span>{timeAgo(post.createdAt)}</span></div>
                  {post.content && <p style={{ margin: "0 0 10px", color: "#f6e7ea", fontSize: ".88rem", lineHeight: 1.7, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{post.content}</p>}
                  {post.images?.length > 0 && <div style={{ display: "grid", gridTemplateColumns: post.images.length === 1 ? "1fr" : "repeat(2,minmax(0,1fr))", gap: 6 }}>{post.images.map((url, index) => <button key={url + index} type="button" onClick={() => setPreviewImage(url)} aria-label="View post image" style={{ display: "block", padding: 0, border: 0, overflow: "hidden", borderRadius: 9, background: "rgba(255,255,255,.04)" }}><img src={url} alt="" loading="lazy" style={{ display: "block", width: "100%", maxHeight: 360, objectFit: "cover" }} /></button>)}</div>}
                  <div style={{ ...muted, display: "flex", gap: 15, marginTop: 11, fontSize: ".74rem" }}><span>♥ {post.likeCount} likes</span><span>◯ {post.commentCount} comments</span></div>
                </article>)}
              </div> : <div style={{ padding: "25px 8px", textAlign: "center" }}><span style={{ display: "grid", placeItems: "center", width: 43, height: 43, margin: "0 auto 10px", borderRadius: 14, background: "rgba(184,32,50,.14)", color: "#ff9cab" }}><ImageIcon size={20} /></span><strong style={{ display: "block", color: "#fff0f3", fontSize: ".88rem" }}>No posts yet</strong><p style={{ ...muted, fontSize: ".78rem", margin: "6px 0 0" }}>Their public posts will appear here.</p></div>}
            </section>
          </>
        }
      </div>
    </section>
    {previewImage && <ImagePreviewModal imageUrl={previewImage} onClose={() => setPreviewImage(null)} />}
    <NowBar />
  </main>;
}
