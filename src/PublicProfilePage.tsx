import { useEffect, useState, type CSSProperties } from "react";
import { ArrowLeft, MessageCircle, UserRoundCheck, UserPlus, Image as ImageIcon, CalendarDays } from "lucide-react";
import AppHeader from "./AppHeader";
import NowBar from "./NowBar";
import LoadingDots from "./components/LoadingDots";
import ImagePreviewModal from "./components/ImagePreviewModal";
import { navigate } from "./utils/navigate";

type ProfilePost = { id: string; content: string; images: string[]; createdAt: string; likeCount: number; commentCount: number };
type PublicUser = { id: string; name: string; username: string; profilePicture?: string; coverPhoto?: string; createdAt?: string; followersCount: number; followingCount: number; isFollowing: boolean; isSelf: boolean; canMessage: boolean; isOnline?: boolean; activeStatusHidden?: boolean };
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

  const panel: React.CSSProperties = { border: "1px solid var(--theme-line)", borderRadius: 16, background: "var(--theme-surface)" };
  const muted: React.CSSProperties = { color: "var(--theme-muted)" };

  return <main className="home-page social-home public-profile-page theme-token-scope">
    <AppHeader homeHref="/home" />
    <section className="home-shell social-shell theme-token-scope" style={{ paddingBottom: 112 }}>
      <div style={{ width: "100%", maxWidth: 760, margin: "0 auto", padding: "0 0 24px", boxSizing: "border-box" }}>
        <button type="button" onClick={() => window.history.length > 1 ? window.history.back() : navigate("/halls")} style={{ display: "inline-flex", alignItems: "center", gap: 7, margin: "0 0 13px", padding: "8px 11px", border: "1px solid var(--theme-border)", borderRadius: 10, background: "var(--theme-surface-hover)", color: "var(--theme-text-primary)", fontSize: ".78rem", fontWeight: 700 }}><ArrowLeft size={15} /> Back</button>
        {loading ? <div style={{ ...panel, display: "grid", placeItems: "center", minHeight: 260 }}><LoadingDots /></div> :
          error && !profile ? <div style={{ ...panel, padding: 28, textAlign: "center" }}><h2 style={{ margin: "0 0 8px", fontSize: "1rem" }}>Profile unavailable</h2><p style={{ ...muted, fontSize: ".84rem" }}>{error}</p><button type="button" onClick={() => navigate("/halls")} style={{ padding: "10px 15px", border: 0, borderRadius: 10, background: "var(--theme-danger-strong)", color: "var(--theme-text-inverse)", fontWeight: 800 }}>Back to Halls</button></div> :
          profile && <>
            <section style={{ ...panel, overflow: "hidden", marginBottom: 14 }}>
              <div aria-label="Profile cover photo" style={{ height: 150, background: profile.coverPhoto ? "linear-gradient(0deg,var(--theme-overlay),transparent),url(" + JSON.stringify(profile.coverPhoto) + ") center/cover no-repeat" : "var(--theme-avatar-gradient)", borderBottom: "1px solid var(--theme-border)" }} />
              <div style={{ padding: "0 17px 18px" }}>
                <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginTop: -43, flexWrap: "wrap" }}>
                  {profile.profilePicture ? <button type="button" onClick={() => setPreviewImage(profile.profilePicture || null)} aria-label={"Preview " + profile.name + "'s profile picture"} style={{ width: 94, height: 94, display: "grid", placeItems: "center", overflow: "hidden", borderRadius: "50%", border: "4px solid var(--theme-surface)", background: "var(--theme-avatar-gradient)", color: "var(--theme-avatar-initials-text)", fontSize: "1.35rem", fontWeight: 850, boxShadow: "var(--theme-shadow-card-soft)", padding: 0, cursor: "pointer" }}><img src={profile.profilePicture} alt={profile.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></button> : <div style={{ width: 94, height: 94, display: "grid", placeItems: "center", overflow: "hidden", borderRadius: "50%", border: "4px solid var(--theme-surface)", background: "var(--theme-avatar-gradient)", color: "var(--theme-avatar-initials-text)", fontSize: "1.35rem", fontWeight: 850, boxShadow: "var(--theme-shadow-card-soft)" }}>{initials(profile.name)}</div>}
                  <div style={{ display: "flex", gap: 8, paddingBottom: 3, flexWrap: "wrap" }}>
                    {profile.isSelf ? <button type="button" onClick={() => navigate("/profile")} style={{ minHeight: 38, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "9px 13px", border: "1px solid var(--theme-accent-border)", borderRadius: 999, background: "linear-gradient(135deg,var(--theme-primary-hover),var(--theme-primary))", color: "var(--theme-primary-contrast)", fontSize: ".78rem", fontWeight: 800 }}>Edit profile</button> : <>
                      <button type="button" disabled={busy} onClick={() => void toggleFollow()} style={{ minWidth: 112, minHeight: 38, display: "inline-flex", justifyContent: "center", alignItems: "center", gap: 7, padding: "9px 13px", border: profile.isFollowing ? "1px solid var(--theme-action-secondary-border)" : "1px solid var(--theme-accent-border)", borderRadius: 999, background: profile.isFollowing ? "var(--theme-action-secondary-bg)" : "linear-gradient(135deg,var(--theme-primary-hover),var(--theme-primary))", color: profile.isFollowing ? "var(--theme-action-secondary-text)" : "var(--theme-primary-contrast)", fontSize: ".78rem", fontWeight: 800 }}>{busy ? <LoadingDots /> : profile.isFollowing ? <><UserRoundCheck size={15} /> Following</> : <><UserPlus size={15} /> Follow</>}</button>
                      {profile.canMessage ? <button type="button" onClick={() => navigate("/chats?user=" + encodeURIComponent(profile.id))} style={{ minHeight: 38, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "9px 13px", border: "1px solid var(--theme-action-secondary-border)", borderRadius: 999, background: "var(--theme-action-secondary-bg)", color: "var(--theme-action-secondary-text)", fontSize: ".78rem", fontWeight: 800 }}><MessageCircle size={15} /> Message</button> : <span title="This person must follow you before you can message them" style={{ minHeight: 38, display: "inline-flex", alignItems: "center", padding: "9px 13px", border: "1px solid var(--theme-border)", borderRadius: 999, color: "var(--theme-disabled-text)", fontSize: ".72rem" }}>Message unavailable</span>}
                    </>}
                  </div>
                </div>
                <div style={{ marginTop: 13 }}>
                  <h1 style={{ margin: 0, color: "var(--theme-text-primary)", fontSize: "1.25rem", fontWeight: 850, letterSpacing: "-.02em" }}>{profile.name}</h1>
                  <div style={{ ...muted, marginTop: 4, fontSize: ".85rem" }}>@{profile.username}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 9, color: profile.activeStatusHidden ? "var(--theme-muted)" : profile.isOnline ? "var(--theme-presence-online)" : "var(--theme-presence-offline)", fontSize: ".74rem", fontWeight: 650 }}>{!profile.activeStatusHidden && <span style={{ width: 7, height: 7, borderRadius: "50%", background: profile.isOnline ? "var(--theme-presence-online)" : "var(--theme-presence-offline)" }} />}{profile.activeStatusHidden ? "Recent" : profile.isOnline ? "Online now" : "Offline"}</div>
                </div>
                <div style={{ display: "flex", gap: 22, marginTop: 17, paddingTop: 14, borderTop: "1px solid var(--theme-border)" }}>
                  <div><strong style={{ color: "var(--theme-text-primary)", fontSize: ".95rem" }}>{profile.followersCount}</strong><span style={{ ...muted, marginLeft: 5, fontSize: ".78rem" }}>followers</span></div>
                  <div><strong style={{ color: "var(--theme-text-primary)", fontSize: ".95rem" }}>{profile.followingCount}</strong><span style={{ ...muted, marginLeft: 5, fontSize: ".78rem" }}>following</span></div>
                  <div><strong style={{ color: "var(--theme-text-primary)", fontSize: ".95rem" }}>{posts.length}</strong><span style={{ ...muted, marginLeft: 5, fontSize: ".78rem" }}>posts</span></div>
                </div>

              </div>
            </section>
            {error && <div role="alert" style={{ ...panel, padding: 12, marginBottom: 12, color: "var(--theme-danger)", fontSize: ".8rem" }}>{error}</div>}
            <section style={{ ...panel, padding: 15 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 13 }}><h2 style={{ margin: 0, fontSize: ".96rem", color: "var(--theme-text-primary)" }}>Posts</h2><span style={{ ...muted, fontSize: ".75rem" }}>All posts</span></div>
              {posts.length ? <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 3, marginTop: 3 }}>
                {posts.map(post => <article key={post.id} role={post.images?.[0] ? "button" : undefined} tabIndex={post.images?.[0] ? 0 : undefined} aria-label={post.images?.[0] ? "Open post image" : undefined} onClick={post.images?.[0] ? () => setPreviewImage(post.images[0]) : undefined} onKeyDown={event => { if (post.images?.[0] && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setPreviewImage(post.images[0]); } }} style={{ minWidth: 0, aspectRatio: "3 / 4", overflow: "hidden", position: "relative", cursor: post.images?.[0] ? "zoom-in" : "default", background: "var(--theme-card-raised)", border: "1px solid var(--theme-border)", borderRadius: 4, padding: 9, boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  {post.images?.[0] ? <img src={post.images[0]} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : null}
                  {(!post.images?.[0]) ? <p style={{ position: "relative", zIndex: 1, margin: 0, color: "var(--theme-text-primary)", fontSize: ".78rem", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 7, WebkitBoxOrient: "vertical" } as CSSProperties}>{post.content || "Post"}</p> : null}
                  <div style={{ position: "absolute", inset: "auto 0 0", display: "flex", alignItems: "center", gap: 5, padding: "22px 7px 6px", color: "var(--theme-text-inverse)", fontSize: ".7rem", fontWeight: 750, background: "linear-gradient(transparent,var(--theme-overlay))" }}>♥ {post.likeCount || 0} <span style={{ marginLeft: 6 }}>◯ {post.commentCount || 0}</span></div>
                </article>)}
              </div> : <div style={{ padding: "25px 8px", textAlign: "center" }}><span style={{ display: "grid", placeItems: "center", width: 43, height: 43, margin: "0 auto 10px", borderRadius: 14, background: "var(--theme-accent-soft)", color: "var(--theme-danger)" }}><ImageIcon size={20} /></span><strong style={{ display: "block", color: "var(--theme-text-primary)", fontSize: ".88rem" }}>No posts yet</strong><p style={{ ...muted, fontSize: ".78rem", margin: "6px 0 0" }}>Their public posts will appear here.</p></div>}
            </section>
          </>
        }
      </div>
    </section>
    {previewImage && <ImagePreviewModal imageUrl={previewImage} onClose={() => setPreviewImage(null)} />}
    <NowBar />
  </main>;
}
