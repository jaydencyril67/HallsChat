import { ChangeEvent, useEffect, useRef, useState } from "react";
import { FileText, Camera, Trash2, LogOut, Eye, Mail } from "lucide-react";
import AppHeader from "./AppHeader";
import NowBar from "./NowBar";
import LoadingDots from "./components/LoadingDots";
import ImagePreviewModal from "./components/ImagePreviewModal";
import ProfileImageCropModal from "./components/ProfileImageCropModal";
import { navigate } from "./utils/navigate";

type Account = { id: string; name: string; username: string; email: string; createdAt?: string; profilePicture?: string; coverPhoto?: string; followersCount?: number };
type Post = { id: string; content: string; createdAt: string; author: { id: string; name: string; username: string } | null; likeCount?: number; images?: string[]; poll?: { question: string } | null };
type ImageKitAuth = { token: string; expire: number; signature: string; publicKey: string };
const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");
const MAX_PROFILE_IMAGE_SIZE = 10 * 1024 * 1024;

export default function ProfilePage() {
  const [user, setUser] = useState<Account | null>(null);
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(true);
  const [error, setError] = useState("");
  const [pictureError, setPictureError] = useState("");
  const [pictureBusy, setPictureBusy] = useState(false);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [previewPicture, setPreviewPicture] = useState<string | null>(null);
  const [pictureActionsOpen, setPictureActionsOpen] = useState(false);
  const [pictureDeleteConfirm, setPictureDeleteConfirm] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverCropSource, setCoverCropSource] = useState<string | null>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pictureError) return;
    const timer = window.setTimeout(() => setPictureError(""), 5000);
    return () => window.clearTimeout(timer);
  }, [pictureError]);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("hallschat_token");
    if (!token) { navigate("/signin", { replace: true }); return; }
    fetch(`${apiBase}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.user) throw new Error(payload.message || "Your profile couldn't be loaded.");
        return payload.user as Account;
      })
      .then(account => { if (!cancelled) setUser(account); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "Your profile couldn't be loaded."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    fetch(`${apiBase}/api/social/feed?limit=100`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || "Your posts couldn't be loaded.");
        return Array.isArray(payload.posts) ? payload.posts as Post[] : [];
      })
      .then(items => { if (!cancelled) setAllPosts(items); })
      .catch(() => { if (!cancelled) setAllPosts([]); })
      .finally(() => { if (!cancelled) setPostsLoading(false); });
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
      const uploadResponse = await fetch("https://upload.imagekit.io/api/v1/files/upload", { method: "POST", body: formData });
      const uploadPayload = await uploadResponse.json().catch(() => ({}));
      if (!uploadResponse.ok || typeof uploadPayload.url !== "string") throw new Error(uploadPayload.message || "Your cover photo couldn't upload.");
      const saveResponse = await fetch(`${apiBase}/api/auth/cover-photo`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ coverPhoto: uploadPayload.url })
      });
      const savePayload = await saveResponse.json().catch(() => ({}));
      if (!saveResponse.ok) throw new Error(savePayload.message || "Your cover photo couldn't be saved.");
      setUser(current => current ? { ...current, coverPhoto: savePayload.coverPhoto } : current);
      setPictureError("");
    } catch (err) {
      setPictureError(err instanceof Error ? err.message : "Your cover photo couldn't be saved.");
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
      const uploadResponse = await fetch("https://upload.imagekit.io/api/v1/files/upload", { method: "POST", body: formData });
      const uploadPayload = await uploadResponse.json().catch(() => ({}));
      if (!uploadResponse.ok || typeof uploadPayload.url !== "string") throw new Error(uploadPayload.message || "Your profile picture couldn't upload.");
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
    } catch (err) {
      setPictureError(err instanceof Error ? err.message : "Your profile picture couldn't be saved.");
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
      <div style={{ width: "100%", maxWidth: 760, margin: "0 auto", padding: "12px 0 24px", boxSizing: "border-box" }}>
        {error ? <div role="alert" style={{ ...panel, padding: 18, color: "#ff9cab" }}>{error}<button type="button" onClick={() => navigate("/signin")} style={{ display: "block", marginTop: 12, padding: 0, border: 0, background: "none", color: "#ffd4db", textDecoration: "underline" }}>Sign in again</button></div> : <>
          <div style={{ ...panel, overflow: "hidden", marginBottom: 17 }}>
            <div style={{ position: "relative", height: 150, background: user?.coverPhoto ? `linear-gradient(0deg,rgba(24,6,11,.3),rgba(24,6,11,.08)),url("${user.coverPhoto}") center/cover no-repeat` : "radial-gradient(ellipse at 78% 15%,rgba(231,82,104,.32),transparent 48%),linear-gradient(125deg,#48121f,#21090f 78%)", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
              <button type="button" onClick={() => coverInput.current?.click()} disabled={coverBusy || pictureBusy} aria-label="Upload or change cover photo" title="Upload or change cover photo" style={{ position: "absolute", right: 12, bottom: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 36, padding: "8px 11px", border: "1px solid rgba(255,255,255,.2)", borderRadius: 11, background: "rgba(25,7,12,.82)", color: "#fff0f3", fontSize: ".74rem", fontWeight: 750, cursor: coverBusy || pictureBusy ? "wait" : "pointer", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>{coverBusy ? <LoadingDots /> : <Camera size={16} />}{coverBusy ? "Uploading…" : user?.coverPhoto ? "Change cover" : "Add cover photo"}</button>
              <input ref={coverInput} type="file" accept="image/*" onChange={selectCoverPhoto} hidden />
            </div>
            <div style={{ padding: "0 18px 20px" }}>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginTop: -40 }}>
                <div style={{ position: "relative", width: 88, height: 88, flexShrink: 0 }}>
                  <button type="button" aria-label="Profile picture actions" aria-expanded={pictureActionsOpen} onClick={() => { setPictureActionsOpen(open => !open); setPictureDeleteConfirm(false); }} style={{ width: 88, height: 88, display: "grid", placeItems: "center", overflow: "hidden", padding: 0, border: "4px solid #21090f", borderRadius: 24, background: "linear-gradient(145deg,#a72a43,#48121f)", color: "#fff0f3", fontSize: "1.25rem", fontWeight: 850, cursor: "pointer" }}>
                    {user?.profilePicture ? <img src={user.profilePicture} alt={`${user.name || "Your"} profile`} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : loading ? <LoadingDots /> : initials}
                  </button>
                  {pictureActionsOpen && (pictureDeleteConfirm ? <div role="alertdialog" aria-label="Confirm profile picture deletion" style={{ position: "absolute", left: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)", zIndex: 6, width: 188, boxSizing: "border-box", padding: 11, border: "1px solid rgba(255,210,219,.2)", borderRadius: 13, background: "#21090f", boxShadow: "0 10px 28px #0009", color: "#fff0f3", textAlign: "left" }}><div style={{ fontSize: ".76rem", fontWeight: 750, lineHeight: 1.4 }}>Delete profile picture?</div><div style={{ display: "flex", gap: 6, marginTop: 9 }}><button type="button" onClick={() => { setPictureDeleteConfirm(false); setPictureActionsOpen(false); }} style={{ flex: 1, minHeight: 29, padding: "5px 7px", border: "1px solid rgba(255,210,219,.15)", borderRadius: 8, background: "rgba(255,255,255,.06)", color: "#f5dce1", fontSize: ".7rem" }}>Cancel</button><button type="button" onClick={() => { setPictureDeleteConfirm(false); setPictureActionsOpen(false); void removePicture(); }} style={{ flex: 1, minHeight: 29, padding: "5px 7px", border: 0, borderRadius: 8, background: "#b92d45", color: "#fff", fontSize: ".7rem", fontWeight: 750 }}>Delete</button></div></div> : <div role="group" aria-label="Profile picture actions" style={{ position: "absolute", left: "calc(100% + 8px)", top: "50%", transform: "translateY(-50%)", zIndex: 5, display: "flex", alignItems: "center", gap: 7, padding: 7, border: "1px solid rgba(255,210,219,.18)", borderRadius: 15, background: "#21090f", boxShadow: "0 10px 28px #0008" }}>
                    <button type="button" onClick={() => setPictureDeleteConfirm(true)} aria-label="Delete profile picture" title="Delete profile picture" disabled={pictureBusy || !user?.profilePicture} style={{ width: 34, height: 34, display: "grid", placeItems: "center", border: 0, borderRadius: 10, background: "rgba(220,55,78,.15)", color: !user?.profilePicture || pictureBusy ? "#82525b" : "#ff8192", opacity: !user?.profilePicture ? .55 : 1 }}><Trash2 size={17}/></button>
                    <button type="button" onClick={() => { setPictureActionsOpen(false); fileInput.current?.click(); }} aria-label="Upload profile picture" title="Upload or change picture" disabled={pictureBusy} style={{ width: 34, height: 34, display: "grid", placeItems: "center", border: 0, borderRadius: 10, background: "rgba(197,46,73,.22)", color: "#ffb3bf" }}><Camera size={17}/></button>
                    <button type="button" onClick={() => { setPictureActionsOpen(false); if (user?.profilePicture) setPreviewPicture(user.profilePicture); }} aria-label="View profile picture" title="View profile picture" disabled={!user?.profilePicture} style={{ width: 34, height: 34, display: "grid", placeItems: "center", border: 0, borderRadius: 10, background: "rgba(255,255,255,.07)", color: "#fff0f3", opacity: !user?.profilePicture ? .55 : 1 }}><Eye size={17}/></button>
                  </div>)}
                  <input ref={fileInput} type="file" accept="image/*" onChange={selectPicture} hidden />
                </div>
                <span style={{ marginBottom: 7, padding: "6px 9px", border: "1px solid rgba(232,90,110,.24)", borderRadius: 999, color: "#f09aa7", fontSize: ".68rem", fontWeight: 800, letterSpacing: ".06em" }}>MY PROFILE</span>
              </div>
              <h1 style={{ margin: "13px 0 4px", color: "#fff0f3", fontSize: "clamp(1.4rem,5vw,1.9rem)", letterSpacing: "-.04em", overflowWrap: "anywhere" }}>{loading ? "Loading profile…" : user?.name || "HallsChat member"}</h1>
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
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 34, borderBottom: "1px solid rgba(255,255,255,.1)", marginBottom: 2 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "13px 8px", borderBottom: "2px solid #f08b9b", color: "#fff0f3", fontSize: ".84rem", fontWeight: 800 }}><FileText size={17} /> Posts</div>
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "13px 8px", color: "rgba(246,220,225,.45)", fontSize: ".84rem", fontWeight: 700 }}><Mail size={16} /> About</div>
            </div>
            {postsLoading ? <div style={{ display: "grid", placeItems: "center", padding: 35 }}><LoadingDots /></div> : posts.length === 0 ? <div style={{ ...panel, padding: "38px 18px", textAlign: "center", marginTop: 12 }}><FileText size={28} color="#e77b8d" /><p style={{ margin: "12px 0 5px", color: "#fff0f3", fontWeight: 800 }}>No posts yet</p><p style={{ margin: 0, ...muted, fontSize: ".82rem" }}>Your posts will show up here.</p></div> : <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 3, marginTop: 3 }}>
              {posts.map(post => <article key={post.id} style={{ minWidth: 0, aspectRatio: "3 / 4", overflow: "hidden", position: "relative", background: "linear-gradient(145deg,rgba(95,29,44,.9),rgba(28,9,15,.95))", border: "1px solid rgba(255,255,255,.06)", borderRadius: 4, padding: 9, boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                {post.images?.[0] ? <img src={post.images[0]} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : null}
                {post.poll ? <div style={{ position: "absolute", inset: 0, background: "linear-gradient(145deg,#5b1b2c,#200910)", padding: 10, boxSizing: "border-box", color: "#fff0f3", fontSize: ".8rem", fontWeight: 800, overflow: "hidden" }}>{post.poll.question}</div> : null}
                {(!post.images?.[0] && !post.poll) ? <p style={{ position: "relative", zIndex: 1, margin: 0, color: "#fff0f3", fontSize: ".78rem", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 7, WebkitBoxOrient: "vertical" } as React.CSSProperties}>{post.content}</p> : null}
                <div style={{ position: "absolute", inset: "auto 0 0", display: "flex", alignItems: "center", gap: 5, padding: "22px 7px 6px", color: "#fff", fontSize: ".7rem", fontWeight: 750, background: "linear-gradient(transparent,rgba(0,0,0,.78))" }}><Eye size={13} /> {post.likeCount || 0}</div>
              </article>)}
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
    {coverCropSource && <ProfileImageCropModal imageUrl={coverCropSource} onCancel={cancelCoverCrop} onDone={confirmCroppedCover} title="Edit cover photo" aspectRatio={3} />}
    {cropSource && <ProfileImageCropModal imageUrl={cropSource} onCancel={cancelCrop} onDone={confirmCroppedPicture} title="Edit profile picture" />}
    {previewPicture && <ImagePreviewModal imageUrl={previewPicture} onClose={() => setPreviewPicture(null)} />}
    {pictureError && <div className="halls-toast halls-toast-error" role="alert"><span>{pictureError}</span><button type="button" onClick={() => setPictureError("")} aria-label="Dismiss notification">×</button></div>}
    <NowBar />
  </main>;
}
