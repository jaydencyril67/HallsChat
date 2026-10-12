import { ChangeEvent, useEffect, useRef, useState } from "react";
import { FileText, Camera, Trash2, LogOut, Eye, Mail } from "lucide-react";
import AppHeader from "./AppHeader";
import NowBar from "./NowBar";
import LoadingDots from "./components/LoadingDots";
import ImagePreviewModal from "./components/ImagePreviewModal";
import StoryImageCropModal from "./components/StoryImageCropModal";
import { navigate } from "./utils/navigate";
import { finishBackgroundTask, startBackgroundTask, updateBackgroundTask } from "./utils/backgroundTasks";

type Account = { id: string; name: string; username: string; email: string; createdAt?: string; profilePicture?: string; coverPhoto?: string; followersCount?: number };
type Post = { id: string; content: string; createdAt: string; author: { id: string; name: string; username: string } | null; likeCount?: number; images?: string[]; poll?: { question: string; options?: { id: string; text: string; voteCount: number; votedByMe?: boolean }[] } | null };
type ImageKitAuth = { token: string; expire: number; signature: string; publicKey: string };
const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");
const MAX_PROFILE_IMAGE_SIZE = 10 * 1024 * 1024;

export default function ProfilePage() {
  const [user, setUser] = useState<Account | null>(null);
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [activeProfileTab, setActiveProfileTab] = useState<"posts" | "about">("posts");
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
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
        const accountResponse = await fetch(\`\${apiBase}/api/auth/me\`, {
          headers: { Authorization: \`Bearer \${token}\` }
        });
        const accountPayload = await accountResponse.json().catch(() => ({}));
        if (!accountResponse.ok || !accountPayload.user) {
          throw new Error(accountPayload.message || "Your profile couldn't be loaded.");
        }
        const account = accountPayload.user as Account;
        if (cancelled) return;
        setUser(account);
        setLoading(false);

        const postsResponse = await fetch(\`\${apiBase}/api/social/users/\${encodeURIComponent(account.id)}\`, {
          headers: { Authorization: \`Bearer \${token}\` }
        });
        const postsPayload = await postsResponse.json().catch(() => ({}));
        if (!postsResponse.ok) throw new Error(postsPayload.message || "Your posts couldn't be loaded.");
        const items = Array.isArray(postsPayload.posts) ? postsPayload.posts as Omit<Post, "author">[] : [];
        if (!cancelled) {
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


  const posts = allPosts.filter(post => Boolean(user?.id) && post.author?.id === user?.id);
  const initials = user?.name?.trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase() || "H";
  const panel: React.CSSProperties = { border: "1px solid rgba(255,210,219,.11)", borderRadius: 17, background: "linear-gradient(145deg,rgba(57,17,27,.58),rgba(28,9,15,.8))" };
  const muted: React.CSSProperties = { color: "rgba(246,220,225,.58)" };

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

  return <main className="home-page social-home halls-page">
    <AppHeader homeHref="/home" />
    <section className="home-shell social-shell" style={{ paddingBottom: 112 }}>
      <div style={{ width: "100%", maxWidth: 760, margin: "0 auto", padding: "0 0 24px", boxSizing: "border-box" }}>
        {error ? <div role="alert" style={{ ...panel, padding: 18, color: "#ff9cab" }}>{error}<button type="button" onClick={() => navigate("/signin")} style={{ display: "block", marginTop: 12, padding: 0, border: 0, background: "none", color: "#ffd4db", textDecoration: "underline" }}>Sign in again</button></div> : <>
          <div style={{ ...panel, overflow: "hidden", marginBottom: 17 }}>
            <div style={{ position: "relative", height: 150, background: user?.coverPhoto ? `linear-gradient(0deg,rgba(24,6,11,.3),rgba(24,6,11,.08)),url("${user.coverPhoto}") center/cover no-repeat` : "radial-gradient(ellipse at 78% 15%,rgba(231,82,104,.32),transparent 48%),linear-gradient(125deg,#48121f,#21090f 78%)", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
              <button type="button" className="profile-cover-popout-trigger" aria-label="Cover photo actions" aria-expanded={coverActionsOpen} onClick={() => { setCoverActionsOpen(open => !open); setCoverDeleteConfirm(false); }} disabled={coverBusy || pictureBusy} title="Cover photo options" style={{ position: "absolute", right: 12, bottom: 12, width: 40, height: 40, display: "grid", placeItems: "center", border: "1px solid rgba(255,255,255,.2)", borderRadius: 12, background: "rgba(25,7,12,.82)", color: "#fff0f3", cursor: coverBusy || pictureBusy ? "wait" : "pointer", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>{coverBusy ? <LoadingDots /> : <Camera size={17} />}</button>
              {coverActionsOpen && (coverDeleteConfirm ? <div className="profile-cover-popout" role="alertdialog" aria-label="Confirm cover photo deletion" style={{ position: "absolute", right: 12, bottom: 60, zIndex: 6, width: 188, boxSizing: "border-box", padding: 11, border: "1px solid rgba(255,210,219,.2)", borderRadius: 13, background: "#21090f", boxShadow: "0 10px 28px #0009", color: "#fff0f3", textAlign: "left" }}><div style={{ fontSize: ".76rem", fontWeight: 750, lineHeight: 1.4 }}>Delete cover photo?</div><div style={{ display: "flex", gap: 6, marginTop: 9 }}><button type="button" onClick={() => { setCoverDeleteConfirm(false); setCoverActionsOpen(false); }} style={{ flex: 1, minHeight: 29, padding: "5px 7px", border: "1px solid rgba(255,210,219,.15)", borderRadius: 8, background: "rgba(255,255,255,.06)", color: "#f5dce1", fontSize: ".7rem" }}>Cancel</button><button type="button" onClick={() => { setCoverDeleteConfirm(false); setCoverActionsOpen(false); void removeCoverPhoto(); }} style={{ flex: 1, minHeight: 29, padding: "5px 7px", border: 0, borderRadius: 8, background: "#b92d45", color: "#fff", fontSize: ".7rem", fontWeight: 750 }}>Delete</button></div></div> : <div className="profile-cover-popout" role="group" aria-label="Cover photo actions" style={{ position: "absolute", right: 12, bottom: 60, zIndex: 5, display: "flex", alignItems: "center", gap: 7, padding: 7, border: "1px solid rgba(255,210,219,.18)", borderRadius: 15, background: "#21090f", boxShadow: "0 10px 28px #0008" }}>
                <button type="button" onClick={() => setCoverDeleteConfirm(true)} aria-label="Delete cover photo" title="Delete cover photo" disabled={coverBusy || !user?.coverPhoto} style={{ width: 34, height: 34, display: "grid", placeItems: "center", border: 0, borderRadius: 10, background: "rgba(220,55,78,.15)", color: !user?.coverPhoto || coverBusy ? "#82525b" : "#ff8192", opacity: !user?.coverPhoto ? .55 : 1 }}><Trash2 size={17}/></button>
                <button type="button" onClick={() => { setCoverActionsOpen(false); coverInput.current?.click(); }} aria-label="Upload cover photo" title="Upload or change cover photo" disabled={coverBusy || pictureBusy} style={{ width: 34, height: 34, display: "grid", placeItems: "center", border: 0, borderRadius: 10, background: "rgba(197,46,73,.22)", color: "#ffb3bf" }}><Camera size={17}/></button>
                <button type="button" onClick={() => { setCoverActionsOpen(false); if (user?.coverPhoto) setPreviewCover(user.coverPhoto); }} aria-label="View cover photo" title="View cover photo" disabled={!user?.coverPhoto} style={{ width: 34, height: 34, display: "grid", placeItems: "center", border: 0, borderRadius: 10, background: "rgba(255,255,255,.07)", color: "#fff0f3", opacity: !user?.coverPhoto ? .55 : 1 }}><Eye size={17}/></button>
              </div>)}
              <input ref={coverInput} type="file" accept="image/*" onChange={selectCoverPhoto} hidden />
            </div>
            <div style={{ padding: "0 18px 20px" }}>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginTop: -40 }}>
                <div style={{ position: "relative", width: 88, height: 88, flexShrink: 0 }}>
                  <button type="button" className="profile-picture-popout-trigger" aria-label="Profile picture actions" aria-expanded={pictureActionsOpen} onClick={() => { setPictureActionsOpen(open => !open); setPictureDeleteConfirm(false); }} style={{ width: 88, height: 88, display: "grid", placeItems: "center", overflow: "hidden", padding: 0, border: "4px solid #21090f", borderRadius: 24, background: "linear-gradient(145deg,#a72a43,#48121f)", color: "#fff0f3", fontSize: "1.25rem", fontWeight: 850, cursor: "pointer" }}>
                    {user?.profilePicture ? <img src={user.profilePicture} alt={`${user.name || "Your"} profile`} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : loading ? <LoadingDots /> : initials}
                  </button>
                  {pictureActionsOpen && (pictureDeleteConfirm ? <div className="profile-picture-popout" role="alertdialog" aria-label="Confirm profile picture deletion" style={{ position: "absolute", left: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)", zIndex: 6, width: 188, boxSizing: "border-box", padding: 11, border: "1px solid rgba(255,210,219,.2)", borderRadius: 13, background: "#21090f", boxShadow: "0 10px 28px #0009", color: "#fff0f3", textAlign: "left" }}><div style={{ fontSize: ".76rem", fontWeight: 750, lineHeight: 1.4 }}>Delete profile picture?</div><div style={{ display: "flex", gap: 6, marginTop: 9 }}><button type="button" onClick={() => { setPictureDeleteConfirm(false); setPictureActionsOpen(false); }} style={{ flex: 1, minHeight: 29, padding: "5px 7px", border: "1px solid rgba(255,210,219,.15)", borderRadius: 8, background: "rgba(255,255,255,.06)", color: "#f5dce1", fontSize: ".7rem" }}>Cancel</button><button type="button" onClick={() => { setPictureDeleteConfirm(false); setPictureActionsOpen(false); void removePicture(); }} style={{ flex: 1, minHeight: 29, padding: "5px 7px", border: 0, borderRadius: 8, background: "#b92d45", color: "#fff", fontSize: ".7rem", fontWeight: 750 }}>Delete</button></div></div> : <div className="profile-picture-popout" role="group" aria-label="Profile picture actions" style={{ position: "absolute", left: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)", zIndex: 5, display: "flex", alignItems: "center", gap: 7, padding: 7, border: "1px solid rgba(255,210,219,.18)", borderRadius: 15, background: "#21090f", boxShadow: "0 10px 28px #0008" }}>
                    <button type="button" onClick={() => setPictureDeleteConfirm(true)} aria-label="Delete profile picture" title="Delete profile picture" disabled={pictureBusy || !user?.profilePicture} style={{ width: 34, height: 34, display: "grid", placeItems: "center", border: 0, borderRadius: 10, background: "rgba(220,55,78,.15)", color: !user?.profilePicture || pictureBusy ? "#82525b" : "#ff8192", opacity: !user?.profilePicture ? .55 : 1 }}><Trash2 size={17}/></button>
                    <button type="button" onClick={() => { setPictureActionsOpen(false); fileInput.current?.click(); }} aria-label="Upload profile picture" title="Upload or change picture" disabled={pictureBusy} style={{ width: 34, height: 34, display: "grid", placeItems: "center", border: 0, borderRadius: 10, background: "rgba(197,46,73,.22)", color: "#ffb3bf" }}><Camera size={17}/></button>
                    <button type="button" onClick={() => { setPictureActionsOpen(false); if (user?.profilePicture) setPreviewPicture(user.profilePicture); }} aria-label="View profile picture" title="View profile picture" disabled={!user?.profilePicture} style={{ width: 34, height: 34, display: "grid", placeItems: "center", border: 0, borderRadius: 10, background: "rgba(255,255,255,.07)", color: "#fff0f3", opacity: !user?.profilePicture ? .55 : 1 }}><Eye size={17}/></button>
                  </div>)}
                  <input ref={fileInput} type="file" accept="image/*" onChange={selectPicture} hidden />
                </div>
                <span style={{ marginBottom: 7, padding: "6px 9px", border: "1px solid rgba(232,90,110,.24)", borderRadius: 999, color: "#f09aa7", fontSize: ".68rem", fontWeight: 800, letterSpacing: ".06em" }}>MY PROFILE</span>
              </div>
              <h1 style={{ margin: "13px 0 4px", color: "#fff0f3", fontSize: "clamp(1.4rem,5vw,1.9rem)", letterSpacing: "-.04em", overflowWrap: "anywhere" }}>{loading ? <><LoadingDots /> Loading profile…</> : user?.name || "HallsChat member"}</h1>
              <p style={{ margin: 0, color: "#e69aa7", fontSize: ".88rem" }}>{user?.username ? `@${user.username}` : "Your HallsChat account"}</p>
              {pictureBusy && <p role="status" style={{ margin: "12px 0 0", color: "#f09aa7", fontSize: ".8rem" }}><LoadingDots /> Saving profile picture…</p>}
              {coverBusy && <p role="status" style={{ margin: "8px 0 0", color: "#f09aa7", fontSize: ".8rem" }}><LoadingDots /> Saving cover photo…</p>}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, padding: "8px 0 20px", color: "#fff0f3" }}>
            <div style={{ flex: 1, textAlign: "center", borderRight: "1px solid rgba(255,255,255,.1)" }}><strong style={{ display: "block", fontSize: "1.05rem" }}>{postsLoading ? "—" : posts.length.toLocaleString()}</strong><span style={{ ...muted, fontSize: ".72rem" }}>Posts</span></div>
            <div style={{ flex: 1, textAlign: "center", borderRight: "1px solid rgba(255,255,255,.1)" }}><strong style={{ display: "block", fontSize: "1.05rem" }}>{loading ? "—" : (user?.followersCount ?? 0).toLocaleString()}</strong><span style={{ ...muted, fontSize: ".72rem" }}>Followers</span></div>
            <div style={{ flex: 1, textAlign: "center" }}><strong style={{ display: "block", fontSize: "1.05rem" }}>{postsLoading ? "—" : posts.reduce((sum, post) => sum + (post.likeCount || 0), 0).toLocaleString()}</strong><span style={{ ...muted, fontSize: ".72rem" }}>Likes</span></div>
          </div>

          <section style={{ marginBottom: 18 }}>
            <div role="tablist" aria-label="Profile sections" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 34, borderBottom: "1px solid rgba(255,255,255,.1)", marginBottom: 2 }}>
              <button type="button" role="tab" aria-selected={activeProfileTab === "posts"} onClick={() => setActiveProfileTab("posts")} style={{ display: "flex", alignItems: "center", gap: 7, padding: "13px 8px", border: 0, borderBottom: activeProfileTab === "posts" ? "2px solid #f08b9b" : "2px solid transparent", marginBottom: -1, background: "transparent", color: activeProfileTab === "posts" ? "#fff0f3" : "rgba(246,220,225,.45)", fontSize: ".84rem", fontWeight: activeProfileTab === "posts" ? 800 : 700, cursor: "pointer" }}><FileText size={17} /> Posts</button>
              <button type="button" role="tab" aria-selected={activeProfileTab === "about"} onClick={() => setActiveProfileTab("about")} style={{ display: "flex", alignItems: "center", gap: 7, padding: "13px 8px", border: 0, borderBottom: activeProfileTab === "about" ? "2px solid #f08b9b" : "2px solid transparent", marginBottom: -1, background: "transparent", color: activeProfileTab === "about" ? "#fff0f3" : "rgba(246,220,225,.45)", fontSize: ".84rem", fontWeight: activeProfileTab === "about" ? 800 : 700, cursor: "pointer" }}><Mail size={16} /> About</button>
            </div>
            {activeProfileTab === "posts" ? (postsLoading ? <div style={{ display: "grid", placeItems: "center", padding: 35 }}><LoadingDots /></div> : posts.length === 0 ? <div style={{ ...panel, padding: "38px 18px", textAlign: "center", marginTop: 12 }}><FileText size={28} color="#e77b8d" /><p style={{ margin: "12px 0 5px", color: "#fff0f3", fontWeight: 800 }}>No posts yet</p><p style={{ margin: 0, ...muted, fontSize: ".82rem" }}>Your posts will show up here.</p></div> : <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 3, marginTop: 3 }}>
              {posts.map(post => <article key={post.id} role={post.images?.[0] ? "button" : undefined} tabIndex={post.images?.[0] ? 0 : undefined} aria-label={post.images?.[0] ? "Open post image" : undefined} onClick={post.images?.[0] ? () => setPreviewPicture(post.images![0]) : undefined} onKeyDown={event => { if (post.images?.[0] && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setPreviewPicture(post.images[0]); } }} style={{ minWidth: 0, aspectRatio: "3 / 4", overflow: "hidden", position: "relative", cursor: post.images?.[0] ? "zoom-in" : "default", background: "linear-gradient(145deg,rgba(95,29,44,.9),rgba(28,9,15,.95))", border: "1px solid rgba(255,255,255,.06)", borderRadius: 4, padding: 9, boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                {post.images?.[0] ? <img src={post.images[0]} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : null}
                {post.poll ? <div style={{ position: "absolute", inset: 0, background: "linear-gradient(145deg,#5b1b2c,#200910)", padding: 10, boxSizing: "border-box", color: "#fff0f3", fontSize: ".8rem", fontWeight: 800, overflow: "hidden" }}>{post.poll.question}</div> : null}
                {(!post.images?.[0] && !post.poll) ? <p style={{ position: "relative", zIndex: 1, margin: 0, color: "#fff0f3", fontSize: ".78rem", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 7, WebkitBoxOrient: "vertical" } as React.CSSProperties}>{post.content}</p> : null}
                <div style={{ position: "absolute", inset: "auto 0 0", display: "flex", alignItems: "center", gap: 5, padding: "22px 7px 6px", color: "#fff", fontSize: ".7rem", fontWeight: 750, background: "linear-gradient(transparent,rgba(0,0,0,.78))" }}><Eye size={13} /> {post.likeCount || 0}</div>
              </article>)}
            </div>) : <div style={{ ...panel, padding: 18, marginTop: 12, display: "grid", gap: 15 }}>
              <div><div style={{ ...muted, fontSize: ".72rem", marginBottom: 4 }}>Full name</div><div style={{ color: "#fff0f3", fontSize: ".92rem", fontWeight: 700, overflowWrap: "anywhere" }}>{user?.name || "—"}</div></div>
              <div><div style={{ ...muted, fontSize: ".72rem", marginBottom: 4 }}>Username</div><div style={{ color: "#f09aa7", fontSize: ".92rem", fontWeight: 700, overflowWrap: "anywhere" }}>{user?.username ? `@${user.username}` : "—"}</div></div>
              <div><div style={{ ...muted, fontSize: ".72rem", marginBottom: 4 }}>Email</div><div style={{ color: "#fff0f3", fontSize: ".92rem", fontWeight: 600, overflowWrap: "anywhere" }}>{user?.email || "—"}</div></div>
              <div><div style={{ ...muted, fontSize: ".72rem", marginBottom: 4 }}>Joined HallsChat</div><div style={{ color: "#fff0f3", fontSize: ".92rem", fontWeight: 600 }}>{user?.createdAt ? new Date(user.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "—"}</div></div>
            </div>}
          </section>

          <div style={{ marginTop: 4 }}>
            <button type="button" className="button button-secondary" onClick={() => {
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
