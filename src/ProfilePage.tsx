import { ChangeEvent, PointerEvent, useEffect, useRef, useState } from "react";
import { CalendarDays, FileText, Mail, UserRound, AtSign, ArrowLeft, UsersRound, Camera, Check, X, ZoomIn, Trash2 } from "lucide-react";
import AppHeader from "./AppHeader";
import NowBar from "./NowBar";
import LoadingDots from "./components/LoadingDots";
import ImagePreviewModal from "./components/ImagePreviewModal";
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
  const [cropFileName, setCropFileName] = useState("profile-picture.jpg");
  const [zoom, setZoom] = useState(1);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{ x: number; y: number; originX: number; originY: number } | null>(null);
  const [previewPicture, setPreviewPicture] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cropBox = useRef<HTMLDivElement>(null);
  const cropImage = useRef<HTMLImageElement>(null);

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

  useEffect(() => () => { if (cropSource) URL.revokeObjectURL(cropSource); }, [cropSource]);

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
    setCropFileName(file.name.replace(/\.[^.]+$/, "") || "profile-picture");
    setZoom(1);
    setDrag({ x: 0, y: 0 });
  }

  function onCropPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!cropSource) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragStart({ x: event.clientX, y: event.clientY, originX: drag.x, originY: drag.y });
  }
  function onCropPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!dragStart || !cropBox.current) return;
    const rect = cropBox.current.getBoundingClientRect();
    const limitX = Math.max(0, (rect.width * zoom - rect.width) / 2);
    const limitY = Math.max(0, (rect.height * zoom - rect.height) / 2);
    setDrag({
      x: Math.max(-limitX, Math.min(limitX, dragStart.originX + event.clientX - dragStart.x)),
      y: Math.max(-limitY, Math.min(limitY, dragStart.originY + event.clientY - dragStart.y))
    });
  }

  async function savePicture() {
    if (!cropSource || !cropImage.current || !cropBox.current || pictureBusy) return;
    const token = localStorage.getItem("hallschat_token");
    if (!token) { navigate("/signin", { replace: true }); return; }
    setPictureBusy(true);
    setPictureError("");
    try {
      const image = cropImage.current;
      const box = cropBox.current.getBoundingClientRect();
      const scale = Math.max(box.width / image.naturalWidth, box.height / image.naturalHeight) * zoom;
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      const offsetX = (box.width - drawWidth) / 2 + drag.x;
      const offsetY = (box.height - drawHeight) / 2 + drag.y;
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Your browser couldn't prepare the cropped picture.");
      context.drawImage(image, offsetX * (512 / box.width), offsetY * (512 / box.height), drawWidth * (512 / box.width), drawHeight * (512 / box.height));
      const croppedBlob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("The cropped picture couldn't be prepared.")), "image/jpeg", 0.88));
      const authResponse = await fetch(`${apiBase}/api/media/imagekit-auth`, { headers: { Authorization: `Bearer ${token}` } });
      const authPayload = await authResponse.json().catch(() => ({}));
      if (!authResponse.ok) throw new Error(authPayload.message || "Image upload couldn't be prepared.");
      const auth = authPayload as ImageKitAuth;
      if (!auth.token || !auth.signature || !auth.publicKey || !auth.expire) throw new Error("Image upload authentication is incomplete.");
      const formData = new FormData();
      formData.append("file", croppedBlob, `${cropFileName}.jpg`);
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
        <button type="button" onClick={() => navigate("/home")} style={{ display: "inline-flex", alignItems: "center", gap: 7, margin: "0 0 17px", padding: "8px 11px", border: "1px solid rgba(255,210,219,.12)", borderRadius: 10, background: "rgba(255,255,255,.025)", color: "#e9cbd1", fontSize: ".78rem" }}><ArrowLeft size={15} /> Back to home</button>
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
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 13 }}>
                <button type="button" onClick={() => fileInput.current?.click()} disabled={pictureBusy} className="button button-primary" style={{ minHeight: 37, fontSize: ".78rem" }}><Camera size={15} /> {user?.profilePicture ? "Change photo" : "Add profile photo"}</button>
                {user?.profilePicture && <button type="button" onClick={() => void removePicture()} disabled={pictureBusy} className="button button-secondary" style={{ minHeight: 37, fontSize: ".78rem" }}><Trash2 size={14} /> Remove</button>}
              </div>
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

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="button button-primary" onClick={() => navigate("/halls")}><UsersRound size={16} /> Find people</button>
            <button type="button" className="button button-secondary" onClick={() => navigate("/settings")}>Settings</button>
          </div>
        </>}
      </div>
    </section>
    {cropSource && <div role="dialog" aria-modal="true" aria-label="Crop profile picture" style={{ position: "fixed", inset: 0, zIndex: 200, display: "grid", placeItems: "center", padding: 18, background: "rgba(5,2,4,.86)", backdropFilter: "blur(12px)" }}>
      <section style={{ width: "min(100%,430px)", maxHeight: "92dvh", overflowY: "auto", padding: 18, border: "1px solid rgba(255,210,219,.15)", borderRadius: 20, background: "linear-gradient(145deg,#35101a,#16070c)", boxShadow: "0 24px 90px #0009" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 15 }}><div><h2 style={{ margin: 0, color: "#fff0f3", fontSize: "1.05rem" }}>Adjust profile photo</h2><p style={{ margin: "5px 0 0", color: "#c7a5ac", fontSize: ".77rem" }}>Drag to position · Pinch or zoom to adjust</p></div><button type="button" onClick={() => setCropSource(null)} aria-label="Cancel crop" disabled={pictureBusy} style={{ display: "grid", placeItems: "center", width: 35, height: 35, border: "1px solid #ffffff1c", borderRadius: 11, background: "#ffffff08", color: "#f6dce1" }}><X size={18}/></button></div>
        <div ref={cropBox} onPointerDown={onCropPointerDown} onPointerMove={onCropPointerMove} onPointerUp={() => setDragStart(null)} onPointerCancel={() => setDragStart(null)} style={{ position: "relative", width: "min(100%,340px)", aspectRatio: "1", margin: "0 auto", overflow: "hidden", border: "2px solid rgba(255,210,219,.5)", borderRadius: 22, background: "#0a0406", touchAction: "none", cursor: dragStart ? "grabbing" : "grab" }}>
          <img ref={cropImage} src={cropSource} alt="Crop preview" draggable={false} onLoad={() => { setZoom(1); setDrag({ x: 0, y: 0 }); }} style={{ position: "absolute", width: "100%", height: "100%", inset: 0, objectFit: "cover", transform: `translate(${drag.x}px,${drag.y}px) scale(${zoom})`, transformOrigin: "center", maxWidth: "none", pointerEvents: "none", userSelect: "none" }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "17px 0 19px", color: "#e9cbd1" }}><ZoomIn size={17}/><input aria-label="Photo zoom" type="range" min="1" max="3" step=".05" value={zoom} onChange={event => { setZoom(Number(event.target.value)); setDrag({ x: 0, y: 0 }); }} style={{ flex: 1, accentColor: "#d8425b" }}/><span style={{ minWidth: 40, fontSize: ".75rem", textAlign: "right" }}>{zoom.toFixed(1)}×</span></div>
        <div style={{ display: "flex", gap: 9 }}><button type="button" onClick={() => { setCropSource(null); setDrag({ x: 0, y: 0 }); }} disabled={pictureBusy} className="button button-secondary" style={{ flex: 1, justifyContent: "center" }}>Cancel</button><button type="button" onClick={() => void savePicture()} disabled={pictureBusy} className="button button-primary" style={{ flex: 1, justifyContent: "center" }}>{pictureBusy ? <><LoadingDots /> Saving…</> : <><Check size={16}/> Save photo</>}</button></div>
      </section>
    </div>}
    {previewPicture && <ImagePreviewModal imageUrl={previewPicture} onClose={() => setPreviewPicture(null)} />}
    <NowBar />
  </main>;
}
