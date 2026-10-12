import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { ReactNode } from "react";
import { ArrowUpRight, Camera, ChartNoAxesColumn, Compass, Download, Heart, ImagePlus, MessageCircle, Plus, Send, ShieldCheck, UsersRound, UserRound, X, Trash2, Pencil, Check, MoreHorizontal, Eye, Palette, CaseSensitive, Type } from "lucide-react";
import AppHeader from "./AppHeader";
import NowBar from "./NowBar";
import ImagePreviewModal from "./components/ImagePreviewModal";
import StoryImageCropModal from "./components/StoryImageCropModal";
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
type ImageKitAuth = { token: string; expire: number; signature: string; publicKey: string; message?: string };
type StoryTextSection = { id: string; text: string; x: number; y: number; fontSize?: number; color?: string };
type SocialStory = { id: string; text: string; textSections?: StoryTextSection[]; mediaUrl?: string; background?: string; textPosition?: { x: number; y: number }; createdAt: string; expiresAt: string; author: { id: string; name: string; username: string; profilePicture?: string } | null; isMine?: boolean; viewCount?: number; uploadState?: "uploading" };

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
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState("");
  const [draft, setDraft] = useState("");
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [stories, setStories] = useState<SocialStory[]>([]);
  const [storyComposerOpen, setStoryComposerOpen] = useState(false);
  const [storyViewer, setStoryViewer] = useState<SocialStory | null>(null);
  const [storyPlaybackQueue, setStoryPlaybackQueue] = useState<SocialStory[]>([]);
  const [storyPlaybackIndex, setStoryPlaybackIndex] = useState(0);
  const [storyPlaybackPaused, setStoryPlaybackPaused] = useState(false);
  const [storyDeleteConfirm, setStoryDeleteConfirm] = useState<string | null>(null);
  const [storyDeleting, setStoryDeleting] = useState(false);
  const storySwipeRef = useRef<{ x: number; y: number } | null>(null);
  const [storyTextSections, setStoryTextSections] = useState<StoryTextSection[]>([{ id: "story-text-1", text: "", x: 50, y: 50 }]);
  const [activeStoryTextId, setActiveStoryTextId] = useState("story-text-1");
  const [storyTextManagerOpen, setStoryTextManagerOpen] = useState(false);
  const [storyColorPickerOpen, setStoryColorPickerOpen] = useState(false);
  const [storyTextColorPickerOpen, setStoryTextColorPickerOpen] = useState(false);
  const [storyTextSizePickerOpen, setStoryTextSizePickerOpen] = useState(false);
  const storyTextDragRef = useRef<{ pointerId: number; sectionId: string; startX: number; startY: number; originX: number; originY: number; nextX: number; nextY: number; element: HTMLParagraphElement } | null>(null);
  const [storyBackground, setStoryBackground] = useState("#8b1e35");
  const [storyPhoto, setStoryPhoto] = useState<SelectedImage | null>(null);
  const [storyEditingImageUrl, setStoryEditingImageUrl] = useState("");
  const [storyPublishing, setStoryPublishing] = useState(false);
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
  const [commentActionMenuId, setCommentActionMenuId] = useState<string | null>(null);
  const [editingComment, setEditingComment] = useState<{ postId: string; comment: SocialComment } | null>(null);
  const [editCommentDraft, setEditCommentDraft] = useState("");
  const [savingCommentIds, setSavingCommentIds] = useState<string[]>([]);

  useEffect(() => {
    if (!commentDeleteConfirmId && !postDeleteConfirmId && !postActionMenuId && !commentActionMenuId) return;
    const closeDeletePopoutsOutside = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".social-comment-delete-wrap, .social-post-delete-wrap")) return;
      setCommentDeleteConfirmId(null);
      setPostDeleteConfirmId(null);
      setPostActionMenuId(null);
      setCommentActionMenuId(null);
    };
    document.addEventListener("pointerdown", closeDeletePopoutsOutside);
    return () => document.removeEventListener("pointerdown", closeDeletePopoutsOutside);
  }, [commentDeleteConfirmId, postDeleteConfirmId, postActionMenuId, commentActionMenuId]);
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
      .finally(() => { /* Account loading has no separate hero state. */ });
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

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const token = localStorage.getItem("hallschat_token");
    if (!token) return;
    fetch(`${apiBase}/api/social/stories`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || "Stories couldn't load.");
        return Array.isArray(payload.stories) ? payload.stories as SocialStory[] : [];
      })
      .then(items => { if (!cancelled) setStories(items); })
      .catch(() => { /* Keep the feed usable if stories are temporarily unavailable. */ });
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("hallschat_token");
    if (!token) return;
    let cancelled = false;
    const refreshStories = () => {
      fetch(`${apiBase}/api/social/stories`, { headers: { Authorization: `Bearer ${token}` } })
        .then(async response => {
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) return null;
          return Array.isArray(payload.stories) ? payload.stories as SocialStory[] : [];
        })
        .then(items => {
          if (cancelled || !items) return;
          setStories(items);
          setStoryViewer(current => current?.isMine ? items.find(item => item.id === current.id) || current : current);
        }).catch(() => {});
    };
    const timer = window.setInterval(refreshStories, 12000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [user]);

  function openStoryViewer(story: SocialStory) {
    const groups = new Map<string, SocialStory[]>();
    stories.filter(item => item.author).forEach(item => {
      const authorId = item.author!.id;
      if (!groups.has(authorId)) groups.set(authorId, []);
      groups.get(authorId)!.push(item);
    });
    const groupList = Array.from(groups.values());
    const startGroupIndex = groupList.findIndex(group => group.some(item => item.id === story.id));
    if (startGroupIndex < 0) {
      setStoryPlaybackQueue([story]);
      setStoryPlaybackIndex(0);
      setStoryViewer(story);
      setStoryPlaybackPaused(false);
      return;
    }
    // Play this author's stories from oldest to newest, then continue through the remaining story tray.
    const queue = groupList.flat();
    const startIndex = Math.max(0, queue.findIndex(item => item.author?.id === story.author?.id));
    setStoryPlaybackQueue(queue);
    setStoryPlaybackIndex(startIndex);
    setStoryViewer(queue[startIndex] || story);
    setStoryPlaybackPaused(false);
  }

  const closeStoryViewer = useCallback(() => {
    setStoryViewer(null);
    setStoryPlaybackQueue([]);
    setStoryPlaybackIndex(0);
    setStoryPlaybackPaused(false);
    storySwipeRef.current = null;
  }, []);

  const moveStoryPlayback = useCallback((direction: -1 | 1) => {
    if (!storyPlaybackQueue.length) { closeStoryViewer(); return; }
    const nextIndex = storyPlaybackIndex + direction;
    if (nextIndex < 0) return;
    if (nextIndex >= storyPlaybackQueue.length) { closeStoryViewer(); return; }
    setStoryPlaybackIndex(nextIndex);
    setStoryViewer(storyPlaybackQueue[nextIndex]);
    setStoryPlaybackPaused(false);
  }, [storyPlaybackQueue, storyPlaybackIndex, closeStoryViewer]);

  useEffect(() => {
    if (!storyViewer || storyViewer.isMine) return;
    const token = localStorage.getItem("hallschat_token");
    if (!token) return;
    fetch(`${apiBase}/api/social/stories/${encodeURIComponent(storyViewer.id)}/view`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` }
    }).then(async response => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.story) return;
      setStories(current => current.map(item => item.id === storyViewer.id ? { ...item, viewCount: payload.story.viewCount } : item));
      setStoryPlaybackQueue(current => current.map(item => item.id === storyViewer.id ? { ...item, viewCount: payload.story.viewCount } : item));
      setStoryViewer(current => current?.id === storyViewer.id ? { ...current, viewCount: payload.story.viewCount } : current);
    }).catch(() => {});
  }, [storyViewer?.id, storyViewer?.isMine]);

  async function deleteStory(storyId: string) {
    if (storyDeleting) return;
    const token = localStorage.getItem("hallschat_token");
    if (!token) { setFeedError("Please sign in again to delete your story."); return; }
    setStoryDeleting(true);
    try {
      const response = await fetch(`${apiBase}/api/social/stories/${encodeURIComponent(storyId)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Your story could not be deleted.");
      setStories(current => current.filter(item => item.id !== storyId));
      setStoryPlaybackQueue(current => current.filter(item => item.id !== storyId));
      setStoryDeleteConfirm(null);
      if (storyViewer?.id === storyId) closeStoryViewer();
      setNotice("Story deleted.");
    } catch (error) {
      setFeedError(error instanceof Error ? error.message : "Your story could not be deleted.");
    } finally { setStoryDeleting(false); }
  }

  const currentStoryDuration = storyViewer?.mediaUrl ? 5000 : 7000;

  useEffect(() => {
    if (!storyViewer || storyPlaybackPaused) return;
    const timer = window.setTimeout(() => moveStoryPlayback(1), currentStoryDuration);
    return () => window.clearTimeout(timer);
  }, [storyViewer?.id, storyPlaybackIndex, storyPlaybackPaused, currentStoryDuration, moveStoryPlayback]);

  useEffect(() => {
    if (!storyViewer) return;
    const handleStoryKeys = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "PageDown") { event.preventDefault(); moveStoryPlayback(1); }
      else if (event.key === "ArrowLeft" || event.key === "PageUp") { event.preventDefault(); moveStoryPlayback(-1); }
      else if (event.key === "Escape") { event.preventDefault(); closeStoryViewer(); }
    };
    window.addEventListener("keydown", handleStoryKeys);
    return () => window.removeEventListener("keydown", handleStoryKeys);
  }, [storyViewer?.id, moveStoryPlayback, closeStoryViewer]);

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

  function selectStoryPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || storyPublishing) return;
    if (!file.type.startsWith("image/")) { setFeedError("Choose an image for your story."); return; }
    if (file.size > MAX_IMAGE_SIZE) { setFeedError("Story photos must be 10 MB or smaller."); return; }
    setStoryEditingImageUrl(URL.createObjectURL(file));
    setFeedError("");
  }

  async function finishStoryPhotoEdit(file: File) {
    const compressed = await compressPostImage(file);
    setStoryPhoto(current => {
      if (current) URL.revokeObjectURL(current.preview);
      return { file: compressed, preview: URL.createObjectURL(compressed) };
    });
    setStoryEditingImageUrl(current => {
      if (current) URL.revokeObjectURL(current);
      return "";
    });
    setFeedError("");
  }

  function cancelStoryPhotoEdit() {
    setStoryEditingImageUrl(current => {
      if (current) URL.revokeObjectURL(current);
      return "";
    });
  }

  function addStoryTextSection() {
    const id = `story-text-${Date.now()}-${storyTextSections.length}`;
    setStoryTextSections(current => [...current, { id, text: "", x: 50, y: Math.min(85, 50 + current.length * 8), fontSize: 24, color: "#ffffff" }]);
    setActiveStoryTextId(id);
  }

  function updateStoryTextSection(id: string, text: string) {
    setStoryTextSections(current => current.map(section => section.id === id ? { ...section, text } : section));
  }

  function removeStoryTextSection(id: string) {
    const remaining = storyTextSections.filter(section => section.id !== id);
    setStoryTextSections(remaining.length ? remaining : [{ id: `story-text-${Date.now()}`, text: "", x: 50, y: 50, fontSize: 24, color: "#ffffff" }]);
    if (activeStoryTextId === id) setActiveStoryTextId(remaining[0]?.id || "");
    storyTextDragRef.current = null;
  }

  function handleStoryTextPointerDown(event: ReactPointerEvent<HTMLParagraphElement>, section: StoryTextSection) {
    if (!section.text.trim()) return;
    event.preventDefault(); event.stopPropagation();
    if (!event.currentTarget.closest(".social-story-preview")) return;
    setActiveStoryTextId(section.id);
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Continue without capture when unavailable. */ }
    storyTextDragRef.current = { pointerId: event.pointerId, sectionId: section.id, startX: event.clientX, startY: event.clientY, originX: section.x, originY: section.y, nextX: section.x, nextY: section.y, element: event.currentTarget };
  }

  function handleStoryTextPointerMove(event: ReactPointerEvent<HTMLParagraphElement>) {
    const drag = storyTextDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const preview = drag.element.closest(".social-story-preview");
    if (!preview) return;
    event.preventDefault();
    const bounds = preview.getBoundingClientRect();
    const x = Math.max(6, Math.min(94, drag.originX + (event.clientX - drag.startX) / Math.max(1, bounds.width) * 100));
    const y = Math.max(6, Math.min(94, drag.originY + (event.clientY - drag.startY) / Math.max(1, bounds.height) * 100));
    drag.nextX = x; drag.nextY = y;
    // Move the dragged element directly, avoiding a whole-page React render per touch sample.
    drag.element.style.left = `${x}%`; drag.element.style.top = `${y}%`;
  }

  function handleStoryTextPointerUp(event: ReactPointerEvent<HTMLParagraphElement>) {
    const drag = storyTextDragRef.current;
    if (drag?.pointerId === event.pointerId) {
      setStoryTextSections(current => current.map(section => section.id === drag.sectionId ? { ...section, x: drag.nextX, y: drag.nextY } : section));
      storyTextDragRef.current = null;
    }
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* Capture may already be released. */ }
  }

  async function publishStory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validSections = storyTextSections.filter(section => section.text.trim()).map(section => ({ ...section, text: section.text.trim() }));
    const combinedText = validSections.map(section => section.text).join("\n").slice(0, 500);
    if (storyPublishing || (!combinedText && !storyPhoto)) return;
    const token = localStorage.getItem("hallschat_token");
    if (!token) { navigate("/signin", { replace: true }); return; }

    // Snapshot the draft before closing the composer. The upload continues in the background.
    const photoToUpload = storyPhoto;
    const background = storyBackground;
    const textPosition = validSections[0] ? { x: validSections[0].x, y: validSections[0].y } : { x: 50, y: 50 };
    const temporaryId = `story-upload-${Date.now()}`;
    const now = new Date().toISOString();
    const pendingStory: SocialStory = {
      id: temporaryId,
      text: combinedText,
      textSections: validSections,
      mediaUrl: photoToUpload?.preview,
      background,
      textPosition,
      createdAt: now,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      author: user ? { id: user.id, name: user.name, username: user.username, profilePicture: user.profilePicture } : null,
      isMine: true,
      uploadState: "uploading"
    };

    setStoryPublishing(true);
    setFeedError("");
    setNotice("");
    setStories(current => [...current.filter(item => item.id !== temporaryId), pendingStory]);
    setStoryComposerOpen(false);
    setStoryTextSections([{ id: "story-text-1", text: "", x: 50, y: 50, fontSize: 24, color: "#ffffff" }]);
    setActiveStoryTextId("story-text-1");
    setStoryTextManagerOpen(false);
    setStoryColorPickerOpen(false);
    setStoryPhoto(null);
    setStoryEditingImageUrl(current => {
      if (current) URL.revokeObjectURL(current);
      return "";
    });

    try {
      let mediaUrl = "";
      if (photoToUpload) {
        const authResponse = await fetch(`${apiBase}/api/media/imagekit-auth`, { headers: { Authorization: `Bearer ${token}` } });
        const auth = await authResponse.json().catch(() => ({})) as ImageKitAuth;
        if (!authResponse.ok || !auth.token || !auth.signature || !auth.publicKey || !auth.expire) throw new Error(auth.message || "Photo upload couldn't be prepared.");
        const formData = new FormData();
        formData.append("file", photoToUpload.file);
        formData.append("fileName", photoToUpload.file.name);
        formData.append("publicKey", auth.publicKey);
        formData.append("token", auth.token);
        formData.append("signature", auth.signature);
        formData.append("expire", String(auth.expire));
        formData.append("useUniqueFileName", "true");
        const upload = await fetch("https://upload.imagekit.io/api/v1/files/upload", { method: "POST", body: formData });
        const uploaded = await upload.json().catch(() => ({}));
        if (!upload.ok || typeof uploaded.url !== "string") throw new Error(uploaded.message || "The story photo couldn't upload.");
        mediaUrl = uploaded.url;
      }
      const response = await fetch(`${apiBase}/api/social/stories`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: combinedText, textSections: validSections, mediaUrl, background, textPosition })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.story) throw new Error(payload.message || "Your story couldn't be published.");
      setStories(current => [...current.filter(item => item.id !== temporaryId && item.id !== payload.story.id), payload.story as SocialStory]);
      setNotice("Your story is live for 24 hours.");
    } catch (err) {
      setStories(current => current.filter(item => item.id !== temporaryId));
      setFeedError(err instanceof Error ? err.message : "Your story couldn't be published.");
    } finally {
      if (photoToUpload) URL.revokeObjectURL(photoToUpload.preview);
      setStoryPublishing(false);
    }
  }

  function closeStoryComposer() {
    setStoryComposerOpen(false);
    setStoryTextSections([{ id: "story-text-1", text: "", x: 50, y: 50 }]);
    setActiveStoryTextId("story-text-1");
    setStoryTextManagerOpen(false);
    setStoryColorPickerOpen(false);
    setStoryTextColorPickerOpen(false);
    storyTextDragRef.current = null;
    cancelStoryPhotoEdit();
    setStoryPhoto(current => { if (current) URL.revokeObjectURL(current.preview); return null; });
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
      setComposerExpanded(false);
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

  function beginEditComment(post: SocialPost, comment: SocialComment) {
    setEditingComment({ postId: post.id, comment });
    setEditCommentDraft(comment.content);
    setCommentActionMenuId(null);
  }

  async function saveCommentEdit() {
    if (!editingComment) return;
    const content = editCommentDraft.trim();
    const { postId, comment } = editingComment;
    if (!content || content === comment.content.trim() || savingCommentIds.includes(comment.id)) return;
    const token = localStorage.getItem("hallschat_token");
    if (!token) { navigate("/signin", { replace: true }); return; }
    setSavingCommentIds(current => [...current, comment.id]);
    setCommentErrors(current => ({ ...current, [postId]: "" }));
    try {
      const response = await fetch(`${apiBase}/api/social/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(comment.id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ content })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Your comment could not be edited.");
      const updated = (payload.comment || { ...comment, content }) as SocialComment;
      setCommentsByPost(current => ({ ...current, [postId]: (current[postId] || []).map(item => item.id === comment.id ? { ...item, ...updated } : item) }));
      setEditingComment(null); setEditCommentDraft(""); setNotice("Comment updated.");
    } catch (err) {
      setCommentErrors(current => ({ ...current, [postId]: err instanceof Error ? err.message : "Your comment could not be edited." }));
    } finally { setSavingCommentIds(current => current.filter(id => id !== comment.id)); }
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
        <div className="social-layout">
          <section className="social-feed-column" aria-label="Social feed">
            <section className="social-stories" aria-label="Stories">
              <button type="button" className="social-story-add" onClick={() => setStoryComposerOpen(true)}>
                <span className="social-story-add-media">{user?.profilePicture ? <img src={user.profilePicture} alt="" /> : initials(user?.name || "H")}<i><Plus size={16}/></i></span>
                <strong>Create story</strong><small>Share a moment</small>
              </button>
              {Array.from(new Map(stories.filter(story => story.author).map(story => [story.author!.id, story] as const)).values()).map(story => <button type="button" key={story.id} className={`social-story-item ${story.uploadState === "uploading" ? "social-story-item-uploading" : ""}`} onClick={() => { if (story.uploadState !== "uploading") openStoryViewer(story); }} disabled={story.uploadState === "uploading"} aria-label={story.uploadState === "uploading" ? "Your story is uploading" : `View story by ${story.author?.name || "user"}`}>
                <span className="social-story-ring"><span>{story.uploadState === "uploading" ? <span className="social-story-upload-indicator"><LoadingDots /></span> : story.author?.profilePicture ? <img src={story.author.profilePicture} alt="" /> : initials(story.author?.name || "H")}</span></span>
                <strong>{story.isMine ? "Your story" : story.author?.name}</strong><small>{story.uploadState === "uploading" ? "Uploading…" : timeAgo(story.createdAt)}</small>
              </button>)}
            </section>
            <form className={`social-composer ${composerMode === "poll" ? "social-composer-poll-mode" : ""} ${!composerExpanded && composerMode === "post" && !draft.trim() && selectedImages.length === 0 ? "social-composer-collapsed" : ""}`} onSubmit={publishPost}>
              {composerMode === "post" && !composerExpanded && !draft.trim() && selectedImages.length === 0 ? <div className="social-composer-quick">
                <div className="social-composer-quick-top"><span className="social-avatar social-avatar-self">{user?.profilePicture ? <img src={user.profilePicture} alt="" /> : initials(user?.name || "H")}</span><button type="button" className="social-composer-open" onClick={() => setComposerExpanded(true)}>What's on your mind?</button></div>
                <div className="social-composer-quick-tools">
                  <button type="button" onClick={() => { setComposerExpanded(true); window.setTimeout(() => document.getElementById("social-post-content")?.focus(), 0); }}><ImagePlus size={17}/> Photo post</button>
                  <button type="button" onClick={() => { setComposerExpanded(true); setComposerMode("poll"); }}><ChartNoAxesColumn size={17}/> Poll</button>
                </div>
              </div> : <>
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
              </>}
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
{post.author?.id === user?.id && postDeleteConfirmId === post.id && <div role="alertdialog" aria-label="Confirm post deletion" style={{ position: "absolute", right: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)", zIndex: 8, width: 188, boxSizing: "border-box", padding: 11, border: "1px solid rgba(255,210,219,.2)", borderRadius: 13, background: "linear-gradient(145deg,rgba(57,17,27,.98),rgba(28,9,15,.99))", boxShadow: "0 10px 28px rgba(0,0,0,.42)", color: "#fff0f3", textAlign: "left", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}><div style={{ fontSize: ".76rem", fontWeight: 750, lineHeight: 1.4 }}>Delete this post?</div><div style={{ fontSize: ".7rem", marginTop: 4, color: "#e8c6ce" }}>This action cannot be undone.</div><div style={{ display: "flex", gap: 6, marginTop: 9 }}><button type="button" onClick={() => setPostDeleteConfirmId(null)} style={{ flex: 1, minHeight: 29, padding: "5px 7px", border: "1px solid rgba(255,210,219,.15)", borderRadius: 8, background: "rgba(255,255,255,.06)", color: "#f5dce1", fontSize: ".7rem" }}>Cancel</button><button type="button" onClick={() => { setPostDeleteConfirmId(null); void deletePost(post); }} style={{ flex: 1, minHeight: 29, padding: "5px 7px", border: 0, borderRadius: 8, background: "#b92d45", color: "#fff", fontSize: ".7rem", fontWeight: 750 }}>Delete</button></div></div>}</div></div>
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
                          <button type="button" className={comment.likedByMe ? "social-comment-like is-liked" : "social-comment-like"} onClick={() => void toggleCommentLike(post, comment)} disabled={commentLikingIds.includes(comment.id)} aria-label={comment.likedByMe ? "Unlike comment" : "Like comment"} aria-pressed={comment.likedByMe}>{commentLikingIds.includes(comment.id) ? <LoadingDots/> : <Heart size={16} fill={comment.likedByMe ? "currentColor" : "none"}/>}<small>{comment.likeCount || ""}</small></button>{comment.author?.id === user?.id && <div className="social-comment-delete-wrap"><button type="button" className="social-comment-delete" onClick={() => setCommentActionMenuId(current => current === comment.id ? null : comment.id)} disabled={commentDeletingIds.includes(comment.id) || savingCommentIds.includes(comment.id)} aria-label="Comment options" title="Comment options"><MoreHorizontal size={17}/></button>{commentActionMenuId === comment.id && <div className="social-comment-delete-confirm social-comment-action-menu" role="menu" aria-label="Comment options"><button type="button" role="menuitem" onClick={() => beginEditComment(post, comment)}><Pencil size={14}/> Edit comment</button><button type="button" role="menuitem" onClick={() => { setCommentActionMenuId(null); setCommentDeleteConfirmId(comment.id); }}><Trash2 size={14}/> Delete comment</button></div>}{commentDeleteConfirmId === comment.id && <div className="social-comment-delete-confirm" role="alertdialog" aria-label="Confirm comment deletion"><strong>Delete comment?</strong><span>{(commentsByPost[post.id] || []).some(item => item.parentId === comment.id) ? "Its replies will also be removed." : "This action cannot be undone."}</span><div><button type="button" onClick={() => setCommentDeleteConfirmId(null)}>Cancel</button><button type="button" onClick={() => void deleteComment(post, comment)}>Delete</button></div></div>}</div>}
                        </article>
                        {(commentsByPost[post.id] || []).filter(reply => reply.parentId === comment.id).map(reply => <article className="social-comment social-comment-reply" key={reply.id}>
                          {reply.author?.id ? <button type="button" className="social-comment-avatar" onClick={() => navigate("/users/" + encodeURIComponent(reply.author!.id))} aria-label={"View " + (reply.author.name || "member") + " profile"} style={{ padding: 0, cursor: "pointer" }}>{reply.author.profilePicture ? <img src={reply.author.profilePicture} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} /> : initials(reply.author.name || "HallsChat member")}</button> : reply.author?.profilePicture ? <img className="social-comment-avatar" src={reply.author.profilePicture} alt="" loading="lazy" /> : <div className="social-comment-avatar">{initials(reply.author?.name || "HallsChat member")}</div>}
                          <div className="social-comment-body"><div className="social-comment-bubble"><strong>{reply.author?.name || "HallsChat member"}</strong><span>{renderTextWithLinks(reply.content)}</span></div><div className="social-comment-meta"><small>{timeAgo(reply.createdAt)}</small><button type="button" onClick={() => setReplyTargets(current => ({ ...current, [post.id]: comment }))}>Reply</button></div></div>
                          <button type="button" className={reply.likedByMe ? "social-comment-like is-liked" : "social-comment-like"} onClick={() => void toggleCommentLike(post, reply)} disabled={commentLikingIds.includes(reply.id)} aria-label={reply.likedByMe ? "Unlike reply" : "Like reply"} aria-pressed={reply.likedByMe}>{commentLikingIds.includes(reply.id) ? <LoadingDots/> : <Heart size={16} fill={reply.likedByMe ? "currentColor" : "none"}/>}<small>{reply.likeCount || ""}</small></button>{reply.author?.id === user?.id && <div className="social-comment-delete-wrap"><button type="button" className="social-comment-delete" onClick={() => setCommentActionMenuId(current => current === reply.id ? null : reply.id)} disabled={commentDeletingIds.includes(reply.id) || savingCommentIds.includes(reply.id)} aria-label="Reply options" title="Reply options"><MoreHorizontal size={17}/></button>{commentActionMenuId === reply.id && <div className="social-comment-delete-confirm social-comment-action-menu" role="menu" aria-label="Reply options"><button type="button" role="menuitem" onClick={() => beginEditComment(post, reply)}><Pencil size={14}/> Edit reply</button><button type="button" role="menuitem" onClick={() => { setCommentActionMenuId(null); setCommentDeleteConfirmId(reply.id); }}><Trash2 size={14}/> Delete reply</button></div>}{commentDeleteConfirmId === reply.id && <div className="social-comment-delete-confirm" role="alertdialog" aria-label="Confirm reply deletion"><strong>Delete reply?</strong><span>This action cannot be undone.</span><div><button type="button" onClick={() => setCommentDeleteConfirmId(null)}>Cancel</button><button type="button" onClick={() => void deleteComment(post, reply)}>Delete</button></div></div>}</div>}
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
    {storyComposerOpen && <div className="social-story-overlay" role="presentation" onClick={closeStoryComposer}>
      <form className="social-story-dialog social-story-snap-composer" role="dialog" aria-modal="true" aria-label="Create story" onClick={event => event.stopPropagation()} onSubmit={publishStory}>
        <div className={`social-story-preview social-story-snap-canvas ${storyPhoto ? "has-photo" : ""}`} style={{ background: storyPhoto ? "#16090d" : storyBackground }}>
          {storyPhoto && <img src={storyPhoto.preview} alt="Story preview" />}
          {storyTextSections.filter(section => section.text.trim()).map(section => <p key={section.id} className={`social-story-draggable-text ${activeStoryTextId === section.id ? "is-active" : ""}`} style={{ left: `${section.x}%`, top: `${section.y}%`, fontSize: `${section.fontSize || 24}px`, color: section.color || "#ffffff" }} onPointerDown={event => handleStoryTextPointerDown(event, section)} onPointerMove={handleStoryTextPointerMove} onPointerUp={handleStoryTextPointerUp} onPointerCancel={handleStoryTextPointerUp} onClick={() => setActiveStoryTextId(section.id)} aria-label="Drag to position story text">{section.text}</p>)}
          {!storyPhoto && !storyTextSections.some(section => section.text.trim()) && <span>Your story preview</span>}
          <button type="button" className="social-story-snap-close" onClick={closeStoryComposer} aria-label="Close story creator"><X size={21}/></button>
          <div className="social-story-snap-tools" aria-label="Story editing tools">
            <button type="button" onClick={addStoryTextSection} disabled={storyTextSections.length >= 10} aria-label="Add text" title="Add text"><Pencil size={20}/></button>
            <button type="button" onClick={() => { setStoryColorPickerOpen(value => !value); setStoryTextColorPickerOpen(false); setStoryTextManagerOpen(false); }} aria-label="Change background color" title="Background color"><Palette size={20}/></button>
            <button type="button" onClick={() => { setStoryTextColorPickerOpen(value => !value); setStoryColorPickerOpen(false); setStoryTextManagerOpen(false); }} aria-label="Change text color" title="Text color"><CaseSensitive size={21}/></button>
            <label className="social-story-snap-tool" aria-label="Add photo" title="Add photo"><ImagePlus size={20}/><input type="file" accept="image/*" hidden onChange={selectStoryPhoto}/></label>
            <button type="button" onClick={() => setStoryTextManagerOpen(value => !value)} aria-expanded={storyTextManagerOpen} aria-label="Manage text sections" title="Manage text"><MoreHorizontal size={21}/></button>
          </div>
          {storyTextManagerOpen && <div className={`social-story-text-manager ${storyTextSections.length > 3 ? "is-scrollable" : ""}`} role="dialog" aria-label="Manage story text sections">
            <div className="social-story-text-manager-head"><strong>Text sections</strong><button type="button" onClick={() => setStoryTextManagerOpen(false)} aria-label="Close text section manager"><X size={15}/></button></div>
            <div className="social-story-text-manager-list">
              {storyTextSections.map((section, index) => <div key={section.id} className={activeStoryTextId === section.id ? "is-active" : ""}>
                <button type="button" className="social-story-manager-select" onClick={() => { setActiveStoryTextId(section.id); setStoryTextManagerOpen(false); }}><span>{index + 1}</span><span><strong>Section {index + 1}</strong><small>{section.text.trim() || "No text yet"}</small></span></button>
                <button type="button" className="social-story-manager-delete" disabled={storyTextSections.length === 1} onClick={() => removeStoryTextSection(section.id)} aria-label={`Remove section ${index + 1}`}><Trash2 size={14}/></button>
              </div>)}
            </div>
          </div>}
          {storyTextSizePickerOpen && <div className="social-story-color-popout social-story-text-size-popout" role="dialog" aria-label="Adjust text size"><div className="social-story-color-popout-head"><strong>Text size</strong><button type="button" onClick={() => setStoryTextSizePickerOpen(false)} aria-label="Close text size"><X size={14}/></button></div><div className="social-story-text-size-control"><label htmlFor="story-text-size">Size</label><input id="story-text-size" type="range" min="12" max="64" step="1" value={storyTextSections.find(section => section.id === activeStoryTextId)?.fontSize || 24} onChange={event => { const fontSize = Number(event.target.value); setStoryTextSections(current => current.map(section => section.id === activeStoryTextId ? {...section,fontSize} : section)); }} aria-label="Adjust text size" /><output>{storyTextSections.find(section => section.id === activeStoryTextId)?.fontSize || 24}px</output></div></div>}
          {storyTextColorPickerOpen && <div className="social-story-color-popout social-story-text-color-popout" role="dialog" aria-label="Choose text color"><div className="social-story-color-popout-head"><strong>Text color</strong><button type="button" onClick={() => setStoryTextColorPickerOpen(false)} aria-label="Close text colors"><X size={14}/></button></div><div className="social-story-colors" aria-label="Story text color">{["#ffffff","#111111","#ff4d6d","#ffb703","#70e000","#00d4ff","#8b5cf6","#ff7ac6","#d1d5db","#f97316"].map(color => <button key={color} type="button" className={(storyTextSections.find(section => section.id === activeStoryTextId)?.color || "#ffffff") === color ? "is-selected" : ""} style={{background:color}} onClick={() => { setStoryTextSections(current => current.map(section => section.id === activeStoryTextId ? {...section,color} : section)); setStoryTextColorPickerOpen(false); }} aria-label={`Choose ${color} text`} />)}</div></div>}
          {storyColorPickerOpen && <div className="social-story-color-popout" role="dialog" aria-label="Choose story background color">
            <div className="social-story-color-popout-head"><strong>Background color</strong><button type="button" onClick={() => setStoryColorPickerOpen(false)} aria-label="Close background colors"><X size={14}/></button></div>
            <div className="social-story-colors" aria-label="Story background color">
              {["#8b1e35","#235b87","#246b52","#6340a3","#b75a24","#20232d","#d94f70","#087e8b","#d4a017","#6b7280","#0f766e","#9333ea"].map(color => <button key={color} type="button" className={storyBackground === color ? "is-selected" : ""} style={{background:color}} onClick={() => { setStoryBackground(color); setStoryColorPickerOpen(false); setStoryPhoto(current => { if (current) URL.revokeObjectURL(current.preview); return null; }); }} aria-label={`Choose ${color} background`} />)}
            </div>
          </div>}
          <div className="social-story-snap-bottom">
            {storyTextSections.filter(section => section.id === activeStoryTextId).map((section, index) => <textarea key={section.id} className="social-story-active-text-input" value={section.text} onFocus={() => setActiveStoryTextId(section.id)} onChange={event => updateStoryTextSection(section.id, event.target.value)} maxLength={500} rows={2} placeholder="Write story text…" aria-label={`Edit story text section ${index + 1}`} />)}
            <div className="social-story-snap-bottom-row">
              <span>{storyTextSections.reduce((total, section) => total + section.text.length, 0)} characters</span>
              <button type="submit" disabled={storyPublishing || (!storyTextSections.some(section => section.text.trim()) && !storyPhoto)}>{storyPublishing ? <><LoadingDots/> Posting…</> : <><Send size={16}/> Post story</>}</button>
            </div>
            <p className="social-story-expiry">Stories disappear automatically after 24 hours.</p>
          </div>
        </div>
      </form>
    </div>}
    {storyEditingImageUrl && <StoryImageCropModal imageUrl={storyEditingImageUrl} onCancel={cancelStoryPhotoEdit} onDone={finishStoryPhotoEdit} />}
    {storyViewer && <div className="social-story-overlay" role="presentation" onClick={closeStoryViewer}>
      <div className="social-story-viewer" role="dialog" aria-modal="true" aria-label={`Story by ${storyViewer.author?.name || "user"}`} onClick={event => event.stopPropagation()}>
        <div className="social-story-progress-list" aria-label="Story progress">{storyPlaybackQueue.filter(item => item.author?.id === storyViewer.author?.id).map(item => {
          const queueIndex = storyPlaybackQueue.findIndex(entry => entry.id === item.id);
          const status = queueIndex < storyPlaybackIndex ? "complete" : queueIndex === storyPlaybackIndex ? "active" : "upcoming";
          return <span className={`social-story-progress-segment ${status}`} key={item.id}><i key={item.id + (status === "active" ? "-" + storyPlaybackIndex : "")} style={status === "active" ? { animationDuration: `${currentStoryDuration}ms`, animationPlayState: storyPlaybackPaused ? "paused" : "running" } : undefined} /></span>;
        })}</div>
        <div className="social-story-viewer-head"><span className="social-story-viewer-avatar">{storyViewer.author?.profilePicture ? <img src={storyViewer.author.profilePicture} alt="" /> : initials(storyViewer.author?.name || "H")}</span><div><strong>{storyViewer.author?.name || "HallsChat user"}</strong><small>{timeAgo(storyViewer.createdAt)}</small></div>{storyViewer.isMine && <button type="button" className="social-story-delete-trigger" onClick={() => setStoryDeleteConfirm(storyViewer.id)} aria-label="Delete your story" title="Delete story" disabled={storyDeleting}><Trash2 size={17}/></button>}<button type="button" onClick={closeStoryViewer} aria-label="Close story"><X size={19}/></button></div>
        <div className="social-story-viewer-content" style={{background:storyViewer.background || "#8b1e35"}} onPointerDown={event => { storySwipeRef.current = { x: event.clientX, y: event.clientY }; setStoryPlaybackPaused(true); }} onPointerUp={event => { const start = storySwipeRef.current; storySwipeRef.current = null; setStoryPlaybackPaused(false); if (!start) return; const dx = event.clientX - start.x; const dy = event.clientY - start.y; if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.25) moveStoryPlayback(dx < 0 ? 1 : -1); }} onPointerCancel={() => { storySwipeRef.current = null; setStoryPlaybackPaused(false); }}>
          {storyViewer.mediaUrl && <img src={storyViewer.mediaUrl} alt="Story" />}
          {(storyViewer.textSections?.length ? storyViewer.textSections.filter(section => section.text?.trim()) : (storyViewer.text ? [{ id: "legacy-story-text", text: storyViewer.text, x: storyViewer.textPosition?.x ?? 50, y: storyViewer.textPosition?.y ?? 50 }] : [])).map(section => <p key={section.id} className="social-story-positioned-text" style={{ left: `${section.x}%`, top: `${section.y}%`, fontSize: `${section.fontSize || 24}px`, color: section.color || "#ffffff" }}>{section.text}</p>)}
          <button type="button" className="social-story-tap-zone previous" aria-label="Previous story" onClick={() => moveStoryPlayback(-1)} />
          <button type="button" className="social-story-tap-zone next" aria-label="Next story" onClick={() => moveStoryPlayback(1)} />
        </div>
        <div className="social-story-viewer-footer">{storyViewer.isMine ? <span className="social-story-view-count"><Eye size={17}/> {storyViewer.viewCount || 0} {storyViewer.viewCount === 1 ? "view" : "views"}</span> : <span>HallsChat · 24-hour story</span>}</div>
      </div>
    </div>}
    {storyDeleteConfirm && <div className="social-story-delete-overlay" role="presentation" onClick={() => !storyDeleting && setStoryDeleteConfirm(null)}>
      <div className="social-story-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="social-story-delete-title" onClick={event => event.stopPropagation()}>
        <span className="social-story-delete-icon"><Trash2 size={21}/></span>
        <strong id="social-story-delete-title">Delete this story?</strong>
        <p>This story will be removed for everyone and cannot be restored.</p>
        <div><button type="button" onClick={() => setStoryDeleteConfirm(null)} disabled={storyDeleting}>Cancel</button><button type="button" className="danger" onClick={() => deleteStory(storyDeleteConfirm)} disabled={storyDeleting}>{storyDeleting ? <><LoadingDots/> Deleting…</> : "Delete story"}</button></div>
      </div>
    </div>}
    {editingComment && <div className="social-comment-edit-overlay" role="presentation" onClick={() => { if (!savingCommentIds.includes(editingComment.comment.id)) { setEditingComment(null); setEditCommentDraft(""); } }}><form className="social-comment-edit-modal" role="dialog" aria-modal="true" aria-label="Edit comment" onClick={event => event.stopPropagation()} onSubmit={event => { event.preventDefault(); void saveCommentEdit(); }}><header><div><strong>Edit comment</strong></div></header><textarea value={editCommentDraft} onChange={event => setEditCommentDraft(event.target.value)} maxLength={2000} rows={5} autoFocus aria-label="Comment text" placeholder="Write your comment…"/><footer><button type="button" onClick={() => { setEditingComment(null); setEditCommentDraft(""); }} disabled={savingCommentIds.includes(editingComment.comment.id)}>Cancel</button><button type="submit" disabled={!editCommentDraft.trim() || editCommentDraft.trim() === editingComment.comment.content.trim() || savingCommentIds.includes(editingComment.comment.id)}>{savingCommentIds.includes(editingComment.comment.id) ? <LoadingDots/> : <Check size={15}/>} Save changes</button></footer></form></div>}
    {previewImage && <ImagePreviewModal imageUrl={previewImage} onClose={() => setPreviewImage(null)} />}
    <NowBar />
  </main>;
}
