import { useCallback, useEffect, useState } from "react";
import { ArrowRight, LockKeyhole, UserPlus, X } from "lucide-react";
import LandingPage from "./LandingPage";
import HomePage from "./HomePage";
import { navigate } from "./utils/navigate";
import LoadingDots from "./components/LoadingDots";
import VerificationBadge from "./VerificationBadge";

type SharedPost = {
  id: string;
  content: string;
  images: string[];
  backgroundColor?: string;
  poll?: { question: string; options: { id: string; text: string; voteCount: number; votedByMe: boolean }[] } | null;
  createdAt: string;
  likeCount: number;
  commentCount: number;
};
type SharedAuthor = { id: string; name: string; username: string; profilePicture?: string; isVerified?: boolean; verifiedAt?: string | null };
type SharedPayload = { author: SharedAuthor; canView: boolean; isFollowing: boolean; post: SharedPost | null; message?: string };

const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase() || "H";

export default function SharedPostPage({ postId }: { postId: string }) {
  const token = localStorage.getItem("hallschat_token");
  const [payload, setPayload] = useState<SharedPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [error, setError] = useState("");

  const loadSharedPost = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const currentToken = localStorage.getItem("hallschat_token");
      const response = await fetch(apiBase + "/api/social/shared-post/" + encodeURIComponent(postId), {
        headers: currentToken ? { Authorization: "Bearer " + currentToken } : {}
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "This shared post couldn't be loaded.");
      if (!result.author) throw new Error("This shared post is unavailable.");
      setPayload(result as SharedPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "This shared post couldn't be loaded.");
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => { void loadSharedPost(); }, [loadSharedPost]);

  async function followToView() {
    if (!payload?.author || following) return;
    const currentToken = localStorage.getItem("hallschat_token");
    if (!currentToken) {
      navigate("/signin?returnTo=" + encodeURIComponent("/post/" + postId));
      return;
    }
    setFollowing(true);
    setError("");
    try {
      const response = await fetch(apiBase + "/api/social/follow/" + encodeURIComponent(payload.author.id), {
        method: "POST",
        headers: { Authorization: "Bearer " + currentToken, "Content-Type": "application/json" }
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "You couldn't follow this account right now.");
      await loadSharedPost();
    } catch (err) {
      setError(err instanceof Error ? err.message : "You couldn't follow this account right now.");
    } finally {
      setFollowing(false);
    }
  }

  const close = () => navigate(localStorage.getItem("hallschat_token") ? "/home" : "/");
  const showPost = Boolean(payload?.canView && payload.post);

  return <>
    {token ? <HomePage /> : <LandingPage onSignup={() => navigate("/signup")} />}
    <div className="shared-post-backdrop" role="presentation">
      <section className="shared-post-modal theme-token-scope" role="dialog" aria-modal="true" aria-labelledby="shared-post-title">
        <button className="shared-post-close" type="button" onClick={close} aria-label="Close shared post"><X size={19} /></button>
        {loading ? <div className="shared-post-loading"><LoadingDots /><span>Opening shared post…</span></div> :
          error && !payload ? <div className="shared-post-message"><h2 id="shared-post-title">Post unavailable</h2><p>{error}</p><button type="button" className="button button-secondary" onClick={close}>Close</button></div> :
          payload && <>
            <div className="shared-post-kicker">HALLSCHAT · SHARED POST</div>
            <div className="shared-post-author">
              <div className="shared-post-avatar">
                {payload.author.profilePicture ? <img src={payload.author.profilePicture} alt="" /> : <span>{initials(payload.author.name)}</span>}
              </div>
              <div className="shared-post-author-copy">
                <h2 id="shared-post-title" style={{ display: "inline-flex", alignItems: "center", flexWrap: "wrap", gap: 5 }}>{payload.author.name}{payload.author.isVerified && payload.author.verifiedAt && <VerificationBadge size={17} />}</h2>
                <p>@{payload.author.username}</p>
              </div>
            </div>
            {showPost && payload.post ? <div className="shared-post-content">
              {payload.post.content && <p className={payload.post.backgroundColor && !payload.post.images?.length ? "shared-post-colored-text" : ""} style={payload.post.backgroundColor && !payload.post.images?.length ? { background: payload.post.backgroundColor } : undefined}>{payload.post.content}</p>}
              {payload.post.images?.length > 0 && <div className="shared-post-images">{payload.post.images.map((src, index) => <img src={src} alt={"Post image " + (index + 1)} key={src + index} />)}</div>}
              {payload.post.poll && <div className="shared-post-poll"><strong>{payload.post.poll.question}</strong>{payload.post.poll.options.map(option => <div key={option.id}>{option.text}<span>{option.voteCount}</span></div>)}</div>}
              <div className="shared-post-stats"><span>{payload.post.likeCount} likes</span><span>{payload.post.commentCount} comments</span></div>
            </div> : <div className="shared-post-gate">
              <span className="shared-post-gate-icon">{token ? <UserPlus size={19} /> : <LockKeyhole size={19} />}</span>
              <h3>{token ? "Follow to view this post" : "Sign in to view this post"}</h3>
              <p>{token ? "HallsChat feeds are for people you follow. Follow this person to unlock their post and see their updates in your feed." : "HallsChat isn't an open public feed. Sign in to connect with people and view posts from accounts you follow."}</p>
              {token ? <button type="button" className="button button-primary shared-post-primary-action" onClick={() => void followToView()} disabled={following}>{following ? <LoadingDots /> : <><UserPlus size={16} /> Follow to view</>}</button> :
                <button type="button" className="button button-primary shared-post-primary-action" onClick={() => navigate("/signin?returnTo=" + encodeURIComponent("/post/" + postId))}>Sign in to continue <ArrowRight size={16} /></button>}
              {!token && <button type="button" className="shared-post-secondary-action" onClick={() => navigate("/signup")}>Create an account</button>}
            </div>}
            {error && <p className="shared-post-error" role="alert">{error}</p>}
          </>}
      </section>
    </div>
  </>;
}
