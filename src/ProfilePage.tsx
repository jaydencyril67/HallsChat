import { ChangeEvent, useEffect, useRef, useState } from "react";
import { FileText, Camera, Trash2, LogOut, Eye, Mail, Pencil, Check, ShieldCheck } from "lucide-react";
import AppHeader from "./AppHeader";
import NowBar from "./NowBar";
import LoadingDots from "./components/LoadingDots";
import ImagePreviewModal from "./components/ImagePreviewModal";
import VerificationBadge from "./VerificationBadge";
import VerificationPanel from "./VerificationPanel";
import StoryImageCropModal from "./components/StoryImageCropModal";
import { navigate } from "./utils/navigate";
import { finishBackgroundTask, startBackgroundTask, updateBackgroundTask } from "./utils/backgroundTasks";

type Account = { id: string; name: string; username: string; email: string; kingsHallId?: string; createdAt?: string; profilePicture?: string; coverPhoto?: string; followersCount?: number; profileDetailsUpdatedAt?: string | null; identityLockedAt?: string | null; verificationStatus?: "none" | "pending" | "verified" | "rejected"; verifiedAt?: string | null };
type Post = { id: string; content: string; createdAt: string; author: { id: string; name: string; username: string } | null; likeCount?: number; images?: string[]; poll?: { question: string; options?: { id: string; text: string; voteCount: number; votedByMe?: boolean }[] } | null };
type ImageKitAuth = { token: string; expire: number; signature: string; publicKey: string };
const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");
const MAX_PROFILE_IMAGE_SIZE = 10 * 1024 * 1024;

export default function ProfilePage() {
  const [user, setUser] = useState<Account | null>(null);
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [activeProfileTab, setActiveProfileTab] = useState<"posts" | "about" | "verify">("posts");
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsCursor, setPostsCursor] = useState<string | null>(null);
  const [postsHasMore, setPostsHasMore] = useState(false);
  const [postsLoadingMore, setPostsLoadingMore] = useState(false);
  const postsSentinel = useRef<HTMLDivElement | null>(null);
  const postsMoreInFlight = useRef(false);
  const [error, setError] = useState("");
  const [pictureError, setPictureError] = useState("");
  const [pictureBusy, setPictureBusy] = useState(false);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [previewPicture, setPreviewPicture] = useState<string | null>(null);
  const [previewCover, setPreviewCover] = useState<string | null>(null);
  const [pictureActionsOpen, setPictureActionsOpen] = useState(false);
  const [pictureDeleteConfirm, setPictureDeleteConfirm] = useState(false);
  const [coverActionsOpen, setCoverActionsOpen] = useState(false);
  const [coverDeleteConfirm, setCoverDeleteConfirm] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverCropSource, setCoverCropSource] = useState<string | null>(null);
  const [editingProfileDetails, setEditingProfileDetails] = useState(false);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [profileDetailsBusy, setProfileDetailsBusy] = useState(false);
  const coverInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const closeProfilePopoutsOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        setCoverActionsOpen(false);
        setCoverDeleteConfirm(false);
        setPictureActionsOpen(false);
        setPictureDeleteConfirm(false);
        return;
      }
      if (!target.closest(".profile-cover-popout, .profile-cover-popout-trigger")) {
        setCoverActionsOpen(false);
        setCoverDeleteConfirm(false);
      }
      if (!target.closest(".profile-picture-popout, .profile-picture-popout-trigger")) {
        setPictureActionsOpen(false);
        setPictureDeleteConfirm(false);
      }
    };
    document.addEventListener("pointerdown", closeProfilePopoutsOutside);
    return () => document.removeEventListener("pointerdown", closeProfilePopoutsOutside);
  }, []);

  useEffect(() => {
    if (!pictureError) return;
    const timer = window.setTimeout(() => setPictureError(""), 5000);
    return () => window.clearTimeout(timer);
  }, [pictureError]);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("hallschat_token");
    if (!token) { navigate("/signin", { replace: true }); return; }

    async function loadOwnProfileAndPosts() {
      try {
        const accountResponse = await fetch(`${apiBase}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const accountPayload = await accountResponse.json().catch(() => ({}));
        if (!accountResponse.ok || !accountPayload.user) {
          throw new Error(accountPayload.message || "Your profile couldn't be loaded.");
        }
        const account = accountPayload.user as Account;
        if (cancelled) return;
        setUser(account);
        setLoading(false);

        const postsResponse = await fetch(`${apiBase}/api/social/users/${encodeURIComponent(account.id)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const postsPayload = await postsResponse.json().catch(() => ({}));
        if (!postsResponse.ok) throw new Error(postsPayload.message || "Your posts couldn't be loaded.");
        const items = Array.isArray(postsPayload.posts) ? postsPayload.posts as Omit<Post, "author">[] : [];
        if (!cancelled) {
          setPostsCursor(typeof postsPayload.nextCursor === "string" ? postsPayload.nextCursor : null);
          setPostsHasMore(postsPayload.hasMore === true);
          setAllPosts(items.map(post => ({
            ...post,
            author: { id: account.id, name: account.name, username: account.username }
          })));
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Your profile couldn't be loaded.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setPostsLoading(false);
        }
      }
    }

    void loadOwnProfileAndPosts();
    return () => { cancelled = true; };
  }, []);


  useEffect(() => {
    if (activeProfileTab !== "posts" || postsLoadingMore || !postsHasMore || !postsCursor || !postsSentinel.current || typeof IntersectionObserver === "undefined") return;
    const token = localStorage.getItem("hallschat_token");
    if (!token || !user) return;
    const node = postsSentinel.current;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting) || postsMoreInFlight.current) return;
      postsMoreInFlight.current = true;
      observer.unobserve(node);
      setPostsLoadingMore(true);
      fetch(`${apiBase}/api/social/users/${encodeURIComponent(user.id)}?limit=20&cursor=${encodeURIComponent(postsCursor)}`, { headers: { Authorization: `Bearer ${token}` } })
        .then(async response => {
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(payload.message || "More posts couldn't be loaded.");
          return payload;
        })
        .then(payload => {
          const items = Array.isArray(payload.posts) ? payload.posts as Omit<Post, "author">[] : [];
          setAllPosts(current => {
            const seen = new Set(current.map(post => post.id));
            return [...current, ...items.filter(post => !seen.has(post.id)).map(post => ({ ...post, author: { id: user.id, name: user.name, username: user.username } }))];
          });
          setPostsCursor(typeof payload.nextCursor === "string" ? payload.nextCursor : null);
          setPostsHasMore(payload.hasMore === true);
        })
        .catch(err => setError(err instanceof Error ? err.message : "More posts couldn't be loaded."))
        .finally(() => { postsMoreInFlight.current = false; setPostsLoadingMore(false); });
    }, { rootMargin: "180px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [activeProfileTab, postsHasMore, postsLoadingMore, postsCursor, user?.id]);

  const posts = allPosts.filter(post => Boolean(user?.id) && post.author?.id === user?.id);
  const initials = user?.name?.trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase() || "H";
  const panel: React.CSSProperties = { border: "1px solid var(--theme-line)", borderRadius: 16, background: "var(--theme-surface)" };
  const muted: React.CSSProperties = { color: "var(--theme-muted)" };

  function formatProfileName(value: string) {
    return value.toLocaleLowerCase().replace(/(^|\s)(\S)/g, (_match, space: string, character: string) => space + character.toLocaleUpperCase()).trim();
  }

  async function saveProfileDetails() {
    if (profileDetailsBusy) return;
    const name = formatProfileName(editName);
    const username = editUsername.trim().toLowerCase();
    if (name.length < 2 || name.length > 80) { setPictureError("Enter a full name between 2 and 80 characters."); return; }
    if (!/^[a-z0-9_.]{3,24}$/.test(username)) { setPictureError("Username must be 3–24 lowercase letters, numbers, underscores or periods."); return; }
    if (!user) return;
    if (name === user.name && username === user.username) { setEditingProfileDetails(false); return; }
    const token = localStorage.getItem("hallschat_token");
    if (!token) { navigate("/signin", { replace: true }); return; }
    setProfileDetailsBusy(true);
    setPictureError("");
    try {
      if (username !== user.username) {
        const availabilityResponse = await fetch(`${apiBase}/api/auth/username-availability?username=${encodeURIComponent(username)}`);
        const availability = await availabilityResponse.json().catch(() => ({}));
        if (!availabilityResponse.ok) throw new Error(availability.message || "Username availability could not be checked.");
        if (availability.valid === false || !availability.available) throw new Error(availability.message || "That username is already taken.");
      }
      const response = await fetch(`${apiBase}/api/auth/profile-details`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, username })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Your profile details couldn't be updated.");
      setUser(current => current ? { ...current, name: payload.user.name, username: payload.user.username, profileDetailsUpdatedAt: payload.user.profileDetailsUpdatedAt } : current);
      setAllPosts(current => current.map(post => post.author ? { ...post, author: { ...post.author, name: payload.user.name, username: payload.user.username } } : post));
      setEditName(payload.user.name);
      setEditUsername(payload.user.username);
      setEditingProfileDetails(false);
    } catch (err) {
      setPictureError(err instanceof Error ? err.message : "Your profile details couldn't be updated.");
    } finally {
      setProfileDetailsBusy(false);
    }
  }

  function selectCoverPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPictureError("");
    if (!file.type.startsWith("image/")) { setPictureError("Choose an image file for your cover photo."); return; }
    if (file.size > MAX_PROFILE_IMAGE_SIZE) { setPictureError("Choose a cover photo smaller than 10 MB."); return; }
    if (coverBusy || pictureBusy) return;
    setCoverCropSource(URL.createObjectURL(file));
  }

  function cancelCoverCrop() {
    if (coverCropSource) URL.revokeObjectURL(coverCropSource);
    setCoverCropSource(null);
  }

  async function confirmCroppedCover(croppedFile: File) {
    if (coverCropSource) URL.revokeObjectURL(coverCropSource);
    setCoverCropSource(null);
    // Close the crop editor before starting the upload.
    await new Promise<void>(resolve => window.setTimeout(resolve, 0));
    await saveCoverPhoto(croppedFile);
  }

  async function saveCoverPhoto(croppedFile: File) {
    if (coverBusy || pictureBusy) return;
    const token = localStorage.getItem("hallschat_token");
    if (!token) { navigate("/signin", { replace: true }); return; }
    setCoverBusy(true);
    setPictureError("");
    const backgroundTaskId = startBackgroundTask("Updating cover photo", "Preparing cover photo upload…");
    try {
      const authResponse = await fetch(`${apiBase}/api/media/imagekit-auth`, { headers: { Authorization: `Bearer ${token}` } });
      const authPayload = await authResponse.json().catch(() => ({}));
      if (!authResponse.ok) throw new Error(authPayload.message || "Cover photo upload couldn't be prepared.");
      const auth = authPayload as ImageKitAuth;
      if (!auth.token || !auth.signature || !auth.publicKey || !auth.expire) throw new Error("Image upload authentication is incomplete.");
      const formData = new FormData();
      formData.append("file", croppedFile, "cover-photo.jpg");
      formData.append("fileName", `hallschat-cover-${user?.id || "member"}-${Date.now()}.jpg`);
      formData.append("publicKey", auth.publicKey);
      formData.append("token", auth.token);
      formData.append("signature", auth.signature);
      formData.append("expire", String(auth.expire));
      formData.append("useUniqueFileName", "true");
      updateBackgroundTask(backgroundTaskId, "Uploading cover photo…");
      const uploadResponse = await fetch("https://upload.imagekit.io/api/v1/files/upload", { method: "POST", body: formData });
      const uploadPayload = await uploadResponse.json().catch(() => ({}));
      if (!uploadResponse.ok || typeof uploadPayload.url !== "string") throw new Error(uploadPayload.message || "Your cover photo couldn't upload.");
      updateBackgroundTask(backgroundTaskId, "Saving cover photo to your profile…");
      const saveResponse = await fetch(`${apiBase}/api/auth/cover-photo`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ coverPhoto: uploadPayload.url })
      });
      const savePayload = await saveResponse.json().catch(() => ({}));
      if (!saveResponse.ok) throw new Error(savePayload.message || "Your cover photo couldn't be saved.");
      setUser(current => current ? { ...current, coverPhoto: savePayload.coverPhoto } : current);
      setPictureError("");
      finishBackgroundTask(backgroundTaskId);
    } catch (err) {
      const coverError = err instanceof Error ? err.message : "Your cover photo couldn't be saved.";
      setPictureError(coverError);
      finishBackgroundTask(backgroundTaskId, coverError);
    } finally { setCoverBusy(false); }
  }

  async function removeCoverPhoto() {
    if (!user?.coverPhoto || coverBusy || pictureBusy) return;
    const token = localStorage.getItem("hallschat_token");
    if (!token) { navigate("/signin", { replace: true }); return; }
    setCoverBusy(true);
    setPictureError("");
    try {
      const response = await fetch(`${apiBase}/api/auth/cover-photo`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ coverPhoto: "" })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Your cover photo couldn't be removed.");
      setUser(current => current ? { ...current, coverPhoto: "" } : current);
    } catch (err) {
      setPictureError(err instanceof Error ? err.message : "Your cover photo couldn't be removed.");
    } finally { setCoverBusy(false); }
  }

  function selectPicture(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPictureError("");
    if (!file.type.startsWith("image/")) { setPictureError("Choose an image file to use as your profile picture."); return; }
    if (file.size > MAX_PROFILE_IMAGE_SIZE) { setPictureError("Choose an image smaller than 10 MB."); return; }
    if (cropSource) URL.revokeObjectURL(cropSource);
    setCropSource(URL.createObjectURL(file));
  }

  function cancelCrop() {
    if (cropSource) URL.revokeObjectURL(cropSource);
    setCropSource(null);
  }

  async function confirmCroppedPicture(croppedFile: File) {
    if (cropSource) URL.revokeObjectURL(cropSource);
    setCropSource(null);
    // Let React close the crop modal before starting the upload request.
    await new Promise<void>(resolve => window.setTimeout(resolve, 0));
    await savePicture(croppedFile);
  }

  async function savePicture(croppedFile: File) {
    if (pictureBusy) return;
    const token = localStorage.getItem("hallschat_token");
    if (!token) { navigate("/signin", { replace: true }); return; }
    setPictureBusy(true);
    setPictureError("");
    const backgroundTaskId = startBackgroundTask("Updating profile picture", "Preparing profile picture upload…");
    try {
      const authResponse = await fetch(`${apiBase}/api/media/imagekit-auth`, { headers: { Authorization: `Bearer ${token}` } });
      const authPayload = await authResponse.json().catch(() => ({}));
      if (!authResponse.ok) throw new Error(authPayload.message || "Image upload couldn't be prepared.");
      const auth = authPayload as ImageKitAuth;
      if (!auth.token || !auth.signature || !auth.publicKey || !auth.expire) throw new Error("Image upload authentication is incomplete.");
      const formData = new FormData();
      formData.append("file", croppedFile, "profile-picture.jpg");
      formData.append("fileName", `hallschat-profile-${user?.id || "member"}-${Date.now()}.jpg`);
      formData.append("publicKey", auth.publicKey);
      formData.append("token", auth.token);
      formData.append("signature", auth.signature);
      formData.append("expire", String(auth.expire));
      formData.append("useUniqueFileName", "true");
      updateBackgroundTask(backgroundTaskId, "Uploading profile picture…");
      const uploadResponse = await fetch("https://upload.imagekit.io/api/v1/files/upload", { method: "POST", body: formData });
      const uploadPayload = await uploadResponse.json().catch(() => ({}));
      if (!uploadResponse.ok || typeof uploadPayload.url !== "string") throw new Error(uploadPayload.message || "Your profile picture couldn't upload.");
      updateBackgroundTask(backgroundTaskId, "Saving profile picture to your account…");
      const saveResponse = await fetch(`${apiBase}/api/auth/profile-picture`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ profilePicture: uploadPayload.url })
      });
      const savePayload = await saveResponse.json().catch(() => ({}));
      if (!saveResponse.ok) throw new Error(savePayload.message || "Your profile picture couldn't be saved.");
      setUser(current => current ? { ...current, profilePicture: savePayload.profilePicture } : current);
      if (cropSource) URL.revokeObjectURL(cropSource);
      setCropSource(null);
      setPictureError("");
      finishBackgroundTask(backgroundTaskId);
    } catch (err) {
      const pictureErrorMessage = err instanceof Error ? err.message : "Your profile picture couldn't be saved.";
      setPictureError(pictureErrorMessage);
      finishBackgroundTask(backgroundTaskId, pictureErrorMessage);
      throw err;
    } finally {
      setPictureBusy(false);
    }
  }

  async function removePicture() {
    if (!user?.profilePicture || pictureBusy) return;
    const token = localStorage.getItem("hallschat_token");
    if (!token) { navigate("/signin", { replace: true }); return; }
    setPictureBusy(true);
    setPictureError("");
    try {
      const response = await fetch(`${apiBase}/api/auth/profile-picture`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ profilePicture: "" }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Your profile picture couldn't be removed.");
      setUser(current => current ? { ...current, profilePicture: "" } : current);
    } catch (err) {
      setPictureError(err instanceof Error ? err.message : "Your profile picture couldn't be removed.");
    } finally { setPictureBusy(false); }
  }

  return <main className="home-page social-home halls-page profile-page theme-token-scope">
    <AppHeader homeHref="/home" />
    <section className="home-shell social-shell theme-token-scope" style={{ paddingBottom: 112 }}>
      <div style={{ width: "100%", maxWidth: 760, margin: "0 auto", padding: "0 0 24px", boxSizing: "border-box" }}>
        {error ? <div role="alert" style={{ ...panel, padding: 18, color: "var(--theme-danger)" }}>{error}<button type="button" onClick={() => navigate("/signin")} style={{ display: "block", marginTop: 12, padding: 0, border: 0, background: "none", color: "var(--theme-danger-action-text)", textDecoration: "underline" }}>Sign in again</button></div> : <>
          <div style={{ ...panel, overflow: "hidden", marginBottom: 17 }}>
            <div style={{ position: "relative", height: 150, background: user?.coverPhoto ? `linear-gradient(0deg,var(--theme-overlay),transparent),url("${user.coverPhoto}") center/cover no-repeat` : "var(--theme-avatar-gradient)", borderBottom: "1px solid var(--theme-border)" }}>
              {!user?.kingsHallId && <button type="button" className="profile-cover-popout-trigger" aria-label="Cover photo actions" aria-expanded={coverActionsOpen} onClick={() => { setCoverActionsOpen(open => !open); setCoverDeleteConfirm(false); }} disabled={coverBusy || pictureBusy} title="Cover photo options" style={{ position: "absolute", right: 12, bottom: 12, width: 40, height: 40, display: "grid", placeItems: "center", border: "1px solid var(--theme-border-strong)", borderRadius: 12, background: "var(--theme-media-control-bg)", color: "var(--theme-text)", cursor: coverBusy || pictureBusy ? "wait" : "pointer", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>{coverBusy ? <LoadingDots /> : <Camera size={17} />}</button>}
              {coverActionsOpen && (coverDeleteConfirm ? <div className="profile-cover-popout" role="alertdialog" aria-label="Confirm cover photo deletion" style={{ position: "absolute", right: 12, bottom: 60, zIndex: 6, width: 188, boxSizing: "border-box", padding: 11, border: "1px solid var(--theme-border-strong)", borderRadius: 13, background: "var(--theme-popover-bg)", boxShadow: "var(--theme-shadow-card-soft)", color: "var(--theme-text-primary)", textAlign: "left" }}><div style={{ fontSize: ".76rem", fontWeight: 750, lineHeight: 1.4 }}>Delete cover photo?</div><div style={{ display: "flex", gap: 6, marginTop: 9 }}><button type="button" onClick={() => { setCoverDeleteConfirm(false); setCoverActionsOpen(false); }} style={{ flex: 1, minHeight: 29, padding: "5px 7px", border: "1px solid var(--theme-border)", borderRadius: 8, background: "var(--theme-action-secondary-bg)", color: "var(--theme-action-secondary-text)", fontSize: ".7rem" }}>Cancel</button><button type="button" onClick={() => { setCoverDeleteConfirm(false); setCoverActionsOpen(false); void removeCoverPhoto(); }} style={{ flex: 1, minHeight: 29, padding: "5px 7px", border: 0, borderRadius: 8, background: "var(--theme-danger-strong)", color: "var(--theme-text-inverse)", fontSize: ".7rem", fontWeight: 750 }}>Delete</button></div></div> : <div className="profile-cover-popout" role="group" aria-label="Cover photo actions" style={{ position: "absolute", right: 12, bottom: 60, zIndex: 5, display: "flex", alignItems: "center", gap: 7, padding: 7, border: "1px solid var(--theme-border)", borderRadius: 15, background: "var(--theme-popover-bg)", boxShadow: "var(--theme-shadow-card-soft)" }}>
                <button type="button" onClick={() => setCoverDeleteConfirm(true)} aria-label="Delete cover photo" title="Delete cover photo" disabled={coverBusy || !user?.coverPhoto} style={{ width: 34, height: 34, display: "grid", placeItems: "center", border: 0, borderRadius: 10, background: "var(--theme-danger-action-bg)", color: !user?.coverPhoto || coverBusy ? "var(--theme-disabled-text)" : "var(--theme-danger)", opacity: !user?.coverPhoto ? .55 : 1 }}><Trash2 size={17}/></button>
                <button type="button" onClick={() => { setCoverActionsOpen(false); coverInput.current?.click(); }} aria-label="Upload cover photo" title="Upload or change cover photo" disabled={coverBusy || pictureBusy} style={{ width: 34, height: 34, display: "grid", placeItems: "center", border: 0, borderRadius: 10, background: "var(--theme-accent-soft)", color: "var(--theme-primary-hover)" }}><Camera size={17}/></button>
                <button type="button" onClick={() => { setCoverActionsOpen(false); if (user?.coverPhoto) setPreviewCover(user.coverPhoto); }} aria-label="View cover photo" title="View cover photo" disabled={!user?.coverPhoto} style={{ width: 34, height: 34, display: "grid", placeItems: "center", border: 0, borderRadius: 10, background: "var(--theme-action-secondary-bg)", color: "var(--theme-text-primary)", opacity: !user?.coverPhoto ? .55 : 1 }}><Eye size={17}/></button>
              </div>)}
              <input ref={coverInput} type="file" accept="image/*" onChange={selectCoverPhoto} hidden />
            </div>
            <div style={{ padding: "0 18px 20px" }}>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginTop: -40 }}>
                <div style={{ position: "relative", width: 88, height: 88, flexShrink: 0 }}>
                  <button type="button" className="profile-picture-popout-trigger" aria-label={user?.kingsHallId ? "View profile picture" : "Profile picture actions"} aria-expanded={user?.kingsHallId ? undefined : pictureActionsOpen} onClick={() => { if (user?.kingsHallId) { if (user.profilePicture) setPreviewPicture(user.profilePicture); return; } setPictureActionsOpen(open => !open); setPictureDeleteConfirm(false); }} style={{ width: 88, height: 88, display: "grid", placeItems: "center", overflow: "hidden", padding: 0, border: "4px solid var(--theme-surface)", borderRadius: 24, background: "var(--theme-avatar-gradient)", color: "var(--theme-text-primary)", fontSize: "1.25rem", fontWeight: 850, cursor: "pointer" }}>
                    {user?.profilePicture ? <img src={user.profilePicture} alt={`${user.name || "Your"} profile`} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : loading ? <LoadingDots /> : initials}
                  </button>
                  {pictureActionsOpen && (pictureDeleteConfirm ? <div className="profile-picture-popout" role="alertdialog" aria-label="Confirm profile picture deletion" style={{ position: "absolute", left: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)", zIndex: 6, width: 188, boxSizing: "border-box", padding: 11, border: "1px solid var(--theme-border-strong)", borderRadius: 13, background: "var(--theme-popover-bg)", boxShadow: "var(--theme-shadow-card-soft)", color: "var(--theme-text-primary)", textAlign: "left" }}><div style={{ fontSize: ".76rem", fontWeight: 750, lineHeight: 1.4 }}>Delete profile picture?</div><div style={{ display: "flex", gap: 6, marginTop: 9 }}><button type="button" onClick={() => { setPictureDeleteConfirm(false); setPictureActionsOpen(false); }} style={{ flex: 1, minHeight: 29, padding: "5px 7px", border: "1px solid var(--theme-border)", borderRadius: 8, background: "var(--theme-action-secondary-bg)", color: "var(--theme-action-secondary-text)", fontSize: ".7rem" }}>Cancel</button><button type="button" onClick={() => { setPictureDeleteConfirm(false); setPictureActionsOpen(false); void removePicture(); }} style={{ flex: 1, minHeight: 29, padding: "5px 7px", border: 0, borderRadius: 8, background: "var(--theme-danger-strong)", color: "var(--theme-text-inverse)", fontSize: ".7rem", fontWeight: 750 }}>Delete</button></div></div> : <div className="profile-picture-popout" role="group" aria-label="Profile picture actions" style={{ position: "absolute", left: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)", zIndex: 5, display: "flex", alignItems: "center", gap: 7, padding: 7, border: "1px solid var(--theme-border)", borderRadius: 15, background: "var(--theme-popover-bg)", boxShadow: "var(--theme-shadow-card-soft)" }}>
                    <button type="button" onClick={() => setPictureDeleteConfirm(true)} aria-label="Delete profile picture" title="Delete profile picture" disabled={pictureBusy || !user?.profilePicture} style={{ width: 34, height: 34, display: "grid", placeItems: "center", border: 0, borderRadius: 10, background: "var(--theme-danger-action-bg)", color: !user?.profilePicture || pictureBusy ? "var(--theme-disabled-text)" : "var(--theme-danger)", opacity: !user?.profilePicture ? .55 : 1 }}><Trash2 size={17}/></button>
                    <button type="button" onClick={() => { setPictureActionsOpen(false); fileInput.current?.click(); }} aria-label="Upload profile picture" title="Upload or change picture" disabled={pictureBusy} style={{ width: 34, height: 34, display: "grid", placeItems: "center", border: 0, borderRadius: 10, background: "var(--theme-accent-soft)", color: "var(--theme-primary-hover)" }}><Camera size={17}/></button>
                    <button type="button" onClick={() => { setPictureActionsOpen(false); if (user?.profilePicture) setPreviewPicture(user.profilePicture); }} aria-label="View profile picture" title="View profile picture" disabled={!user?.profilePicture} style={{ width: 34, height: 34, display: "grid", placeItems: "center", border: 0, borderRadius: 10, background: "var(--theme-action-secondary-bg)", color: "var(--theme-text-primary)", opacity: !user?.profilePicture ? .55 : 1 }}><Eye size={17}/></button>
                  </div>)}
                  <input ref={fileInput} type="file" accept="image/*" onChange={selectPicture} hidden />
                </div>
                <span style={{ marginBottom: 7, padding: "6px 9px", border: "1px solid var(--theme-accent-border)", borderRadius: 999, color: "var(--theme-primary-hover)", fontSize: ".68rem", fontWeight: 800, letterSpacing: ".06em" }}>MY PROFILE</span>
              </div>
              <h1 style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 7, margin: "13px 0 4px", color: "var(--theme-text-primary)", fontSize: "clamp(1.4rem,5vw,1.9rem)", letterSpacing: "-.04em", overflowWrap: "anywhere" }}>{loading ? <LoadingDots /> : user?.name || "HallsChat member"}{user?.verificationStatus === "verified" && user?.verifiedAt && <VerificationBadge size={22} />}</h1>
              <p style={{ margin: 0, color: "var(--theme-primary-hover)", fontSize: ".88rem" }}>{user?.username ? `@${user.username}` : "Your HallsChat account"}</p>
              {pictureBusy && <p role="status" style={{ margin: "12px 0 0", color: "var(--theme-primary-hover)", fontSize: ".8rem" }}><LoadingDots /></p>}
              {coverBusy && <p role="status" style={{ margin: "8px 0 0", color: "var(--theme-primary-hover)", fontSize: ".8rem" }}><LoadingDots /></p>}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, padding: "8px 0 20px", color: "var(--theme-text-primary)" }}>
            <div style={{ flex: 1, textAlign: "center", borderRight: "1px solid var(--theme-border)" }}><strong style={{ display: "block", fontSize: "1.05rem" }}>{postsLoading ? "—" : posts.length.toLocaleString()}</strong><span style={{ ...muted, fontSize: ".72rem" }}>Posts</span></div>
            <button type="button" onClick={() => navigate("/halls?tab=followers")} aria-label="View your followers on Globe" title="View your followers" style={{ flex: 1, minWidth: 0, textAlign: "center", border: 0, borderRight: "1px solid var(--theme-border)", padding: 0, background: "transparent", color: "inherit", cursor: "pointer" }}><strong style={{ display: "block", fontSize: "1.05rem" }}>{loading ? "—" : (user?.followersCount ?? 0).toLocaleString()}</strong><span style={{ ...muted, fontSize: ".72rem" }}>Followers</span></button>
            <div style={{ flex: 1, textAlign: "center" }}><strong style={{ display: "block", fontSize: "1.05rem" }}>{postsLoading ? "—" : posts.reduce((sum, post) => sum + (post.likeCount || 0), 0).toLocaleString()}</strong><span style={{ ...muted, fontSize: ".72rem" }}>Likes</span></div>
          </div>

          <section style={{ marginBottom: 18 }}>
            <div role="tablist" aria-label="Profile sections" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, borderBottom: "1px solid var(--theme-border)", marginBottom: 2 }}>
              <button type="button" role="tab" aria-selected={activeProfileTab === "posts"} onClick={() => setActiveProfileTab("posts")} style={{ display: "flex", alignItems: "center", gap: 7, padding: "13px 8px", border: 0, borderBottom: activeProfileTab === "posts" ? "2px solid var(--theme-primary-hover)" : "2px solid transparent", marginBottom: -1, background: "transparent", color: activeProfileTab === "posts" ? "var(--theme-text-primary)" : "var(--theme-tabs-text)", fontSize: ".84rem", fontWeight: activeProfileTab === "posts" ? 800 : 700, cursor: "pointer" }}><FileText size={17} /> Posts</button>
              <button type="button" role="tab" aria-selected={activeProfileTab === "about"} onClick={() => setActiveProfileTab("about")} style={{ display: "flex", alignItems: "center", gap: 7, padding: "13px 8px", border: 0, borderBottom: activeProfileTab === "about" ? "2px solid var(--theme-primary-hover)" : "2px solid transparent", marginBottom: -1, background: "transparent", color: activeProfileTab === "about" ? "var(--theme-text-primary)" : "var(--theme-tabs-text)", fontSize: ".84rem", fontWeight: activeProfileTab === "about" ? 800 : 700, cursor: "pointer" }}><Mail size={16} /> About</button>
              <button type="button" role="tab" aria-selected={activeProfileTab === "verify"} onClick={() => setActiveProfileTab("verify")} style={{ display: "flex", alignItems: "center", gap: 7, padding: "13px 8px", border: 0, borderBottom: activeProfileTab === "verify" ? "2px solid var(--theme-primary-hover)" : "2px solid transparent", marginBottom: -1, background: "transparent", color: activeProfileTab === "verify" ? "var(--theme-text-primary)" : "var(--theme-tabs-text)", fontSize: ".84rem", fontWeight: activeProfileTab === "verify" ? 800 : 700, cursor: "pointer" }}><ShieldCheck size={16} /> Verify</button>
            </div>
            {activeProfileTab === "posts" ? (postsLoading ? <div style={{ display: "grid", placeItems: "center", padding: 35 }}><LoadingDots /></div> : posts.length === 0 ? <div style={{ ...panel, padding: "38px 18px", textAlign: "center", marginTop: 12 }}><FileText size={28} color="var(--theme-empty-state-icon)" /><p style={{ margin: "12px 0 5px", color: "var(--theme-text-primary)", fontWeight: 800 }}>No posts yet</p><p style={{ margin: 0, ...muted, fontSize: ".82rem" }}>Your posts will show up here.</p></div> : <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 3, marginTop: 3 }}>
              {posts.map(post => <article key={post.id} role={post.images?.[0] ? "button" : undefined} tabIndex={post.images?.[0] ? 0 : undefined} aria-label={post.images?.[0] ? "Open post image" : undefined} onClick={post.images?.[0] ? () => setPreviewPicture(post.images![0]) : undefined} onKeyDown={event => { if (post.images?.[0] && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setPreviewPicture(post.images[0]); } }} style={{ minWidth: 0, aspectRatio: "3 / 4", overflow: "hidden", position: "relative", cursor: post.images?.[0] ? "zoom-in" : "default", background: "var(--theme-card-raised)", border: "1px solid var(--theme-border)", borderRadius: 4, padding: 9, boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                {post.images?.[0] ? <img src={post.images[0]} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : null}
                {post.poll ? <div style={{ position: "absolute", inset: 0, background: "var(--theme-card-raised)", padding: 10, boxSizing: "border-box", color: "var(--theme-text-primary)", fontSize: ".8rem", fontWeight: 800, overflow: "hidden" }}>{post.poll.question}</div> : null}
                {(!post.images?.[0] && !post.poll) ? <p style={{ position: "relative", zIndex: 1, margin: 0, color: "var(--theme-text-primary)", fontSize: ".78rem", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 7, WebkitBoxOrient: "vertical" } as React.CSSProperties}>{post.content}</p> : null}
                <div style={{ position: "absolute", inset: "auto 0 0", display: "flex", alignItems: "center", gap: 5, padding: "22px 7px 6px", color: "var(--theme-text-inverse)", fontSize: ".7rem", fontWeight: 750, background: "linear-gradient(transparent,var(--theme-overlay))" }}><Eye size={13} /> {post.likeCount || 0}</div>
              </article>)}
              {postsHasMore && <div ref={postsSentinel} style={{ gridColumn: "1 / -1", display: "grid", placeItems: "center", padding: 12 }}>{postsLoadingMore && <LoadingDots />}</div>}
            </div>) : activeProfileTab === "about" ? <div style={{ ...panel, padding: 18, marginTop: 12, display: "grid", gap: 15 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <strong style={{ color: "var(--theme-text-primary)", fontSize: ".85rem" }}>Personal details</strong>
                {user?.kingsHallId && <span style={{ color: "var(--theme-text-muted)", fontSize: ".7rem", textAlign: "right" }}>Managed by KingsHall</span>}
                {!user?.kingsHallId && <button type="button" aria-label={editingProfileDetails ? "Save profile details" : "Edit full name and username"} title={user?.identityLockedAt || user?.verificationStatus === "verified" ? "Verified identity is permanent" : editingProfileDetails ? "Save changes" : user?.profileDetailsUpdatedAt && Date.now() < new Date(user.profileDetailsUpdatedAt).getTime() + 30 * 24 * 60 * 60 * 1000 ? `You can edit again on ${new Date(new Date(user.profileDetailsUpdatedAt).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}` : "Edit full name and username"} disabled={loading || profileDetailsBusy || Boolean(user?.identityLockedAt || user?.verificationStatus === "verified") || (!editingProfileDetails && Boolean(user?.profileDetailsUpdatedAt && Date.now() < new Date(user.profileDetailsUpdatedAt).getTime() + 30 * 24 * 60 * 60 * 1000))} onClick={() => { if (editingProfileDetails) void saveProfileDetails(); else { setEditName(user?.name || ""); setEditUsername(user?.username || ""); setEditingProfileDetails(true); setPictureError(""); } }} style={{ flexShrink: 0, width: 36, height: 36, display: "grid", placeItems: "center", border: "1px solid var(--theme-border)", borderRadius: 10, background: editingProfileDetails ? "var(--theme-primary)" : "var(--theme-action-secondary-bg)", color: editingProfileDetails ? "var(--theme-primary-contrast)" : "var(--theme-text-primary)", cursor: profileDetailsBusy ? "wait" : "pointer", opacity: loading || profileDetailsBusy || (!editingProfileDetails && Boolean(user?.profileDetailsUpdatedAt && Date.now() < new Date(user.profileDetailsUpdatedAt).getTime() + 30 * 24 * 60 * 60 * 1000)) ? .55 : 1 }} aria-busy={profileDetailsBusy}>{profileDetailsBusy ? <LoadingDots /> : editingProfileDetails ? <Check size={18} /> : <Pencil size={16} />}</button>}
              </div>
              {!editingProfileDetails && user?.profileDetailsUpdatedAt && Date.now() < new Date(user.profileDetailsUpdatedAt).getTime() + 30 * 24 * 60 * 60 * 1000 && <p style={{ margin: "-5px 0 0", color: "var(--theme-muted)", fontSize: ".72rem", lineHeight: 1.5 }}>Name and username can be changed again on {new Date(new Date(user.profileDetailsUpdatedAt).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}.</p>}
              <div><div style={{ ...muted, fontSize: ".72rem", marginBottom: 4 }}>Full name</div>{editingProfileDetails ? <input aria-label="Full name" autoComplete="name" maxLength={80} value={editName} onChange={event => setEditName(event.target.value.toLocaleLowerCase().replace(/(^|\\s)(\\S)/g, (_match, space: string, character: string) => space + character.toLocaleUpperCase()))} placeholder="Full name" style={{ display: "block", width: "100%", boxSizing: "border-box", padding: "10px 11px", border: "1px solid var(--theme-border-strong)", borderRadius: 10, background: "var(--theme-surface)", color: "var(--theme-text-primary)", font: "inherit", fontSize: ".92rem" }} /> : <div style={{ color: "var(--theme-text-primary)", fontSize: ".92rem", fontWeight: 700, overflowWrap: "anywhere" }}>{user?.name || "—"}</div>}</div>
              <div><div style={{ ...muted, fontSize: ".72rem", marginBottom: 4 }}>Username</div>{editingProfileDetails ? <><input aria-label="Username" autoComplete="username" minLength={3} maxLength={24} value={editUsername} onChange={event => setEditUsername(event.target.value.toLowerCase().replace(/\\s/g, ""))} placeholder="Username" style={{ display: "block", width: "100%", boxSizing: "border-box", padding: "10px 11px", border: "1px solid var(--theme-border-strong)", borderRadius: 10, background: "var(--theme-surface)", color: "var(--theme-primary-hover)", font: "inherit", fontSize: ".92rem" }} /><small style={{ display: "block", marginTop: 6, color: "var(--theme-muted)", fontSize: ".7rem" }}>Use 3–24 lowercase letters, numbers, underscores or periods.</small></> : <div style={{ color: "var(--theme-primary-hover)", fontSize: ".92rem", fontWeight: 700, overflowWrap: "anywhere" }}>{user?.username ? `@${user.username}` : "—"}</div>}</div>
              <div><div style={{ ...muted, fontSize: ".72rem", marginBottom: 4 }}>Email</div><div style={{ color: "var(--theme-text-primary)", fontSize: ".92rem", fontWeight: 600, overflowWrap: "anywhere" }}>{user?.email || "—"}</div></div>
              <div><div style={{ ...muted, fontSize: ".72rem", marginBottom: 4 }}>Joined HallsChat</div><div style={{ color: "var(--theme-text-primary)", fontSize: ".92rem", fontWeight: 600 }}>{user?.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "—"}</div></div>
            </div> : <VerificationPanel />}
          </section>

          <div style={{ marginTop: 4 }}>
            <button type="button" className="button button-secondary" onClick={() => {
              const token = localStorage.getItem("hallschat_token");
              if (token) void fetch((import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "") + "/api/auth/logout", { method: "POST", headers: { Authorization: "Bearer " + token } }).catch(() => undefined);
              localStorage.removeItem("hallschat_token");
              navigate("/signin", { replace: true });
            }} style={{ width: "100%", minHeight: 44, justifyContent: "center" }}><LogOut size={16} /> Logout</button>
          </div>
        </>}
      </div>
    </section>
    {coverCropSource && <StoryImageCropModal imageUrl={coverCropSource} onCancel={cancelCoverCrop} onDone={confirmCroppedCover} title="Edit cover photo" aspectRatio={3} />}
    {cropSource && <StoryImageCropModal imageUrl={cropSource} onCancel={cancelCrop} onDone={confirmCroppedPicture} title="Edit profile picture" aspectRatio={1} />}
    {previewPicture && <ImagePreviewModal imageUrl={previewPicture} onClose={() => setPreviewPicture(null)} />}
    {previewCover && <ImagePreviewModal imageUrl={previewCover} onClose={() => setPreviewCover(null)} />}
    {pictureError && <div className="halls-toast halls-toast-error" role="alert"><span>{pictureError}</span><button type="button" onClick={() => setPictureError("")} aria-label="Dismiss notification">×</button></div>}
    <NowBar />
  </main>;
}
