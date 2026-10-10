import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { ArrowUpRight, Compass, Heart, ImagePlus, MessageCircle, Send, ShieldCheck, UsersRound, UserRound, X } from "lucide-react";
import AppHeader from "./AppHeader";
import NowBar from "./NowBar";
import ImagePreviewModal from "./components/ImagePreviewModal";
import { navigate } from "./utils/navigate";

type Account = { id: string; name: string; username: string; email: string; createdAt?: string };
type SocialPost = {
  id: string;
  content: string;
  images?: string[];
  createdAt: string;
  author: { id: string; name: string; username: string } | null;
  likeCount: number;
  likedByMe: boolean;
};
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
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState("");
  const [draft, setDraft] = useState("");
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [likingIds, setLikingIds] = useState<string[]>([]);
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
    if (available <= 0) {
      setFeedError(`You can add up to ${MAX_IMAGES} images to a post.`);
      return;
    }
    const accepted: SelectedImage[] = [];
    for (const file of incoming.slice(0, available)) {
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
    setUploadStatus("Preparing secure upload…");
    const authResponse = await fetch(`${apiBase}/api/media/imagekit-auth`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const authPayload = await authResponse.json().catch(() => ({}));
    if (!authResponse.ok) throw new Error(authPayload.message || "Image upload could not be prepared.");
    const auth = authPayload as ImageKitAuth;
    if (!auth.token || !auth.signature || !auth.publicKey || !auth.expire) {
      throw new Error("Image upload authentication returned incomplete details.");
    }

    const urls: string[] = [];
    for (let index = 0; index < selectedImages.length; index += 1) {
      const file = selectedImages[index].file;
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
    if ((!content && selectedImages.length === 0) || publishing) return;
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
        body: JSON.stringify({ content, images })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.post) throw new Error(payload.message || "Your post couldn't be published.");
      setPosts(current => [payload.post as SocialPost, ...current]);
      setDraft("");
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
      {loading ? <div className="home-state" role="status">Getting your space ready…</div> : error ? <div className="home-state home-error"><p>{error}</p><a className="button button-primary" href="/signin">Back to sign in <ArrowUpRight size={16} /></a></div> : user && <>
        <div className="social-welcome">
          <div><h1>Good to see you, {user.name.trim().split(/\s+/)[0] || "there"}.</h1><p>Share a thought, catch up with your people, and find your community.</p></div>
        </div>
        <div className="social-layout">
          <section className="social-feed-column" aria-label="Social feed">
            <form className="social-composer" onSubmit={publishPost}>
              <textarea id="social-post-content" value={draft} onChange={event => setDraft(event.target.value)} maxLength={2000} placeholder="What's on your mind? Share something with your HallsChat community…" rows={4} />
              {selectedImages.length > 0 && <div className="social-image-previews" aria-label="Images attached to your post">
                {selectedImages.map((item, index) => <div className="social-image-preview" key={item.preview}>
                  <button type="button" className="social-image-preview-open" onClick={() => setPreviewImage(item.preview)} aria-label={`Preview ${item.file.name}`}><img src={item.preview} alt={item.file.name} /></button>
                  <button type="button" onClick={() => removeSelectedImage(index)} aria-label={`Remove ${item.file.name}`} disabled={publishing}><X size={14} /></button>
                  <span>{item.file.name}</span>
                </div>)}
              </div>}
              <div className="social-composer-bottom">
                <div className="social-composer-tools">
                  <label className={`social-add-image${selectedImages.length >= MAX_IMAGES || publishing ? " is-disabled" : ""}`} title="Add images">
                    <ImagePlus size={17} /><span>Add image</span>
                    <input type="file" accept="image/*" multiple onChange={selectImages} disabled={selectedImages.length >= MAX_IMAGES || publishing} />
                  </label>
                </div>
                <span className="social-char-count">{draft.length}/2000</span>
                <button className="social-publish" type="submit" disabled={(!draft.trim() && selectedImages.length === 0) || publishing}>{publishing ? "Publishing…" : "Publish"} <Send size={15}/></button>
              </div>
              <p className="social-image-hint">Up to 4 images · 10 MB each</p>
              {uploadStatus && <p className="social-upload-status" role="status">{uploadStatus}</p>}
            </form>

            {notice && <p className="social-notice" role="status">{notice}</p>}
            {feedError && <div className="social-error" role="alert">{feedError}<button type="button" onClick={() => setFeedError("")} aria-label="Dismiss error">×</button></div>}
            <div className="social-feed-heading"><div><span className="signup-form-kicker">THE LATEST</span><h2>Your feed</h2></div><span className="social-feed-count">{posts.length} {posts.length === 1 ? "post" : "posts"}</span></div>
            {!feedLoading && posts.length > 0 && <div className="social-post-list">
              {posts.map(post => <article className="social-post" key={post.id}>
                <div className="social-post-head"><div className="social-avatar">{initials(post.author?.name || "HallsChat member")}</div><div className="social-post-author"><strong>{post.author?.name || "HallsChat member"}</strong><span>@{post.author?.username || "member"} · {timeAgo(post.createdAt)}</span></div></div>
                {post.content && <p className="social-post-content">{post.content}</p>}
                {Array.isArray(post.images) && post.images.length > 0 && <div className={`social-post-images social-post-images-${Math.min(post.images.length, 4)}`} style={{ gridTemplateColumns: `repeat(${Math.min(post.images.length, 4)}, minmax(0, 1fr))` }}>
                  {post.images.map((url, index) => <button type="button" className="social-post-image-link" onClick={() => setPreviewImage(url)} aria-label={`Preview image ${index + 1} in post`} key={url}><img src={url} alt={`Image ${index + 1} in post by ${post.author?.name || "HallsChat member"}`} loading="lazy" /></button>)}
                </div>}
                <div className="social-post-actions"><button type="button" className={post.likedByMe ? "social-like is-liked" : "social-like"} onClick={() => toggleLike(post)} disabled={likingIds.includes(post.id)} aria-pressed={post.likedByMe}><Heart size={17} fill={post.likedByMe ? "currentColor" : "none"}/><span>{post.likeCount > 0 ? post.likeCount : "Like"}</span></button><span className="social-post-action-muted"><MessageCircle size={16}/> Comments coming next</span></div>
              </article>)}
            </div>}
            {!feedLoading && posts.length === 0 && !feedError && <div className="social-empty-feed"><ImagePlus size={22}/><strong>Your feed starts here</strong><span>Share a thought or photo with your community.</span></div>}
            {feedLoading && <div className="social-empty-feed" role="status">Loading your feed…</div>}
          </section>
        </div>
      </>}
    </section>
    {previewImage && <ImagePreviewModal imageUrl={previewImage} onClose={() => setPreviewImage(null)} />}
    <NowBar />
  </main>;
}
