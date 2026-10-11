import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { ArrowUpRight, Camera, ChartNoAxesColumn, Compass, Heart, ImagePlus, MessageCircle, Plus, Send, ShieldCheck, UsersRound, UserRound, X, Trash2 } from "lucide-react";
import AppHeader from "./AppHeader";
import NowBar from "./NowBar";
import ImagePreviewModal from "./components/ImagePreviewModal";
import LoadingDots from "./components/LoadingDots";
import { navigate } from "./utils/navigate";

type Account = { id: string; name: string; username: string; email: string; createdAt?: string; profilePicture?: string };
type SocialPost = {
  id: string;
  content: string;
  images?: string[];
  poll?: { question: string; options: { id: string; text: string; voteCount: number; votedByMe: boolean }[] } | null;
  createdAt: string;
  author: { id: string; name: string; username: string } | null;
  likeCount: number;
  likedByMe: boolean;
  commentCount?: number;
};
type SocialComment = { id: string; content: string; parentId?: string | null; createdAt: string; likeCount: number; likedByMe: boolean; author: { id: string; name: string; username: string; profilePicture?: string } | null };
type SelectedImage = { file: File; preview: string };
type ImageKitAuth = { token: string; expire: number; signature: string; publicKey: string };

const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");
const MAX_IMAGES = 4;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

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

export default function HomePage() {
  const [user, setUser] = useState<Account | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState("");
  const [draft, setDraft] = useState("");
  const [composerMode, setComposerMode] = useState<"post" | "poll">("post");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [votingIds, setVotingIds] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [likingIds, setLikingIds] = useState<string[]>([]);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [openComments, setOpenComments] = useState<string[]>([]);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, SocialComment[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentsLoading, setCommentsLoading] = useState<string[]>([]);
  const [commentSending, setCommentSending] = useState<string[]>([]);
  const [replyTargets, setReplyTargets] = useState<Record<string, SocialComment | null>>({});
  const [commentLikingIds, setCommentLikingIds] = useState<string[]>([]);
  const [commentErrors, setCommentErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("hallschat_token");
    if (!token) { navigate("/signin", { replace: true }); return; }
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

  function selectImages(event: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files || []);
    event.target.value = "";
    if (!incoming.length) return;
    setFeedError("");
    const available = MAX_IMAGES - selectedImages.length;
    if (available <= 0 || incoming.length > available) {
      setFeedError(
        available <= 0
          ? `You can add up to ${MAX_IMAGES} images to a post.`
          : `You can select ${available} more image${available === 1 ? "" : "s"}; this post can contain a maximum of ${MAX_IMAGES}.`
      );
      return;
    }
    const accepted: SelectedImage[] = [];
    for (const file of incoming) {
      if (!file.type.startsWith("image/")) {
        setFeedError("Please choose image files only.");
        continue;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        setFeedError(`${file.name} is larger than 10 MB.`);
        continue;
      }
      accepted.push({ file, preview: URL.createObjectURL(file) });
    }
    setSelectedImages(current => [...current, ...accepted].slice(0, MAX_IMAGES));
  }

  function removeSelectedImage(index: number) {
    const item = selectedImages[index];
    if (item) URL.revokeObjectURL(item.preview);
    setSelectedImages(current => current.filter((_, itemIndex) => itemIndex !== index));
  }

  async function uploadImages(token: string): Promise<string[]> {
    if (!selectedImages.length) return [];

    const urls: string[] = [];
    for (let index = 0; index < selectedImages.length; index += 1) {
      const file = selectedImages[index].file;
      setUploadStatus(`Preparing image ${index + 1} of ${selectedImages.length}…`);

      // ImageKit upload tokens are single-use. Request fresh authentication for
      // every image instead of reusing one token across a multi-image post.
      const authResponse = await fetch(`${apiBase}/api/media/imagekit-auth`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const authPayload = await authResponse.json().catch(() => ({}));
      if (!authResponse.ok) {
        throw new Error(authPayload.message || `Image ${index + 1} upload could not be prepared.`);
      }
      const auth = authPayload as ImageKitAuth;
      if (!auth.token || !auth.signature || !auth.publicKey || !auth.expire) {
        throw new Error(`Image ${index + 1} upload authentication returned incomplete details.`);
      }

      setUploadStatus(`Uploading image ${index + 1} of ${selectedImages.length}…`);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fileName", file.name);
      formData.append("publicKey", auth.publicKey);
      formData.append("token", auth.token);
      formData.append("signature", auth.signature);
      formData.append("expire", String(auth.expire));
      formData.append("useUniqueFileName", "true");
      const response = await fetch("https://upload.imagekit.io/api/v1/files/upload", { method: "POST", body: formData });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || typeof payload.url !== "string") {
        throw new Error(payload.message || `Image ${index + 1} couldn't upload. Please try again.`);
      }
      urls.push(payload.url as string);
    }
    return urls;
  }

  async function publishPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    const poll = composerMode === "poll" ? { question: pollQuestion.trim(), options: pollOptions.map(option => option.trim()) } : null;
    if (composerMode === "poll" && (poll!.question.length < 3 || poll!.options.length < 2 || poll!.options.some(option => !option))) {
      setFeedError("Add a poll question and at least two options.");
      return;
    }
    if ((!content && selectedImages.length === 0 && !poll) || publishing) return;
    const token = localStorage.getItem("hallschat_token");
    if (!token) { navigate("/signin", { replace: true }); return; }
    setPublishing(true);
    setFeedError("");
    setNotice("");
    try {
      const images = await uploadImages(token);
      setUploadStatus("Publishing post…");
      const response = await fetch(`${apiBase}/api/social/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: composerMode === "post" ? content : "", images, poll })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.post) throw new Error(payload.message || "Your post couldn't be published.");
      setPosts(current => [payload.post as SocialPost, ...current]);
      setDraft("");
      setComposerMode("post");
      setPollQuestion("");
      setPollOptions(["", ""]);
      selectedImages.forEach(item => URL.revokeObjectURL(item.preview));
      setSelectedImages([]);
      setNotice("Your post is live.");
    } catch (err) {
      setFeedError(err instanceof Error ? err.message : "Your post couldn't be published.");
    } finally {
      setPublishing(false);
      setUploadStatus("");
    }
  }

  async function votePoll(post: SocialPost, optionIndex: number) {
    if (votingIds.includes(post.id)) return;
    const token = localStorage.getItem("hallschat_token");
    if (!token) { navigate("/signin", { replace: true }); return; }
    setVotingIds(current => [...current, post.id]);
    try {
      const response = await fetch(`${apiBase}/api/social/posts/${encodeURIComponent(post.id)}/vote`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ optionIndex })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(payload.options)) throw new Error(payload.message || "Your vote couldn't be saved.");
      setPosts(current => current.map(item => item.id === post.id && item.poll ? { ...item, poll: { ...item.poll, options: payload.options } } : item));
    } catch (err) {
      setFeedError(err instanceof Error ? err.message : "Your vote couldn't be saved.");
    } finally {
      setVotingIds(current => current.filter(id => id !== post.id));
    }
  }

  async function toggleComments(post: SocialPost) {
    if (openComments.includes(post.id)) {
      setOpenComments(current => current.filter(id => id !== post.id));
      return;
    }
    setOpenComments(current => [...current, post.id]);
    if (commentsByPost[post.id] || commentsLoading.includes(post.id)) return;
    const token = localStorage.getItem("hallschat_token");
    if (!token) { navigate("/signin", { replace: true }); return; }
    setCommentsLoading(current => [...current, post.id]);
    setCommentErrors(current => ({ ...current, [post.id]: "" }));
    try {
      const response = await fetch(`${apiBase}/api/social/posts/${encodeURIComponent(post.id)}/comments`, { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Comments couldn't load.");
      setCommentsByPost(current => ({ ...current, [post.id]: Array.isArray(payload.comments) ? payload.comments : [] }));
    } catch (err) {
      setCommentErrors(current => ({ ...current, [post.id]: err instanceof Error ? err.message : "Comments couldn't load." }));
    } finally {
      setCommentsLoading(current => current.filter(id => id !== post.id));
    }
  }

  async function submitComment(event: FormEvent<HTMLFormElement>, post: SocialPost) {
    event.preventDefault();
    const content = (commentDrafts[post.id] || "").trim();
    if (!content || commentSending.includes(post.id)) return;
    const token = localStorage.getItem("hallschat_token");
    if (!token) { navigate("/signin", { replace: true }); return; }
    setCommentSending(current => [...current, post.id]);
    setCommentErrors(current => ({ ...current, [post.id]: "" }));
    try {
      const response = await fetch(`${apiBase}/api/social/posts/${encodeURIComponent(post.id)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content, parentId: replyTargets[post.id]?.id || null })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.comment) throw new Error(payload.message || "Your comment couldn't be published.");
      setCommentsByPost(current => ({ ...current, [post.id]: [...(current[post.id] || []), payload.comment as SocialComment] }));
      setCommentDrafts(current => ({ ...current, [post.id]: "" }));
      setPosts(current => current.map(item => item.id === post.id ? { ...item, commentCount: Number(payload.commentCount) || (item.commentCount || 0) + 1 } : item));
    } catch (err) {
      setCommentErrors(current => ({ ...current, [post.id]: err instanceof Error ? err.message : "Your comment couldn't be published." }));
    } finally {
      setCommentSending(current => current.filter(id => id !== post.id));
    }
  }

  async function toggleCommentLike(post: SocialPost, comment: SocialComment) {
    if (commentLikingIds.includes(comment.id)) return;
    const token = localStorage.getItem("hallschat_token");
    if (!token) { navigate("/signin", { replace: true }); return; }
    setCommentLikingIds(current => [...current, comment.id]);
    try {
      const response = await fetch(`${apiBase}/api/social/posts/${encodeURIComponent(post.id)}/comments/${encodeURIComponent(comment.id)}/like`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Comment reaction couldn't be saved.");
      setCommentsByPost(current => ({
        ...current,
        [post.id]: (current[post.id] || []).map(item => item.id === comment.id
          ? { ...item, likedByMe: Boolean(payload.likedByMe), likeCount: Number(payload.likeCount) || 0 }
          : item)
      }));
    } catch (err) {
      setCommentErrors(current => ({ ...current, [post.id]: err instanceof Error ? err.message : "Comment reaction couldn't be saved." }));
    } finally {
      setCommentLikingIds(current => current.filter(id => id !== comment.id));
    }
  }

  async function deletePost(post: SocialPost) {
    if (deletingIds.includes(post.id) || post.author?.id !== user?.id) return;
    if (!window.confirm("Delete this post? This action cannot be undone.")) return;
    const token = localStorage.getItem("hallschat_token");
    if (!token) { navigate("/signin", { replace: true }); return; }
    setDeletingIds(current => [...current, post.id]);
    setFeedError("");
    try {
      const response = await fetch(`${apiBase}/api/social/posts/${encodeURIComponent(post.id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Your post couldn't be deleted.");
      setPosts(current => current.filter(item => item.id !== post.id));
      setCommentsByPost(current => { const next = { ...current }; delete next[post.id]; return next; });
      setOpenComments(current => current.filter(id => id !== post.id));
      setNotice("Your post was deleted.");
    } catch (err) {
      setFeedError(err instanceof Error ? err.message : "Your post couldn't be deleted.");
    } finally {
      setDeletingIds(current => current.filter(id => id !== post.id));
    }
  }

  async function toggleLike(post: SocialPost) {
    if (likingIds.includes(post.id)) return;
    const token = localStorage.getItem("hallschat_token");
    if (!token) { navigate("/signin", { replace: true }); return; }
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

  return <main className="home-page social-home">
    <div className="signup-glow signup-glow-top" aria-hidden="true" />
    <AppHeader homeHref="/home" />
    <section className="home-shell social-shell">
      {error ? <div className="home-state home-error"><p>{error}</p><a className="button button-primary" href="/signin">Back to sign in <ArrowUpRight size={16} /></a></div> : <>
        <div className="social-welcome">
          <div><h1>{loading ? <>Good to see you, <LoadingDots /></> : `Good to see you, ${user?.name.trim().split(/\s+/)[0] || "there"}.`}</h1><p>Share a thought, catch up with your people, and find your community.</p></div>
        </div>
        <div className="social-layout">
          <section className="social-feed-column" aria-label="Social feed">
            <form className={`social-composer ${composerMode === "poll" ? "social-composer-poll-mode" : ""}`} onSubmit={publishPost}>
              {composerMode === "post" ? <>
                <textarea id="social-post-content" value={draft} onChange={event => setDraft(event.target.value)} placeholder="What's on your mind? Share something with your HallsChat community…" rows={4} />
                {selectedImages.length > 0 && <div className="social-image-previews" aria-label="Images attached to your post">
                {selectedImages.map((item, index) => <div className="social-image-preview" key={item.preview}>
                  <button type="button" className="social-image-preview-open" onClick={() => setPreviewImage(item.preview)} aria-label={`Preview ${item.file.name}`}><img src={item.preview} alt={item.file.name} /></button>
                  <button type="button" onClick={() => removeSelectedImage(index)} aria-label={`Remove ${item.file.name}`} disabled={publishing}><X size={14} /></button>
                  <span>{item.file.name}</span>
                </div>)}
                </div>}
              </> : <div className="social-poll-builder">
                <div className="social-poll-builder-heading"><ChartNoAxesColumn size={19}/><div><strong>Create a poll</strong><span>Ask a question and let everyone vote.</span></div></div>
                <label className="social-poll-field-label" htmlFor="social-poll-question">Poll question</label>
                <textarea id="social-poll-question" className="social-poll-question" value={pollQuestion} onChange={event => setPollQuestion(event.target.value)} maxLength={240} placeholder="What do you want to ask?" rows={2} />
                <div className="social-poll-options-label"><span>Answer options</span><small>{pollOptions.length}/4</small></div>
                <div className="social-poll-option-fields">{pollOptions.map((option, index) => <div className="social-poll-option-field" key={index}><input aria-label={`Poll option ${index + 1}`} maxLength={120} value={option} onChange={event => setPollOptions(current => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} placeholder={`Option ${index + 1}`} />{pollOptions.length > 2 && <button type="button" onClick={() => setPollOptions(current => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove option ${index + 1}`}><X size={15}/></button>}</div>)}</div>
                {pollOptions.length < 4 && <button type="button" className="social-poll-add-option" onClick={() => setPollOptions(current => [...current, ""])}><Plus size={15}/> Add option</button>}
                <p className="social-image-hint">Polls are public. Each person can vote once and change their vote.</p>
              </div>}
              <div className="social-composer-bottom">
                <div className="social-composer-tools">
                  {composerMode === "post" ? <>
                    <label className={`social-add-image social-add-image-icon-only${selectedImages.length >= MAX_IMAGES || publishing ? " is-disabled" : ""}`} title="Add photos" aria-label="Add photos">
                      <Camera size={19} />
                      <input type="file" accept="image/*" multiple onChange={selectImages} disabled={selectedImages.length >= MAX_IMAGES || publishing} />
                    </label>
                    <button type="button" className="social-composer-mode-button" onClick={() => { setComposerMode("poll"); setSelectedImages(current => { current.forEach(item => URL.revokeObjectURL(item.preview)); return []; }); }} title="Create a poll" aria-label="Create a poll" disabled={publishing}><ChartNoAxesColumn size={19}/></button>
                  </> : <button type="button" className="social-composer-mode-button" onClick={() => setComposerMode("post")} title="Back to post" aria-label="Back to post" disabled={publishing}><ImagePlus size={19}/></button>}
                </div>
                <button className="social-publish" type="submit" disabled={publishing || (composerMode === "post" ? (!draft.trim() && selectedImages.length === 0) : (pollQuestion.trim().length < 3 || pollOptions.length < 2 || pollOptions.some(option => !option.trim())))}>{publishing ? <><LoadingDots /> Publishing…</> : composerMode === "poll" ? "Post poll" : "Publish"} {!publishing && <Send size={15}/>}</button>
              </div>
              {uploadStatus && <p className="social-upload-status" role="status"><LoadingDots /> {uploadStatus}</p>}
            </form>

            {notice && <p className="social-notice" role="status">{notice}</p>}
            {feedError && <div className="social-error" role="alert">{feedError}<button type="button" onClick={() => setFeedError("")} aria-label="Dismiss error">×</button></div>}
            <div className="social-feed-heading"><div><span className="signup-form-kicker">THE LATEST</span><h2>Your feed</h2></div><span className="social-feed-count">{posts.length} {posts.length === 1 ? "post" : "posts"}</span></div>
            {!feedLoading && posts.length > 0 && <div className="social-post-list">
              {posts.map(post => <article className="social-post" key={post.id}>
                <div className="social-post-head"><div className="social-avatar">{initials(post.author?.name || "HallsChat member")}</div><div className="social-post-author"><strong>{post.author?.name || "HallsChat member"}</strong><span>@{post.author?.username || "member"} · {timeAgo(post.createdAt)}</span></div>{post.author?.id === user?.id && <button type="button" className="social-post-action-muted" onClick={() => void deletePost(post)} disabled={deletingIds.includes(post.id)} aria-label="Delete your post" title="Delete post" style={{ marginLeft: "auto", color: "#ff8c9c", opacity: deletingIds.includes(post.id) ? .6 : 1 }}>{deletingIds.includes(post.id) ? <LoadingDots /> : <Trash2 size={16} />}{deletingIds.includes(post.id) ? "Deleting…" : "Delete"}</button>}</div>
                {post.content && <p className="social-post-content">{post.content}</p>}
                {post.poll && <div className="social-poll-card"><h3>{post.poll.question}</h3><div className="social-poll-results">{post.poll.options.map((option, index) => {
                  const totalVotes = post.poll!.options.reduce((sum, item) => sum + item.voteCount, 0);
                  const percent = totalVotes ? Math.round(option.voteCount / totalVotes * 100) : 0;
                  return <button type="button" key={option.id} className={`social-poll-result ${option.votedByMe ? "is-voted" : ""}`} onClick={() => votePoll(post, index)} disabled={votingIds.includes(post.id)} aria-pressed={option.votedByMe}>
                    <span className="social-poll-result-top"><span>{option.text}</span>{votingIds.includes(post.id) ? <LoadingDots /> : <strong>{percent}%</strong>}</span><span className="social-poll-result-track"><span style={{ width: `${percent}%` }}/></span><small>{option.voteCount} {option.voteCount === 1 ? "vote" : "votes"}{option.votedByMe ? " · Your vote" : ""}</small>
                  </button>;
                })}</div><p className="social-poll-total">{post.poll.options.reduce((sum, item) => sum + item.voteCount, 0)} votes · Tap an option to vote or change your vote</p></div>}
                {Array.isArray(post.images) && post.images.length > 0 && <div className={`social-post-images social-post-images-${Math.min(post.images.length, 4)}`} style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                  {post.images.map((url, index) => <button type="button" className="social-post-image-link" onClick={() => setPreviewImage(url)} aria-label={`Preview image ${index + 1} in post`} key={url}><img src={url} alt={`Image ${index + 1} in post by ${post.author?.name || "HallsChat member"}`} loading="lazy" /></button>)}
                </div>}
                <div className="social-post-actions"><button type="button" className={post.likedByMe ? "social-like is-liked" : "social-like"} onClick={() => toggleLike(post)} disabled={likingIds.includes(post.id)} aria-pressed={post.likedByMe}>{likingIds.includes(post.id) ? <LoadingDots /> : <Heart size={17} fill={post.likedByMe ? "currentColor" : "none"}/>}<span>{post.likeCount > 0 ? post.likeCount : "Like"}</span></button><button type="button" className="social-post-action-muted" onClick={() => void toggleComments(post)} aria-expanded={openComments.includes(post.id)}><MessageCircle size={16}/>{post.commentCount ? `${post.commentCount} ${post.commentCount === 1 ? "comment" : "comments"}` : "Comment"}</button></div>{openComments.includes(post.id) && <section className="social-comments-overlay" aria-label="Comments">
                  <button type="button" className="social-comments-backdrop" aria-label="Close comments" onClick={() => { setOpenComments([]); setReplyTargets(current => ({ ...current, [post.id]: null })); }} />
                  <div className="social-comments-sheet" role="dialog" aria-modal="true" aria-label="Post comments" onClick={event => event.stopPropagation()}>
                    <div className="social-comments-grabber" aria-hidden="true" />
                    <header className="social-comments-header">
                      <div><h3>Comments</h3><span>{post.commentCount || (commentsByPost[post.id] || []).length} comments</span></div>
                      <button type="button" className="social-comments-close" onClick={() => { setOpenComments([]); setReplyTargets(current => ({ ...current, [post.id]: null })); }} aria-label="Close comments"><X size={19}/></button>
                    </header>
                    <div className="social-comments-list">
                      {commentsLoading.includes(post.id) ? <div className="social-comments-state"><LoadingDots /> Loading comments…</div> : (commentsByPost[post.id] || []).filter(comment => !comment.parentId).length ? (commentsByPost[post.id] || []).filter(comment => !comment.parentId).map(comment => <div className="social-comment-thread" key={comment.id}>
                        <article className="social-comment">
                          {comment.author?.profilePicture ? <img className="social-comment-avatar" src={comment.author.profilePicture} alt="" loading="lazy" /> : <div className="social-comment-avatar">{initials(comment.author?.name || "HallsChat member")}</div>}
                          <div className="social-comment-body">
                            <div className="social-comment-bubble"><strong>{comment.author?.name || "HallsChat member"}</strong><span>{comment.content}</span></div>
                            <div className="social-comment-meta"><small>{timeAgo(comment.createdAt)}</small><button type="button" onClick={() => setReplyTargets(current => ({ ...current, [post.id]: comment }))}>Reply</button></div>
                          </div>
                          <button type="button" className={comment.likedByMe ? "social-comment-like is-liked" : "social-comment-like"} onClick={() => void toggleCommentLike(post, comment)} disabled={commentLikingIds.includes(comment.id)} aria-label={comment.likedByMe ? "Unlike comment" : "Like comment"} aria-pressed={comment.likedByMe}>{commentLikingIds.includes(comment.id) ? <LoadingDots/> : <Heart size={16} fill={comment.likedByMe ? "currentColor" : "none"}/>}<small>{comment.likeCount || ""}</small></button>
                        </article>
                        {(commentsByPost[post.id] || []).filter(reply => reply.parentId === comment.id).map(reply => <article className="social-comment social-comment-reply" key={reply.id}>
                          {reply.author?.profilePicture ? <img className="social-comment-avatar" src={reply.author.profilePicture} alt="" loading="lazy" /> : <div className="social-comment-avatar">{initials(reply.author?.name || "HallsChat member")}</div>}
                          <div className="social-comment-body"><div className="social-comment-bubble"><strong>{reply.author?.name || "HallsChat member"}</strong><span>{reply.content}</span></div><div className="social-comment-meta"><small>{timeAgo(reply.createdAt)}</small><button type="button" onClick={() => setReplyTargets(current => ({ ...current, [post.id]: comment }))}>Reply</button></div></div>
                          <button type="button" className={reply.likedByMe ? "social-comment-like is-liked" : "social-comment-like"} onClick={() => void toggleCommentLike(post, reply)} disabled={commentLikingIds.includes(reply.id)} aria-label={reply.likedByMe ? "Unlike reply" : "Like reply"} aria-pressed={reply.likedByMe}>{commentLikingIds.includes(reply.id) ? <LoadingDots/> : <Heart size={16} fill={reply.likedByMe ? "currentColor" : "none"}/>}<small>{reply.likeCount || ""}</small></button>
                        </article>)}
                      </div>) : !commentErrors[post.id] && !commentsLoading.includes(post.id) ? <p className="social-comments-empty">No comments yet. Start the conversation.</p> : null}
                    </div>
                    {commentErrors[post.id] && <p className="social-comment-error" role="alert">{commentErrors[post.id]} <button type="button" onClick={() => { setCommentErrors(current => ({ ...current, [post.id]: "" })); setCommentsByPost(current => { const next = { ...current }; delete next[post.id]; return next; }); void toggleComments(post); }}>Try again</button></p>}
                    <div className="social-comments-composer-wrap">
                      {replyTargets[post.id] && <div className="social-replying-to"><span>Replying to <strong>@{replyTargets[post.id]?.author?.username || "member"}</strong></span><button type="button" onClick={() => setReplyTargets(current => ({ ...current, [post.id]: null }))} aria-label="Cancel reply"><X size={14}/></button></div>}
                      <form className="social-comment-form" onSubmit={event => void submitComment(event, post)}>
                        {user?.profilePicture ? <img className="social-comment-compose-avatar" src={user.profilePicture} alt="" /> : <div className="social-comment-compose-avatar">{initials(user?.name || "You")}</div>}
                        <textarea value={commentDrafts[post.id] || ""} onChange={event => setCommentDrafts(current => ({ ...current, [post.id]: event.target.value }))} placeholder={replyTargets[post.id] ? "Write a reply…" : "Add a comment…"} rows={1} maxLength={2000} aria-label={replyTargets[post.id] ? "Write a reply" : "Write a comment"} />
                        <button type="submit" disabled={!(commentDrafts[post.id] || "").trim() || commentSending.includes(post.id)} aria-label={replyTargets[post.id] ? "Publish reply" : "Publish comment"}>{commentSending.includes(post.id) ? <LoadingDots /> : <Send size={17} />}</button>
                      </form>
                    </div>
                  </div>
                </section>}
              </article>)}
            </div>}
            {!feedLoading && posts.length === 0 && !feedError && <div className="social-empty-feed"><ImagePlus size={22}/><strong>Your feed starts here</strong><span>Share a thought or photo with your community.</span></div>}
            {feedLoading && <div className="social-empty-feed" role="status"><LoadingDots /><span>Loading your feed…</span></div>}
          </section>
        </div>
      </>}
    </section>
    {previewImage && <ImagePreviewModal imageUrl={previewImage} onClose={() => setPreviewImage(null)} />}
    <NowBar />
  </main>;
}
