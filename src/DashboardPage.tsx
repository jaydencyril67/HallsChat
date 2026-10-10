import { FormEvent, useEffect, useState } from "react";
import { ArrowUpRight, Compass, Globe2, Heart, ImagePlus, LockKeyhole, LogOut, MessageCircle, Send, ShieldCheck, Sparkles, UsersRound, UserRound } from "lucide-react";
import AppHeader from "./AppHeader";
import NowBar from "./NowBar";

type Account = { id: string; name: string; username: string; email: string; createdAt?: string };
type SocialPost = {
  id: string;
  content: string;
  visibility: "public" | "private";
  createdAt: string;
  author: { id: string; name: string; username: string } | null;
  likeCount: number;
  likedByMe: boolean;
};

const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");

function timeAgo(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase() || "H";
}

export default function DashboardPage() {
  const [user, setUser] = useState<Account | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState("");
  const [draft, setDraft] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [publishing, setPublishing] = useState(false);
  const [likingIds, setLikingIds] = useState<string[]>([]);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("hallschat_token");
    if (!token) { window.location.replace("/signin"); return; }
    fetch(`${apiBase}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || "Please sign in again.");
        if (!payload.user || typeof payload.user.name !== "string" || typeof payload.user.email !== "string") {
          throw new Error("We couldn't read your account details. Please sign in again.");
        }
        return payload.user as Account;
      })
      .then(account => { if (!cancelled) setUser(account); })
      .catch(err => {
        if (cancelled) return;
        localStorage.removeItem("hallschat_token");
        setError(err instanceof Error ? err.message : "Unable to load your account.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const token = localStorage.getItem("hallschat_token");
    if (!token) return;
    setFeedLoading(true);
    setFeedError("");
    fetch(`${apiBase}/api/social/feed?limit=20`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || "The feed couldn't load.");
        return Array.isArray(payload.posts) ? payload.posts as SocialPost[] : [];
      })
      .then(items => { if (!cancelled) setPosts(items); })
      .catch(err => { if (!cancelled) setFeedError(err instanceof Error ? err.message : "The feed couldn't load."); })
      .finally(() => { if (!cancelled) setFeedLoading(false); });
    return () => { cancelled = true; };
  }, [user]);

  function signOut() {
    localStorage.removeItem("hallschat_token");
    window.location.replace("/signin");
  }

  async function publishPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || publishing) return;
    const token = localStorage.getItem("hallschat_token");
    if (!token) { window.location.replace("/signin"); return; }
    setPublishing(true);
    setFeedError("");
    setNotice("");
    try {
      const response = await fetch(`${apiBase}/api/social/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content, visibility })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.post) throw new Error(payload.message || "Your post couldn't be published.");
      setPosts(current => [payload.post as SocialPost, ...current]);
      setDraft("");
      setNotice("Your post is live.");
    } catch (err) {
      setFeedError(err instanceof Error ? err.message : "Your post couldn't be published.");
    } finally {
      setPublishing(false);
    }
  }

  async function toggleLike(post: SocialPost) {
    if (likingIds.includes(post.id)) return;
    const token = localStorage.getItem("hallschat_token");
    if (!token) { window.location.replace("/signin"); return; }
    setLikingIds(current => [...current, post.id]);
    try {
      const response = await fetch(`${apiBase}/api/social/posts/${encodeURIComponent(post.id)}/like`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Reaction couldn't be saved.");
      setPosts(current => current.map(item => item.id === post.id ? { ...item, likedByMe: Boolean(payload.likedByMe), likeCount: Number(payload.likeCount) || 0 } : item));
    } catch (err) {
      setFeedError(err instanceof Error ? err.message : "Reaction couldn't be saved.");
    } finally {
      setLikingIds(current => current.filter(id => id !== post.id));
    }
  }

  return <main className="dashboard-page social-dashboard">
    <div className="signup-glow signup-glow-top" aria-hidden="true" />
    <AppHeader homeHref="/dashboard" />
    <section className="dashboard-shell social-shell">
      <div className="dashboard-topline"><span className="signup-form-kicker">YOUR HALLSCHAT SPACE</span><button className="dashboard-signout" type="button" onClick={signOut}><LogOut size={15} /> Sign out</button></div>
      {loading ? <div className="dashboard-state" role="status">Getting your space ready…</div> : error ? <div className="dashboard-state dashboard-error"><p>{error}</p><a className="button button-primary" href="/signin">Back to sign in <ArrowUpRight size={16} /></a></div> : user && <>
        <div className="social-welcome">
          <div><span className="signup-form-kicker">YOUR PEOPLE. YOUR SPACE.</span><h1>Good to see you, {user.name.trim().split(/\s+/)[0] || "there"}.</h1><p>Share a thought, catch up with your people, and find your community.</p></div>
          <div className="social-welcome-mark"><Sparkles size={22} /><span>HALLS<br/>SOCIAL</span></div>
        </div>
        <div className="social-layout">
          <section className="social-feed-column" aria-label="Social feed">
            <form className="social-composer" onSubmit={publishPost}>
              <textarea id="social-post-content" value={draft} onChange={event => setDraft(event.target.value)} maxLength={2000} placeholder="What's on your mind? Share something with your HallsChat community…" rows={6} />
              <div className="social-composer-bottom">
                <label className="social-visibility"><span className="social-visibility-icon">{visibility === "public" ? <Globe2 size={15}/> : <LockKeyhole size={15}/>}</span><select aria-label="Post audience" value={visibility} onChange={event => setVisibility(event.target.value as "public" | "private")}><option value="public">Public post</option><option value="private">Only me</option></select></label>
                <span className="social-char-count">{draft.length}/2000</span>
                <button className="social-publish" type="submit" disabled={!draft.trim() || publishing}>{publishing ? "Publishing…" : "Publish"} <Send size={15}/></button>
              </div>
            </form>

            {notice && <p className="social-notice" role="status">{notice}</p>}
            {feedError && <div className="social-error" role="alert">{feedError}<button type="button" onClick={() => setFeedError("")} aria-label="Dismiss error">×</button></div>}
            <div className="social-feed-heading"><div><span className="signup-form-kicker">THE LATEST</span><h2>Your feed</h2></div><span className="social-feed-count">{posts.length} {posts.length === 1 ? "post" : "posts"}</span></div>
            {feedLoading ? <div className="social-empty"><div className="social-loader" /><strong>Loading your feed</strong><span>Finding the latest from HallsChat.</span></div> : posts.length === 0 ? <div className="social-empty"><span className="social-empty-icon"><MessageCircle size={22}/></span><h3>Your feed starts here.</h3><p>Be the first to share something. Your public posts can help people discover you and start a conversation.</p><button type="button" className="social-empty-action" onClick={() => document.getElementById("social-post-content")?.focus()}>Create your first post <ArrowUpRight size={15}/></button></div> : <div className="social-post-list">
              {posts.map(post => <article className="social-post" key={post.id}>
                <div className="social-post-head"><div className="social-avatar">{initials(post.author?.name || "HallsChat member")}</div><div className="social-post-author"><strong>{post.author?.name || "HallsChat member"}</strong><span>@{post.author?.username || "member"} · {timeAgo(post.createdAt)}</span></div><span className="social-post-audience" title={post.visibility === "public" ? "Visible to everyone" : "Only visible to you"}>{post.visibility === "public" ? <Globe2 size={14}/> : <LockKeyhole size={14}/>}</span></div>
                <p className="social-post-content">{post.content}</p>
                <div className="social-post-actions"><button type="button" className={post.likedByMe ? "social-like is-liked" : "social-like"} onClick={() => toggleLike(post)} disabled={likingIds.includes(post.id)} aria-pressed={post.likedByMe}><Heart size={17} fill={post.likedByMe ? "currentColor" : "none"}/><span>{post.likeCount > 0 ? post.likeCount : "Like"}</span></button><span className="social-post-action-muted"><MessageCircle size={16}/> Comments coming next</span></div>
              </article>)}
            </div>}
          </section>

          <aside className="social-sidebar">
            <article className="social-profile-card"><div className="social-profile-cover" /><div className="social-profile-body"><div className="social-avatar social-avatar-profile">{initials(user.name)}</div><h2>{user.name}</h2><p>@{user.username}</p><div className="social-profile-divider" /><div className="social-profile-email"><span>Email</span><strong>{user.email}</strong></div><div className="social-profile-verified"><ShieldCheck size={15}/> Email verified</div></div></article>
            <article className="social-side-card"><div className="social-side-title"><UsersRound size={17}/><h3>Find your people</h3></div><p>Communities and people discovery are next on the roadmap. We're building the foundations first.</p><span className="social-coming-soon"><Compass size={13}/> Community discovery · Coming next</span></article>
            <article className="social-side-note"><LockKeyhole size={16}/><p><strong>Your space, your choice.</strong><br/>Choose an audience for every post. Private posts are visible only to you.</p></article>
          </aside>
        </div>
      </>}
    </section>
    <NowBar />
  </main>;
}
