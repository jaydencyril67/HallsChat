import { ChangeEvent, useEffect, useRef, useState } from "react";
import { CalendarDays, FileText, Mail, UserRound, AtSign, UsersRound, Camera, Trash2, LogOut } from "lucide-react";
import AppHeader from "./AppHeader";
import NowBar from "./NowBar";
import LoadingDots from "./components/LoadingDots";
import ImagePreviewModal from "./components/ImagePreviewModal";
import ProfileImageCropModal from "./components/ProfileImageCropModal";
import { navigate } from "./utils/navigate";

type Account = { id: string; name: string; username: string; email: string; createdAt?: string; profilePicture?: string };
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
  const fileInput = useRef<HTMLInputElement>(null);

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
            <div style={{ height: 112, background: "radial-gradient(ellipse at 78% 15%,rgba(231,82,104,.32),transparent 48%),linear-gradient(125deg,#48121f,#21090f 78%)", borderBottom: "1px solid rgba(255,255,255,.06)" }} />
            <div style={{ padding: "0 18px 20px" }}>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, marginTop: -40 }}>
                <div style={{ position: "relative", width: 88, height: 88, flexShrink: 0 }}>
                  <button type="button" aria-label="Preview profile picture" onClick={() => user?.profilePicture && setPreviewPicture(user.profilePicture)} style={{ width: 88, height: 88, display: "grid", placeItems: "center", overflow: "hidden", padding: 0, border: "4px solid #21090f", borderRadius: 24, background: "linear-gradient(145deg,#a72a43,#48121f)", color: "#fff0f3", fontSize: "1.25rem", fontWeight: 850 }}>
                    {user?.profilePicture ? <img src={user.profilePicture} alt={`${user.name || "Your"} profile`} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : loading ? <LoadingDots /> : initials}
                  </button>
                  <button type="button" onClick={() => fileInput.current?.click()} aria-label="Upload profile picture" title="Change profile picture" disabled={pictureBusy} style={{ position: "absolute", right: -5, bottom: -5, display: "grid", placeItems: "center", width: 31, height: 31, padding: 0, border: "2px solid #21090f", borderRadius: 11, background: "#c52e49", color: "#fff", boxShadow: "0 4px 14px #0005" }}><Camera size={15} /></button>
                  <input ref={fileInput} type="file" accept="image/*" onChange={selectPicture} hidden />
                </div>
                <span style={{ marginBottom: 7, padding: "6px 9px", border: "1px solid rgba(232,90,110,.24)", borderRadius: 999, color: "#f09aa7", fontSize: ".68rem", fontWeight: 800, letterSpacing: ".06em" }}>MY PROFILE</span>
              </div>
              <h1 style={{ margin: "13px 0 4px", color: "#fff0f3", fontSize: "clamp(1.4rem,5vw,1.9rem)", letterSpacing: "-.04em", overflowWrap: "anywhere" }}>{loading ? "Loading profile…" : user?.name || "HallsChat member"}</h1>
              <p style={{ margin: 0, color: "#e69aa7", fontSize: ".88rem" }}>{user?.username ? `@${user.username}` : "Your HallsChat account"}</p>
              {user?.profilePicture && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 13 }}>
                <button type="button" onClick={() => void removePicture()} disabled={pictureBusy} className="button button-secondary" style={{ minHeight: 37, fontSize: ".78rem" }}><Trash2 size={14} /> Remove</button>
              </div>}
              {pictureBusy && <p role="status" style={{ margin: "12px 0 0", color: "#f09aa7", fontSize: ".8rem" }}><LoadingDots /> Saving profile picture…</p>}
              {pictureError && <p role="alert" style={{ margin: "12px 0 0", color: "#ff9cab", fontSize: ".8rem", lineHeight: 1.5 }}>{pictureError}</p>}
              <p style={{ margin: "12px 0 0", ...muted, fontSize: ".76rem", lineHeight: 1.6 }}>Choose a photo, adjust the square crop, then save. JPG, PNG, WebP and other image formats up to 10 MB are supported.</p>
              <p style={{ margin: "12px 0 0", ...muted, fontSize: ".84rem", lineHeight: 1.7 }}>Your space on HallsChat. Keep up with your posts and the details connected to your account.</p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10, marginBottom: 18 }}>
            <div style={{ ...panel, padding: 14 }}><div style={{ display: "flex", alignItems: "center", gap: 8, color: "#f08b9b", fontSize: ".75rem", fontWeight: 750 }}><FileText size={16} /> Your posts</div><strong style={{ display: "block", marginTop: 10, fontSize: "1.45rem", color: "#fff0f3" }}>{postsLoading ? "—" : posts.length}</strong><span style={{ display: "block", marginTop: 3, ...muted, fontSize: ".72rem" }}>Posts in your recent feed</span></div>
            <div style={{ ...panel, padding: 14 }}><div style={{ display: "flex", alignItems: "center", gap: 8, color: "#f08b9b", fontSize: ".75rem", fontWeight: 750 }}><UsersRound size={16} /> Community</div><strong style={{ display: "block", marginTop: 10, fontSize: "1.45rem", color: "#fff0f3" }}>Halls</strong><span style={{ display: "block", marginTop: 3, ...muted, fontSize: ".72rem" }}>Discover people to follow</span></div>
          </div>

          <section style={{ ...panel, padding: 16, marginBottom: 18 }}>
            <h2 style={{ margin: "0 0 14px", color: "#fff0f3", fontSize: ".98rem" }}>Account details</h2>
            <div style={{ display: "grid", gap: 15 }}>
              <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}><UserRound size={17} color="#e77b8d" /><div style={{ minWidth: 0 }}><span style={{ display: "block", ...muted, fontSize: ".72rem" }}>Full name</span><strong style={{ display: "block", marginTop: 4, color: "#f3dfe3", fontSize: ".84rem", overflowWrap: "anywhere" }}>{loading ? "Loading…" : user?.name || "Not available"}</strong></div></div>
              <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}><AtSign size={17} color="#e77b8d" /><div style={{ minWidth: 0 }}><span style={{ display: "block", ...muted, fontSize: ".72rem" }}>Username</span><strong style={{ display: "block", marginTop: 4, color: "#f3dfe3", fontSize: ".84rem", overflowWrap: "anywhere" }}>{user?.username ? `@${user.username}` : "Not available"}</strong></div></div>
              <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}><Mail size={17} color="#e77b8d" /><div style={{ minWidth: 0, flex: 1 }}><span style={{ display: "block", ...muted, fontSize: ".72rem" }}>Email address</span><strong style={{ display: "block", marginTop: 4, color: "#f3dfe3", fontSize: ".84rem", overflowWrap: "anywhere" }}>{user?.email || "Not available"}</strong></div></div>
              {user?.createdAt && <div style={{ display: "flex", gap: 11, alignItems: "flex-start" }}><CalendarDays size={17} color="#e77b8d" /><div><span style={{ display: "block", ...muted, fontSize: ".72rem" }}>Member since</span><strong style={{ display: "block", marginTop: 4, color: "#f3dfe3", fontSize: ".84rem" }}>{new Date(user.createdAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</strong></div></div>}
            </div>
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
    {cropSource && <ProfileImageCropModal imageUrl={cropSource} onCancel={cancelCrop} onDone={savePicture} />}
    {previewPicture && <ImagePreviewModal imageUrl={previewPicture} onClose={() => setPreviewPicture(null)} />}
    <NowBar />
  </main>;
}
