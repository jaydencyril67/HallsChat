import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ArrowUpRight, Camera, ChartNoAxesColumn, Compass, Download, Heart, ImagePlus, MessageCircle, Plus, Send, ShieldCheck, UsersRound, UserRound, X, Trash2, Pencil, Check, MoreHorizontal } from "lucide-react";
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
  author: { id: string; name: string; username: string; profilePicture?: string } | null;
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

async function compressPostImage(file: File): Promise<File> {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error(`Could not read ${file.name}.`));
      element.src = sourceUrl;
    });
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Unable to prepare this image.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const toBlob = (type: string, quality: number) => new Promise<Blob | null>(resolve => canvas.toBlob(resolve, type, quality));
    let blob = await toBlob("image/webp", 0.82);
    let type = "image/webp";
    if (!blob || blob.type !== "image/webp") {
      blob = await toBlob("image/jpeg", 0.82);
      type = "image/jpeg";
    }
    if (!blob) throw new Error(`Unable to compress ${file.name}.`);
    // Keep the original when compression would make the file larger.
    if (blob.size >= file.size && scale === 1) return file;
    const baseName = file.name.replace(/\.[^.]+$/, "") || "hallschat-image";
    const extension = type === "image/webp" ? "webp" : "jpg";
    return new File([blob], `${baseName}.${extension}`, { type, lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

function renderTextWithLinks(value: string): ReactNode {
  const pattern = /(?:https?:\/\/|www\.)[^\s<>]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value)) !== null) {
    let visible = match[0];
    let trailing = "";
    while (/[.,!?;:)]$/.test(visible)) {
      trailing = visible.slice(-1) + trailing;
      visible = visible.slice(0, -1);
    }
    if (!visible) continue;
    if (match.index > lastIndex) parts.push(value.slice(lastIndex, match.index));
    const href = visible.includes("@") && !/^https?:\/\//i.test(visible)
      ? `mailto:${visible}`
      : /^www\./i.test(visible) ? `https://${visible}` : visible;
    parts.push(<a className="social-text-link" href={href} target="_blank" rel="noopener noreferrer" key={`${match.index}-${visible}`}>{visible}</a>);
    if (trailing) parts.push(trailing);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < value.length) parts.push(value.slice(lastIndex));
  return parts;
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
  const [compressingImages, setCompressingImages] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [likingIds, setLikingIds] = useState<string[]>([]);
  const [deletingIds, setDeletingIds] = useState<string[]>([]);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [postActionMenuId, setPostActionMenuId] = useState<string | null>(null);
  const [downloadingPostIds, setDownloadingPostIds] = useState<string[]>([]);
  const [editPostDraft, setEditPostDraft] = useState("");
  const [savingPostIds, setSavingPostIds] = useState<string[]>([]);
  const [postDeleteConfirmId, setPostDeleteConfirmId] = useState<string | null>(null);
  const [openComments, setOpenComments] = useState<string[]>([]);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, SocialComment[]>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentsLoading, setCommentsLoading] = useState<string[]>([]);
  const [commentSending, setCommentSending] = useState<string[]>([]);
  const [replyTargets, setReplyTargets] = useState<Record<string, SocialComment | null>>({});
  const [commentLikingIds, setCommentLikingIds] = useState<string[]>([]);
  const [commentDeletingIds, setCommentDeletingIds] = useState<string[]>([]);
  const [commentDeleteConfirmId, setCommentDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (!commentDeleteConfirmId && !postDeleteConfirmId && !postActionMenuId) return;
    const closeDeletePopoutsOutside = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".social-comment-delete-wrap, .social-post-delete-wrap")) return;
      setCommentDeleteConfirmId(null);
      setPostDeleteConfirmId(null);
      setPostActionMenuId(null);
    };
    document.addEventListener("pointerdown", closeDeletePopoutsOutside);
    return () => document.removeEventListener("pointerdown", closeDeletePopoutsOutside);
  }, [commentDeleteConfirmId, postDeleteConfirmId, postActionMenuId]);
  const [commentErrors, setCommentErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  useEffect(() => {
    if (!notice && !feedError && !Object.values(commentErrors).some(Boolean)) return;
    const timer = window.setTimeout(() => {
      setNotice("");
      setFeedError("");
      setCommentErrors(current => Object.fromEntries(Object.keys(current).map(id => [id, ""])));
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [notice, feedError, commentErrors]);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("hallschat_token");
    if (!token) { navigate("/signin", { replace: true }); return; }
    fetch(`${apiBase}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem("hallschat_token");
          navigate("/signin", { replace: true });
          return null;
        }
        if (!response.ok) throw new Error(payload.message || "Account information is temporarily unavailable.");
        if (!payload.user || typeof payload.user.name !== "string" || typeof payload.user.email !== "string") {
          throw new Error("We couldn't read your account details.");
        }
        return payload.user as Account;
      })
      .then(account => { if (!cancelled && account) setUser(account); })
      .catch(err => {
        if (cancelled) return;
        // Keep the saved token for transient network/server failures. It is
        // removed only when the backend definitively rejects the session.
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

  async function selectImages(event: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files || []);
    event.target.value = "";
    if (!incoming.length || compressingImages || publishing) return;
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
    const accepted: File[] = [];
    for (const file of incoming) {
      if (!file.type.startsWith("image/")) {
        setFeedError("Please choose image files only.");
        continue;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        setFeedError(`${file.name} is larger than 10 MB.`);
        continue;
      }
      accepted.push(file);
    }
    if (!accepted.length) return;
    setCompressingImages(true);
    setUploadStatus("Compressing images…");
    try {
      const compressed = await Promise.all(accepted.map(compressPostImage));
      setSelectedImages(current => [...current, ...compressed.map(file => ({ file, preview: URL.createObjectURL(file) }))].slice(0, MAX_IMAGES));
    } catch (err) {
      setFeedError(err instanceof Error ? err.message : "One or more images couldn't be prepared.");
    } finally {
      setCompressingImages(false);
      setUploadStatus("");
    }
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
    if ((!content && selectedImages.length === 0 && !poll) || publishing || compressingImages) return;
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

  async function deleteComment(post: SocialPost, comment: SocialComment) {
    if (commentDeletingIds.includes(comment.id) || comment.author?.id !== user?.id) return;
    const token = localStorage.getItem("hallschat_token");
    if (!token) { navigate("/signin", { replace: true }); return; }
    setCommentDeletingIds(current => [...current, comment.id]);
    setCommentErrors(current => ({ ...current, [post.id]: "" }));
    try {
      const response = await fetch(`${apiBase}/api/social/posts/${encodeURIComponent(post.id)}/comments/${encodeURIComponent(comment.id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Your comment couldn't be deleted.");
      const deletedIds = new Set<string>(
        Array.isArray(payload.deletedCommentIds)
          ? payload.deletedCommentIds.map((id: unknown) => String(id))
          : [comment.id]
      );
      setCommentsByPost(current => ({
        ...current,
        [post.id]: (current[post.id] || []).filter(item => !deletedIds.has(item.id))
      }));
      setReplyTargets(current => ({
        ...current,
        [post.id]: current[post.id] && deletedIds.has(current[post.id]!.id) ? null : current[post.id]
      }));
      setPosts(current => current.map(item => item.id === post.id
        ? { ...item, commentCount: typeof payload.commentCount === "number" ? payload.commentCount : Math.max(0, (item.commentCount || 0) - deletedIds.size) }
        : item));
      setCommentDeleteConfirmId(null);
      setNotice("Your comment was deleted.");
    } catch (err) {
      setCommentErrors(current => ({ ...current, [post.id]: err instanceof Error ? err.message : "Your comment couldn't be deleted." }));
    } finally {
      setCommentDeletingIds(current => current.filter(id => id !== comment.id));
    }
  }

  async function deletePost(post: SocialPost) {
    if (deletingIds.includes(post.id) || post.author?.id !== user?.id) return;
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

  function beginEditPost(post: SocialPost) {
    setEditingPostId(post.id);
    setPostActionMenuId(null);
    setEditPostDraft(post.content || "");
    setPostDeleteConfirmId(null);
    setFeedError("");
  }

  async function savePostEdit(post: SocialPost) {
    if (savingPostIds.includes(post.id) || post.author?.id !== user?.id) return;
    const content = editPostDraft.trim();
    if (!content && !(post.images?.length)) {
      setFeedError("A post must contain text or at least one image.");
      return;
    }
    const token = localStorage.getItem("hallschat_token");
    if (!token) { navigate("/signin", { replace: true }); return; }
    setSavingPostIds(current => [...current, post.id]);
    setFeedError("");
    try {
      const response = await fetch(`${apiBase}/api/social/posts/${encodeURIComponent(post.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.post) throw new Error(payload.message || "Your post edits couldn't be saved.");
      setPosts(current => current.map(item => item.id === post.id ? { ...item, content: payload.post.content } : item));
      setEditingPostId(null);
      setEditPostDraft("");
      setNotice("Your post was updated.");
    } catch (err) {
      setFeedError(err instanceof Error ? err.message : "Your post edits couldn't be saved.");
    } finally {
      setSavingPostIds(current => current.filter(id => id !== post.id));
    }
  }

  async function downloadPost(post: SocialPost) {
    if (deletingIds.includes(post.id) || downloadingPostIds.includes(post.id)) return;
    setDownloadingPostIds(current => [...current, post.id]);
    setPostActionMenuId(null);
    setFeedError("");
    try {
      const lines = [
        `HallsChat post by ${post.author?.name || "HallsChat member"} (@${post.author?.username || "member"})`,
        `Posted: ${new Date(post.createdAt).toLocaleString()}`,
        "",
        post.content || ""
      ];
      if (post.poll) {
        lines.push("", `Poll: ${post.poll.question}`);
        post.poll.options.forEach(option => lines.push(`- ${option.text} (${option.voteCount} votes)`));
      }
      if (post.images?.length) lines.push("", `Attached images: ${post.images.length} (downloaded separately)`);
      const textBlob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
      const textUrl = URL.createObjectURL(textBlob);
      const textLink = document.createElement("a");
      textLink.href = textUrl;
      textLink.download = `hallschat-post-${post.id}.txt`;
      document.body.appendChild(textLink);
      textLink.click();
      textLink.remove();
      window.setTimeout(() => URL.revokeObjectURL(textUrl), 1000);

      for (let index = 0; index < (post.images || []).length; index += 1) {
        const imageUrl = post.images![index];
        const response = await fetch(imageUrl, { mode: "cors" });
        if (!response.ok) throw new Error(`Image ${index + 1} couldn't be downloaded. Please open the image and save it manually.`);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const extension = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : blob.type.includes("gif") ? "gif" : "jpg";
        link.href = blobUrl;
        link.download = `hallschat-post-${post.id}-image-${index + 1}.${extension}`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
      }
      setNotice(post.images?.length ? "Post text and image download started." : "Post downloaded as a text file.");
    } catch (err) {
      setFeedError(err instanceof Error ? err.message : "This post couldn't be downloaded.");
    } finally {
      setDownloadingPostIds(current => current.filter(id => id !== post.id));
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
                      <input type="file" accept="image/*" multiple onChange={selectImages} disabled={selectedImages.length >= MAX_IMAGES || publishing || compressingImages} />
                    </label>
                    <button type="button" className="social-composer-mode-button" onClick={() => { setComposerMode("poll"); setSelectedImages(current => { current.forEach(item => URL.revokeObjectURL(item.preview)); return []; }); }} title="Create a poll" aria-label="Create a poll" disabled={publishing || compressingImages}><ChartNoAxesColumn size={19}/></button>
                  </> : <button type="button" className="social-composer-mode-button" onClick={() => setComposerMode("post")} title="Back to post" aria-label="Back to post" disabled={publishing}><ImagePlus size={19}/></button>}
                </div>
                <button className="social-publish" type="submit" disabled={publishing || compressingImages || (composerMode === "post" ? (!draft.trim() && selectedImages.length === 0) : (pollQuestion.trim().length < 3 || pollOptions.length < 2 || pollOptions.some(option => !option.trim())))}>{compressingImages ? <><LoadingDots /> Preparing images…</> : publishing ? <><LoadingDots /> Publishing…</> : composerMode === "poll" ? "Post poll" : "Publish"} {!publishing && !compressingImages && <Send size={15}/>}</button>
              </div>
              {uploadStatus && <p className="social-upload-status" role="status"><LoadingDots /> {uploadStatus}</p>}
            </form>

            <div className="social-feed-heading"><div><span className="signup-form-kicker">THE LATEST</span><h2>Your feed</h2></div><span className="social-feed-count">{posts.length} {posts.length === 1 ? "post" : "posts"}</span></div>
            {!feedLoading && posts.length > 0 && <div className="social-post-list">
              {posts.map(post => <article className="social-post" key={post.id}>
                <div className="social-post-head">{post.author?.profilePicture ? <button type="button" className="social-avatar" onClick={() => post.author?.id && navigate("/users/" + encodeURIComponent(post.author.id))} aria-label={"View " + (post.author?.name || "member") + " profile"} style={{ border: 0, padding: 0, overflow: "hidden", cursor: "pointer" }}><img src={post.author.profilePicture} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></button> : <button type="button" className="social-avatar" onClick={() => post.author?.id && navigate("/users/" + encodeURIComponent(post.author.id))} aria-label={"View " + (post.author?.name || "member") + " profile"} style={{ border: 0, padding: 0, cursor: "pointer" }}>{initials(post.author?.name || "HallsChat member")}</button>}<button type="button" className="social-post-author" onClick={() => post.author?.id && navigate("/users/" + encodeURIComponent(post.author.id))} style={{ padding: 0, border: 0, background: "transparent", color: "inherit", textAlign: "left", cursor: "pointer" }}><strong>{post.author?.name || "HallsChat member"}</strong><span>@{post.author?.username || "member"} · {timeAgo(post.createdAt)}</span></button><div className="social-post-delete-wrap" style={{ position: "relative", marginLeft: "auto", flexShrink: 0 }}>
<button type="button" className="social-post-action-muted" onClick={() => { setPostActionMenuId(current => current === post.id ? null : post.id); setPostDeleteConfirmId(null); }} aria-label="Post options" aria-expanded={postActionMenuId === post.id} title="Post options" style={{ width: 36, height: 36, minWidth: 36, padding: 0, display: "grid", placeItems: "center", border: "1px solid rgba(255,210,219,.12)", borderRadius: 10, background: "rgba(255,255,255,.045)", color: "#f2dce1", cursor: "pointer" }}><MoreHorizontal size={19} /></button>
{postActionMenuId === post.id && <div role="menu" aria-label="Post options" style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 9, width: 176, padding: 6, display: "grid", gap: 4, border: "1px solid rgba(255,210,219,.16)", borderRadius: 12, background: "linear-gradient(145deg,rgba(57,17,27,.98),rgba(28,9,15,.99))", boxShadow: "0 10px 28px rgba(0,0,0,.42)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
<button type="button" role="menuitem" onClick={() => void downloadPost(post)} disabled={downloadingPostIds.includes(post.id)} style={{ minHeight: 36, display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", border: 0, borderRadius: 8, background: "transparent", color: "#f2dce1", textAlign: "left", cursor: "pointer", fontSize: ".8rem" }}>{downloadingPostIds.includes(post.id) ? <LoadingDots /> : <Download size={15} />} Download post</button>
{post.author?.id === user?.id && !post.poll && Date.now() - new Date(post.createdAt).getTime() <= 24 * 60 * 60 * 1000 && <button type="button" role="menuitem" onClick={() => beginEditPost(post)} disabled={savingPostIds.includes(post.id)} style={{ minHeight: 36, display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", border: 0, borderRadius: 8, background: "transparent", color: "#f2dce1", textAlign: "left", cursor: "pointer", fontSize: ".8rem" }}><Pencil size={15} /> Edit post</button>}
{post.author?.id === user?.id && <button type="button" role="menuitem" onClick={() => { setPostActionMenuId(null); setPostDeleteConfirmId(post.id); }} disabled={deletingIds.includes(post.id)} style={{ minHeight: 36, display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", border: 0, borderRadius: 8, background: "transparent", color: "#ff8192", textAlign: "left", cursor: "pointer", fontSize: ".8rem" }}><Trash2 size={15} /> Delete post</button>}
</div>}
{post.author?.id === user?.id && postDeleteConfirmId === post.id && <div role="alertdialog" aria-label="Confirm post deletion" style={{ position: "absolute", right: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)", zIndex: 8, width: 188, boxSizing: "border-box", padding: 11, border: "1px solid rgba(255,210,219,.2)", borderRadius: 13, background: "linear-gradient(145deg,rgba(57,17,27,.98),rgba(28,9,15,.99))", boxShadow: "0 10px 28px rgba(0,0,0,.42)", color: "#fff0f3", textAlign: "left", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}><div style={{ fontSize: ".76rem", fontWeight: 750, lineHeight: 1.4 }}>Delete this post?</div><div style={{ fontSize: ".7rem", marginTop: 4, color: "#e8c6ce" }}>This action cannot be undone.</div><div style={{ display: "flex", gap: 6, marginTop: 9 }}><button type="button" onClick={() => setPostDeleteConfirmId(null)} style={{ flex: 1, minHeight: 29, padding: "5px 7px", border: "1px solid rgba(255,210,219,.15)", borderRadius: 8, background: "rgba(255,255,255,.06)", color: "#f5dce1", fontSize: ".7rem" }}>Cancel</button><button type="button" onClick={() => { setPostDeleteConfirmId(null); void deletePost(post); }} style={{ flex: 1, minHeight: 29, padding: "5px 7px", border: 0, borderRadius: 8, background: "#b92d45", color: "#fff", fontSize: ".7rem", fontWeight: 750 }}>Delete</button></div></div>}</div>}</div>
                {editingPostId === post.id ? <form onSubmit={event => { event.preventDefault(); void savePostEdit(post); }} style={{ display: "grid", gap: 9, margin: "0 0 12px" }}><textarea value={editPostDraft} onChange={event => setEditPostDraft(event.target.value)} maxLength={5000} rows={Math.max(3, Math.min(8, editPostDraft.split("\n").length + 1))} aria-label="Edit post text" autoFocus style={{ width: "100%", boxSizing: "border-box", resize: "vertical", padding: 12, border: "1px solid rgba(255,210,219,.2)", borderRadius: 12, background: "rgba(0,0,0,.22)", color: "#f6e7ea", font: "inherit", lineHeight: 1.6 }} /><div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button type="button" onClick={() => { setEditingPostId(null); setEditPostDraft(""); }} disabled={savingPostIds.includes(post.id)} style={{ minHeight: 34, padding: "7px 12px", border: "1px solid rgba(255,210,219,.16)", borderRadius: 9, background: "rgba(255,255,255,.04)", color: "#f4dfe3", fontSize: ".78rem" }}>Cancel</button><button type="submit" disabled={savingPostIds.includes(post.id) || editPostDraft.trim() === (post.content || "").trim()} style={{ minHeight: 34, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "7px 12px", border: 0, borderRadius: 9, background: "#b92d45", color: "#fff", fontSize: ".78rem", fontWeight: 750 }}>{savingPostIds.includes(post.id) ? <LoadingDots /> : <Check size={14} />} Save changes</button></div></form> : post.content && <p className="social-post-content">{renderTextWithLinks(post.content)}</p>}
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
                          {comment.author?.id ? <button type="button" className="social-comment-avatar" onClick={() => navigate("/users/" + encodeURIComponent(comment.author!.id))} aria-label={"View " + (comment.author.name || "member") + " profile"} style={{ padding: 0, cursor: "pointer" }}>{comment.author.profilePicture ? <img src={comment.author.profilePicture} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} /> : initials(comment.author.name || "HallsChat member")}</button> : comment.author?.profilePicture ? <img className="social-comment-avatar" src={comment.author.profilePicture} alt="" loading="lazy" /> : <div className="social-comment-avatar">{initials(comment.author?.name || "HallsChat member")}</div>}
                          <div className="social-comment-body">
                            <div className="social-comment-bubble"><strong>{comment.author?.name || "HallsChat member"}</strong><span>{renderTextWithLinks(comment.content)}</span></div>
                            <div className="social-comment-meta"><small>{timeAgo(comment.createdAt)}</small><button type="button" onClick={() => setReplyTargets(current => ({ ...current, [post.id]: comment }))}>Reply</button></div>
                          </div>
                          <button type="button" className={comment.likedByMe ? "social-comment-like is-liked" : "social-comment-like"} onClick={() => void toggleCommentLike(post, comment)} disabled={commentLikingIds.includes(comment.id)} aria-label={comment.likedByMe ? "Unlike comment" : "Like comment"} aria-pressed={comment.likedByMe}>{commentLikingIds.includes(comment.id) ? <LoadingDots/> : <Heart size={16} fill={comment.likedByMe ? "currentColor" : "none"}/>}<small>{comment.likeCount || ""}</small></button>{comment.author?.id === user?.id && <div className="social-comment-delete-wrap"><button type="button" className="social-comment-delete" onClick={() => setCommentDeleteConfirmId(current => current === comment.id ? null : comment.id)} disabled={commentDeletingIds.includes(comment.id)} aria-label="Delete your comment" title="Delete comment">{commentDeletingIds.includes(comment.id) ? <LoadingDots /> : <Trash2 size={14} />}</button>{commentDeleteConfirmId === comment.id && <div className="social-comment-delete-confirm" role="alertdialog" aria-label="Confirm comment deletion"><strong>Delete comment?</strong><span>{(commentsByPost[post.id] || []).some(item => item.parentId === comment.id) ? "Its replies will also be removed." : "This action cannot be undone."}</span><div><button type="button" onClick={() => setCommentDeleteConfirmId(null)}>Cancel</button><button type="button" onClick={() => void deleteComment(post, comment)}>Delete</button></div></div>}</div>}
                        </article>
                        {(commentsByPost[post.id] || []).filter(reply => reply.parentId === comment.id).map(reply => <article className="social-comment social-comment-reply" key={reply.id}>
                          {reply.author?.id ? <button type="button" className="social-comment-avatar" onClick={() => navigate("/users/" + encodeURIComponent(reply.author!.id))} aria-label={"View " + (reply.author.name || "member") + " profile"} style={{ padding: 0, cursor: "pointer" }}>{reply.author.profilePicture ? <img src={reply.author.profilePicture} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} /> : initials(reply.author.name || "HallsChat member")}</button> : reply.author?.profilePicture ? <img className="social-comment-avatar" src={reply.author.profilePicture} alt="" loading="lazy" /> : <div className="social-comment-avatar">{initials(reply.author?.name || "HallsChat member")}</div>}
                          <div className="social-comment-body"><div className="social-comment-bubble"><strong>{reply.author?.name || "HallsChat member"}</strong><span>{renderTextWithLinks(reply.content)}</span></div><div className="social-comment-meta"><small>{timeAgo(reply.createdAt)}</small><button type="button" onClick={() => setReplyTargets(current => ({ ...current, [post.id]: comment }))}>Reply</button></div></div>
                          <button type="button" className={reply.likedByMe ? "social-comment-like is-liked" : "social-comment-like"} onClick={() => void toggleCommentLike(post, reply)} disabled={commentLikingIds.includes(reply.id)} aria-label={reply.likedByMe ? "Unlike reply" : "Like reply"} aria-pressed={reply.likedByMe}>{commentLikingIds.includes(reply.id) ? <LoadingDots/> : <Heart size={16} fill={reply.likedByMe ? "currentColor" : "none"}/>}<small>{reply.likeCount || ""}</small></button>{reply.author?.id === user?.id && <div className="social-comment-delete-wrap"><button type="button" className="social-comment-delete" onClick={() => setCommentDeleteConfirmId(current => current === reply.id ? null : reply.id)} disabled={commentDeletingIds.includes(reply.id)} aria-label="Delete your reply" title="Delete reply">{commentDeletingIds.includes(reply.id) ? <LoadingDots /> : <Trash2 size={14} />}</button>{commentDeleteConfirmId === reply.id && <div className="social-comment-delete-confirm" role="alertdialog" aria-label="Confirm reply deletion"><strong>Delete reply?</strong><span>This action cannot be undone.</span><div><button type="button" onClick={() => setCommentDeleteConfirmId(null)}>Cancel</button><button type="button" onClick={() => void deleteComment(post, reply)}>Delete</button></div></div>}</div>}
                        </article>)}
                      </div>) : commentsByPost[post.id] && !commentErrors[post.id] && !commentsLoading.includes(post.id) ? <p className="social-comments-empty">No comments yet. Start the conversation.</p> : null}
                    </div>
                    <div className="social-comments-composer-wrap">
                      {replyTargets[post.id] && <div className="social-replying-to"><span>Replying to <strong>@{replyTargets[post.id]?.author?.username || "member"}</strong></span><button type="button" onClick={() => setReplyTargets(current => ({ ...current, [post.id]: null }))} aria-label="Cancel reply"><X size={14}/></button></div>}
                      <form className="social-comment-form" onSubmit={event => void submitComment(event, post)}>
                        <button type="button" className="social-comment-compose-avatar-link" onClick={() => navigate("/profile")} aria-label="View your profile">{user?.profilePicture ? <img className="social-comment-compose-avatar" src={user.profilePicture} alt="" /> : <span className="social-comment-compose-avatar">{initials(user?.name || "You")}</span>}</button>
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
    {(feedError || Object.values(commentErrors).find(Boolean) || notice) && <div className={`halls-toast ${(feedError || Object.values(commentErrors).some(Boolean)) ? "halls-toast-error" : "halls-toast-success"}`} role={(feedError || Object.values(commentErrors).some(Boolean)) ? "alert" : "status"}>
      <span>{feedError || Object.values(commentErrors).find(Boolean) || notice}</span>
      <button type="button" onClick={() => { setNotice(""); setFeedError(""); setCommentErrors(current => Object.fromEntries(Object.keys(current).map(id => [id, ""]))); }} aria-label="Dismiss notification">×</button>
    </div>}
    {previewImage && <ImagePreviewModal imageUrl={previewImage} onClose={() => setPreviewImage(null)} />}
    <NowBar />
  </main>;
}
