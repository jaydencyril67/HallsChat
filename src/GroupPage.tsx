import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Compass, LockKeyhole, MessageCircle, Plus, Send, UsersRound, UserPlus, X, Check, LogOut, Trash2, RefreshCw, AlertTriangle, Image as ImageIcon, Camera, Mic, Play, Pause, Square, Reply, MoreVertical, Pencil, Smile, Paperclip, Phone, Video } from "lucide-react";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import type { ChangeEvent } from "react";
import ImagePreviewModal from "./components/ImagePreviewModal";
import StoryImageCropModal from "./components/StoryImageCropModal";
import AppHeader from "./AppHeader";
import GroupCallPanel from "./components/GroupCallPanel";
import NowBar from "./NowBar";
import LoadingDots from "./components/LoadingDots";
import { finishBackgroundTask, startBackgroundTask, updateBackgroundTask } from "./utils/backgroundTasks";

const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");
type GroupSummary = { id: string; name: string; description: string; visibility: "public" | "private"; avatar?: string; ownerId: string; memberCount: number; role: string | null; inviteCode?: string; createdAt: string; updatedAt: string; lastMessage?: { text: string; createdAt: string; senderName: string } | null };
type Member = { id: string; name: string; username: string; profilePicture?: string; role: "owner" | "admin" | "member"; joinedAt?: string };
type GroupReply = { id: string; senderId: string; text?: string; imageUrl?: string; audioUrl?: string; deleted?: boolean };
type GroupReaction = { userId: string; emoji: string };
type GroupMessage = { id: string; text: string; imageUrl?: string; images?: string[]; audioUrl?: string; replyTo?: GroupReply | null; reactions?: GroupReaction[]; deletedForEveryone?: boolean; createdAt: string; editedAt?: string | null; pending?: boolean; callLog?: { kind: "audio" | "video"; status: "ringing" | "missed" | "declined" | "cancelled" | "completed" | "failed"; durationSeconds: number; callerId: string; startedAt?: string; endedAt?: string } | null; sender: { id: string; name: string; username: string; profilePicture?: string } | null };
type GroupDetail = GroupSummary & { members: Member[] };
type Tab = "mine" | "discover";

const panel: React.CSSProperties = { border: "1px solid rgba(255,210,219,.12)", borderRadius: 16, background: "linear-gradient(145deg,rgba(57,17,27,.58),rgba(28,9,15,.84))" };
const muted: React.CSSProperties = { color: "rgba(246,220,225,.62)" };
const field: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "12px 13px", borderRadius: 11, border: "1px solid rgba(255,210,219,.15)", background: "rgba(10,5,8,.42)", color: "#fff0f3", outline: "none", font: "inherit", fontSize: ".86rem" };
const primary: React.CSSProperties = { minHeight: 40, border: "1px solid rgba(222,68,89,.65)", borderRadius: 11, padding: "10px 14px", background: "linear-gradient(135deg,#c52d44,#8f172c)", color: "#fff6f7", fontSize: ".82rem", fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 };
const secondary: React.CSSProperties = { minHeight: 38, border: "1px solid rgba(255,210,219,.16)", borderRadius: 10, padding: "9px 12px", background: "rgba(255,255,255,.04)", color: "#f8e8eb", fontSize: ".8rem", fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7 };

function initials(value: string) { return value.trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase() || "H"; }
function formatTime(value: string) { const date = new Date(value); if (!Number.isFinite(date.getTime())) return ""; return date.toLocaleDateString() === new Date().toLocaleDateString() ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : date.toLocaleDateString([], { month: "short", day: "numeric" }); }
function Avatar({ name, src, size = 44 }: { name: string; src?: string; size?: number }) {
  return <span style={{ width: size, height: size, flexShrink: 0, borderRadius: size > 50 ? 16 : "50%", overflow: "hidden", display: "grid", placeItems: "center", border: "1px solid rgba(236,102,121,.28)", background: "linear-gradient(145deg,#713040,#35121d)", color: "#ffe4e9", fontSize: size > 50 ? "1.1rem" : ".78rem", fontWeight: 850 }}>{src ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : initials(name)}</span>;
}

async function compressGroupImage(file: File): Promise<File> {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error(`Couldn't read ${file.name}.`));
      element.src = sourceUrl;
    });
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image compression isn't available in this browser.");
    context.imageSmoothingEnabled = true; context.imageSmoothingQuality = "high"; context.drawImage(image, 0, 0, width, height);
    const encode = (target: HTMLCanvasElement, type: string, quality: number) => new Promise<Blob>((resolve, reject) => target.toBlob(blob => blob ? resolve(blob) : reject(new Error("This image couldn't be compressed.")), type, quality));
    let blob = await encode(canvas, "image/webp", 0.82);
    let type = blob.type === "image/webp" ? "image/webp" : "image/jpeg";
    if (type === "image/jpeg") {
      const jpegCanvas = document.createElement("canvas"); jpegCanvas.width = width; jpegCanvas.height = height;
      const jpegContext = jpegCanvas.getContext("2d");
      if (!jpegContext) throw new Error("Image compression isn't available in this browser.");
      jpegContext.fillStyle = "#fff"; jpegContext.fillRect(0, 0, width, height); jpegContext.drawImage(image, 0, 0, width, height);
      blob = await encode(jpegCanvas, "image/jpeg", 0.82);
    }
    const extension = type === "image/webp" ? "webp" : "jpg";
    const baseName = file.name.replace(/\.[^.]+$/, "") || "group-image";
    return new File([blob], `${baseName}.${extension}`, { type, lastModified: Date.now() });
  } finally { URL.revokeObjectURL(sourceUrl); }
}

function formatGroupAudioTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  return Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0");
}

function GroupVoiceNotePlayer({ src, pending = false }: { src: string; pending?: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const draggingRef = useRef(false);
  const bars = [3,5,8,12,7,15,10,18,13,6,11,16,8,20,12,7,15,10,22,13,6,17,11,8,19,12,5,14,9,18,7,12,20,9,5,15,11,7,17,10,4,13];
  const progress = duration > 0 ? currentTime / duration : 0;
  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      try { await audio.play(); setPlaying(true); } catch { setPlaying(false); }
    } else { audio.pause(); setPlaying(false); }
  }
  function seek(clientX: number, waveform: HTMLDivElement) {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const rect = waveform.getBoundingClientRect();
    if (rect.width <= 0) return;
    audio.currentTime = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)) * audio.duration;
    setCurrentTime(audio.currentTime);
  }
  return <div className={"chat-voice-note" + (pending ? " chat-voice-note-pending" : "")}>
    <audio ref={audioRef} src={src} preload="metadata" onLoadedMetadata={event => setDuration(event.currentTarget.duration || 0)} onDurationChange={event => setDuration(event.currentTarget.duration || 0)} onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); setCurrentTime(0); }} />
    <button type="button" className="chat-voice-play" onClick={() => void togglePlayback()} aria-label={playing ? "Pause voice note" : "Play voice note"}>{playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button>
    <div className="chat-voice-track">
      <div className="chat-voice-waveform" role="slider" aria-label="Voice note playback position" aria-valuemin={0} aria-valuemax={Math.floor(duration || 0)} aria-valuenow={Math.floor(currentTime)} tabIndex={0} onPointerDown={event => { if (event.pointerType === "mouse" && event.button !== 0) return; event.preventDefault(); draggingRef.current = true; event.currentTarget.setPointerCapture(event.pointerId); seek(event.clientX, event.currentTarget); }} onPointerMove={event => { if (draggingRef.current) seek(event.clientX, event.currentTarget); }} onPointerUp={event => { if (draggingRef.current) seek(event.clientX, event.currentTarget); draggingRef.current = false; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={event => { draggingRef.current = false; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onKeyDown={event => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); const audio = audioRef.current; if (audio && Number.isFinite(audio.duration)) { audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + (event.key === "ArrowRight" ? 5 : -5))); setCurrentTime(audio.currentTime); } } }}>
        {bars.map((height, index) => <span key={index} className={index / bars.length <= progress ? "is-played" : ""} style={{ height: height + "px" }} />)}
      </div>
      <div className="chat-voice-meta"><span>{playing || currentTime > 0 ? formatGroupAudioTime(currentTime) : formatGroupAudioTime(duration)}</span>{pending && <span className="chat-voice-sending">Sending…</span>}</div>
    </div>
    <span className="chat-voice-mic"><Mic size={13} /></span>
  </div>;
}
export default function GroupPage() {
  const [tab, setTab] = useState<Tab>("mine");
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [activeId, setActiveId] = useState("");
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const groupMessageListRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [groupCode, setGroupCode] = useState("");
  const [groupCodeStatus, setGroupCodeStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid" | "error">("idle");
  const [groupCodeMessage, setGroupCodeMessage] = useState("");
  const [groupAvatarFile, setGroupAvatarFile] = useState<File | null>(null);
  const [groupAvatarPreview, setGroupAvatarPreview] = useState("");
  const [groupAvatarCropSource, setGroupAvatarCropSource] = useState<string | null>(null);
  const groupAvatarInputRef = useRef<HTMLInputElement | null>(null);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [inviteCode, setInviteCode] = useState("");
  const [draft, setDraft] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [compressingImages, setCompressingImages] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<GroupMessage | null>(null);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [actionMenuFor, setActionMenuFor] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editMessageDraft, setEditMessageDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordingPaused, setRecordingPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceDraft, setVoiceDraft] = useState<File | null>(null);
  const [voiceDraftUrl, setVoiceDraftUrl] = useState("");
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const [groupSocket, setGroupSocket] = useState<Socket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const discardRecordingRef = useRef(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const draftInputRef = useRef<HTMLTextAreaElement | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const otherTypingTimerRef = useRef<number | null>(null);
  const messageGestureRef = useRef<{ id: string; startX: number; startY: number; longPressed: boolean; timer: number | null } | null>(null);
  const [memberPanel, setMemberPanel] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState<null | (() => Promise<void>)>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const askConfirm = (message: string, action: () => Promise<void>) => { setConfirmMessage(message); setConfirmAction(() => action); };

  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    const token = localStorage.getItem("hallschat_token");
    if (!token) { window.location.href = "/signin"; throw new Error("Please sign in to continue."); }
    const response = await fetch(apiBase + path, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers || {}) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || "That action couldn't be completed.");
    return payload;
  }, []);

  useEffect(() => {
    const value = groupCode.trim();
    if (!value) { setGroupCodeStatus("idle"); setGroupCodeMessage(""); return; }
    if (!/^\d{8}$/.test(value)) { setGroupCodeStatus("invalid"); setGroupCodeMessage("Enter exactly 8 digits to check availability."); return; }
    const controller = new AbortController();
    setGroupCodeStatus("checking");
    setGroupCodeMessage("Checking Group ID…");
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(apiBase + "/api/groups/id-availability?inviteCode=" + encodeURIComponent(value), { signal: controller.signal });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || "Group ID availability could not be checked.");
        if (controller.signal.aborted) return;
        if (payload.valid === false) { setGroupCodeStatus("invalid"); setGroupCodeMessage(payload.message || "Enter a valid Group ID."); }
        else if (payload.available) { setGroupCodeStatus("available"); setGroupCodeMessage("Group ID is available."); }
        else { setGroupCodeStatus("taken"); setGroupCodeMessage(payload.message || "That Group ID is already taken."); }
      } catch (err) {
        if (controller.signal.aborted) return;
        setGroupCodeStatus("error");
        setGroupCodeMessage(err instanceof Error ? err.message : "Group ID availability could not be checked.");
      }
    }, 450);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [groupCode]);

  useEffect(() => {
    let cancelled = false;
    void request("/api/auth/me").then(payload => {
      if (!cancelled) setCurrentUserId(payload.user?.id || "");
    }).catch(() => {
      if (!cancelled) setCurrentUserId("");
    });
    return () => { cancelled = true; };
  }, [request]);

  const loadGroups = useCallback(async (activeTab: Tab, showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const payload = await request("/api/groups?view=" + activeTab);
      setGroups(Array.isArray(payload.groups) ? payload.groups : []);
      setError("");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load groups."); }
    finally { if (showLoader) setLoading(false); }
  }, [request]);

  const loadDetail = useCallback(async (id: string, showLoader = true) => {
    if (!id) return;
    if (showLoader) setDetailLoading(true);
    try {
      const payload = await request("/api/groups/" + encodeURIComponent(id));
      setDetail(payload.group || null);
      setMessages(Array.isArray(payload.messages) ? payload.messages : []);
      setError("");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to open this group."); }
    finally { if (showLoader) setDetailLoading(false); }
  }, [request]);

  useEffect(() => {
    void loadGroups(tab);
    const token = localStorage.getItem("hallschat_token");
    if (!token) return;
    let hasConnected = false;
    const socket = io(apiBase, { auth: { token }, transports: ["websocket", "polling"] });
    socket.on("connect", () => {
      if (hasConnected) void loadGroups(tab, false);
      hasConnected = true;
    });
    socket.on("groups:list:update", () => { void loadGroups(tab, false); });
    return () => { socket.removeAllListeners(); socket.disconnect(); };
  }, [tab, loadGroups]);
  useEffect(() => { if (!activeId) { setDetail(null); setMessages([]); return; } void loadDetail(activeId); }, [activeId, loadDetail]);
  useEffect(() => { const list = groupMessageListRef.current; if (list) list.scrollTop = list.scrollHeight; }, [activeId, messages.length]);
  useEffect(() => {
    if (!activeId) { socketRef.current?.disconnect(); socketRef.current = null; setGroupSocket(null); return; }
    const token = localStorage.getItem("hallschat_token");
    if (!token) return;
    const socket = io(apiBase, { auth: { token }, transports: ["websocket", "polling"] });
    socketRef.current = socket;
    setGroupSocket(socket);
    let hasConnected = false;
    socket.on("connect", () => {
      const reconnecting = hasConnected;
      hasConnected = true;
      socket.emit("group:join", { groupId: activeId }, (result: { ok?: boolean }) => {
        if (!result?.ok) setError("Live group updates are unavailable. You can still refresh messages.");
        else if (reconnecting) void loadDetail(activeId, false);
      });
    });
    socket.on("group:message", (message: GroupMessage) => {
      setMessages(current => current.some(item => item.id === message.id) ? current.map(item => item.id === message.id ? { ...item, ...message } : item) : [...current, message].sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
      setOtherTyping(false);
    });
    socket.on("group:call-log:update", (event: { id: string; callLog: NonNullable<GroupMessage["callLog"]> }) => {
      setMessages(current => current.map(item => item.id === event.id ? { ...item, callLog: event.callLog } : item));
    });
    socket.on("group:reaction", (event: { groupId?: string; id?: string; reactions?: GroupReaction[] }) => {
      if (event.groupId !== activeId || !event.id || !Array.isArray(event.reactions)) return;
      setMessages(current => current.map(message => message.id === event.id ? { ...message, reactions: event.reactions } : message));
    });
    socket.on("group:edited", (event: { groupId?: string; id?: string; text?: string; editedAt?: string | null }) => {
      if (event.groupId !== activeId || !event.id) return;
      setMessages(current => current.map(message => message.id === event.id ? { ...message, text: event.text || "", editedAt: event.editedAt } : message));
    });
    socket.on("group:deleted", (event: { groupId?: string; id?: string }) => {
      if (event.groupId !== activeId || !event.id) return;
      setMessages(current => current.map(message => message.id === event.id ? { ...message, text: "", imageUrl: "", images: [], audioUrl: "", deletedForEveryone: true } : message));
    });
    socket.on("group:typing", (event: { groupId?: string; senderId?: string; isTyping?: boolean }) => {
      if (event.groupId !== activeId || event.senderId === currentUserId) return;
      if (otherTypingTimerRef.current !== null) window.clearTimeout(otherTypingTimerRef.current);
      setOtherTyping(Boolean(event.isTyping));
      if (event.isTyping) {
        otherTypingTimerRef.current = window.setTimeout(() => {
          setOtherTyping(false);
          otherTypingTimerRef.current = null;
        }, 2500);
      } else {
        otherTypingTimerRef.current = null;
      }
    });
    return () => { if (typingTimerRef.current !== null) window.clearTimeout(typingTimerRef.current); typingTimerRef.current = null; if (otherTypingTimerRef.current !== null) window.clearTimeout(otherTypingTimerRef.current); otherTypingTimerRef.current = null; setOtherTyping(false); socket.emit("group:typing", { groupId: activeId, isTyping: false }); socket.emit("group:leave", { groupId: activeId }); socket.removeAllListeners(); socket.disconnect(); if (socketRef.current === socket) socketRef.current = null; setGroupSocket(current => current === socket ? null : current); };
  }, [activeId, currentUserId, loadDetail]);
  useEffect(() => {
    const input = draftInputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 144)}px`;
  }, [draft]);
  useEffect(() => {
    const closePopoutsOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) { setReactionPickerFor(null); setActionMenuFor(null); setAttachmentMenuOpen(false); return; }
      if (!target.closest(".chat-reaction-picker")) setReactionPickerFor(null);
      if (!target.closest(".chat-message-actions, .chat-message-more")) setActionMenuFor(null);
      if (!target.closest(".chat-attachment-menu, .chat-attachment-wrap")) setAttachmentMenuOpen(false);
    };
    document.addEventListener("pointerdown", closePopoutsOutside);
    return () => document.removeEventListener("pointerdown", closePopoutsOutside);
  }, []);
  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setRecordingSeconds(value => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);
  useEffect(() => () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") { discardRecordingRef.current = true; mediaRecorderRef.current.stop(); }
    recordingStreamRef.current?.getTracks().forEach(track => track.stop());
    if (typingTimerRef.current !== null) window.clearTimeout(typingTimerRef.current);
  }, []);

  const filteredGroups = useMemo(() => groups.filter(group => (group.name + " " + group.description).toLowerCase().includes(search.trim().toLowerCase())), [groups, search]);

  function cancelGroupAvatarCrop() {
    if (groupAvatarCropSource) URL.revokeObjectURL(groupAvatarCropSource);
    setGroupAvatarCropSource(null);
  }

  async function confirmGroupAvatarCrop(croppedFile: File) {
    if (groupAvatarCropSource) URL.revokeObjectURL(groupAvatarCropSource);
    setGroupAvatarCropSource(null);
    await new Promise<void>(resolve => window.setTimeout(resolve, 0));
    if (groupAvatarPreview) URL.revokeObjectURL(groupAvatarPreview);
    setGroupAvatarFile(croppedFile);
    setGroupAvatarPreview(URL.createObjectURL(croppedFile));
    setError("");
  }

  async function createGroup(event: React.FormEvent) {
    event.preventDefault();
    if (name.trim().length < 2) { setError("Group name must be at least 2 characters."); return; }
    if (!/^\d{8}$/.test(groupCode)) { setError("Choose a Group ID made of exactly 8 digits."); return; }
    if (groupCodeStatus !== "available") { setError(groupCodeStatus === "checking" ? "Please wait while we check your Group ID." : groupCodeStatus === "taken" ? "That Group ID is already taken. Choose another one." : groupCodeStatus === "error" ? "We couldn’t check Group ID availability. Please try again." : "Please enter a valid, available Group ID."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      let avatar = "";
      const token = localStorage.getItem("hallschat_token");
      if (groupAvatarFile && token) avatar = await uploadGroupMedia(groupAvatarFile, token);
       const payload = await request("/api/groups", { method: "POST", body: JSON.stringify({ name: name.trim(), description: description.trim(), visibility, groupCode, ...(avatar ? { avatar } : {}) }) });
      setShowCreate(false); setName(""); setDescription(""); setGroupCode(""); setGroupCodeStatus("idle"); setGroupCodeMessage(""); setVisibility("public"); setGroupAvatarFile(null); setGroupAvatarPreview("");
      setTab("mine");
      await loadGroups("mine"); if (payload.group?.id) setActiveId(payload.group.id);
      setNotice(payload.group?.inviteCode ? "Group created. Your 8-digit Group ID is " + payload.group.inviteCode + ". Save it to share with people." : "Your group is ready.");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to create group."); }
    finally { setBusy(false); }
  }

  async function joinGroup(id?: string, code?: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const payload = await request("/api/groups/join", { method: "POST", body: JSON.stringify(id ? { groupId: id } : { groupCode: code }) });
      setShowJoin(false); setInviteCode(""); setNotice("You joined " + (payload.group?.name || "the group") + ".");
      setTab("mine"); await loadGroups("mine"); if (payload.group?.id) setActiveId(payload.group.id);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to join this group."); }
    finally { setBusy(false); }
  }

  async function uploadGroupMedia(file: File, savedToken: string): Promise<string> {
    const authResponse = await fetch(`${apiBase}/api/media/imagekit-auth`, { headers: { Authorization: `Bearer ${savedToken}` } });
    const auth = await authResponse.json().catch(() => ({}));
    if (!authResponse.ok) throw new Error(auth.message || "Media uploads are not configured yet.");
    const form = new FormData();
    form.append("file", file);
    form.append("fileName", `hallschat-group-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`);
    form.append("publicKey", auth.publicKey); form.append("token", auth.token); form.append("expire", String(auth.expire)); form.append("signature", auth.signature);
    const response = await fetch("https://upload.imagekit.io/api/v1/files/upload", { method: "POST", body: form });
    const uploaded = await response.json().catch(() => ({}));
    if (!response.ok || typeof uploaded.url !== "string") throw new Error(uploaded.message || "The attachment couldn't be uploaded.");
    return uploaded.url;
  }
  async function handleImageSelection(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files || []); event.target.value = "";
    if (!picked.length) return;
    if (imageFiles.length + picked.length > 4) { setError("You can attach up to 4 images per message."); return; }
    if (picked.some(file => !file.type.startsWith("image/"))) { setError("Choose image files only."); return; }
    if (picked.some(file => file.size > 10 * 1024 * 1024)) { setError("Each original image must be 10 MB or smaller."); return; }
    setCompressingImages(true); setAttachmentMenuOpen(false); setError("");
    try {
      const compressed = await Promise.all(picked.map(compressGroupImage));
      setImageFiles(current => [...current, ...compressed]);
      setImagePreviews(current => [...current, ...compressed.map(file => URL.createObjectURL(file))]);
    } catch (err) { setError(err instanceof Error ? err.message : "One or more images couldn't be prepared."); }
    finally { setCompressingImages(false); }
  }
  function removeSelectedImage(index: number) {
    if (imagePreviews[index]) URL.revokeObjectURL(imagePreviews[index]);
    setImageFiles(current => current.filter((_, i) => i !== index));
    setImagePreviews(current => current.filter((_, i) => i !== index));
  }
  async function recordVoiceNote() {
    if (recording) { mediaRecorderRef.current?.pause(); setRecording(false); setRecordingPaused(true); return; }
    if (recordingPaused) { mediaRecorderRef.current?.resume(); setRecording(true); setRecordingPaused(false); return; }
    if (voiceBusy || voiceDraft) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setError("Voice recording is not supported by this browser or app."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); recordingStreamRef.current = stream; recordingChunksRef.current = []; discardRecordingRef.current = false;
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find(type => MediaRecorder.isTypeSupported(type));
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream); mediaRecorderRef.current = recorder;
      setRecordingSeconds(0); setRecording(true); setRecordingPaused(false); setAttachmentMenuOpen(false);
      recorder.ondataavailable = event => { if (event.data.size) recordingChunksRef.current.push(event.data); };
      recorder.onerror = () => { setError("Recording failed. Please try again."); setRecording(false); setRecordingPaused(false); stream.getTracks().forEach(track => track.stop()); };
      recorder.onstop = () => {
        setRecording(false); setRecordingPaused(false); stream.getTracks().forEach(track => track.stop()); recordingStreamRef.current = null;
        const chunks = recordingChunksRef.current; recordingChunksRef.current = [];
        if (discardRecordingRef.current) { discardRecordingRef.current = false; return; }
        if (!chunks.length) return;
        const type = recorder.mimeType || "audio/webm"; const blob = new Blob(chunks, { type });
        if (blob.size > 12 * 1024 * 1024) { setError("That voice note is too large. Record a shorter one."); return; }
        const ext = type.includes("ogg") ? "ogg" : type.includes("mp4") ? "m4a" : "webm";
        setVoiceDraft(new File([blob], `group-voice-${Date.now()}.${ext}`, { type })); setVoiceDraftUrl(URL.createObjectURL(blob));
      };
      recorder.start(250);
    } catch (err) { setError(err instanceof Error ? err.message : "Microphone access was denied."); setRecording(false); setRecordingPaused(false); }
  }
  function finishVoiceRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }
  function discardVoiceDraft() {
    if (recording || recordingPaused) { discardRecordingRef.current = true; const recorder = mediaRecorderRef.current; if (recorder && recorder.state !== "inactive") recorder.stop(); }
    if (voiceDraftUrl) URL.revokeObjectURL(voiceDraftUrl);
    setVoiceDraft(null); setVoiceDraftUrl(""); setRecordingSeconds(0); setRecording(false); setRecordingPaused(false);
  }
  async function sendGroupMessage() {
    if (!activeId || busy || voiceBusy) return;
    const savedToken = localStorage.getItem("hallschat_token");
    if (!savedToken) { window.location.href = "/signin"; return; }
    const groupId = activeId;
    const text = draft.trim();
    if (!text && !imageFiles.length && !voiceDraft) return;
    setBusy(true); setError("");
    const pendingId = "pending-" + Date.now();
    const replyTarget = replyingTo;
    const pending: GroupMessage = { id: pendingId, text, images: [...imagePreviews], audioUrl: voiceDraftUrl, imageUrl: imagePreviews[0], replyTo: replyTarget ? { id: replyTarget.id, senderId: replyTarget.sender?.id || "", text: replyTarget.text, imageUrl: replyTarget.images?.[0] || replyTarget.imageUrl, audioUrl: replyTarget.audioUrl, deleted: Boolean(replyTarget.deletedForEveryone) } : null, reactions: [], createdAt: new Date().toISOString(), pending: true, sender: { id: currentUserId, name: "You", username: "" } };
    setMessages(current => [...current, pending]); setDraft(""); setReplyingTo(null); setAttachmentMenuOpen(false);
    const files = [...imageFiles]; const previews = [...imagePreviews]; const voiceFile = voiceDraft;
    setImageFiles([]); setImagePreviews([]); setVoiceDraft(null); setVoiceDraftUrl(""); setRecordingSeconds(0);
    const backgroundTaskId = startBackgroundTask("Sending group message", files.length || voiceFile ? "Preparing group message attachments…" : "Sending message to group…");
    try {
      const images: string[] = [];
      for (const [index, file] of files.entries()) {
        updateBackgroundTask(backgroundTaskId, `Uploading group attachment ${index + 1} of ${files.length}…`);
        images.push(await uploadGroupMedia(file, savedToken));
      }
      const audioUrl = voiceFile ? (updateBackgroundTask(backgroundTaskId, "Uploading group voice note…"), await uploadGroupMedia(voiceFile, savedToken)) : "";
      updateBackgroundTask(backgroundTaskId, "Sending message to group…");
      const payload = await request(`/api/groups/${encodeURIComponent(groupId)}/messages`, { method: "POST", body: JSON.stringify({ text, images, audioUrl, ...(replyTarget ? { replyToId: replyTarget.id } : {}) }) });
      const sent = payload.message as GroupMessage;
      if (!sent?.id) throw new Error("The server didn't confirm your message.");
      setMessages(current => [...current.filter(message => message.id !== pendingId && message.id !== sent.id), sent].sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
      await loadGroups("mine", false);
      previews.forEach(url => URL.revokeObjectURL(url));
      setNotice("");
      finishBackgroundTask(backgroundTaskId);
    } catch (err) {
      setMessages(current => current.filter(message => message.id !== pendingId));
      setDraft(text); setImageFiles(files); setImagePreviews(previews);
      if (voiceFile) { setVoiceDraft(voiceFile); setVoiceDraftUrl(URL.createObjectURL(voiceFile)); }
      const messageError = err instanceof Error ? err.message : "Message wasn't sent.";
      setError(messageError);
      finishBackgroundTask(backgroundTaskId, messageError);
    } finally { setBusy(false); }
  }
  useEffect(() => {
    if (!recording) return;
    const interval = window.setInterval(() => setRecordingSeconds(seconds => seconds + 1), 1000);
    return () => window.clearInterval(interval);
  }, [recording]);

  useEffect(() => () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      discardRecordingRef.current = true;
      mediaRecorderRef.current.stop();
    }
    recordingStreamRef.current?.getTracks().forEach(track => track.stop());
    if (voiceDraftUrl) URL.revokeObjectURL(voiceDraftUrl);
  }, [voiceDraftUrl]);

  async function reactToMessage(message: GroupMessage, emoji: string) {
    const socket = socketRef.current;
    if (!socket?.connected || message.pending || message.deletedForEveryone) { setError("Reconnect to group chat before reacting."); return; }
    socket.timeout(10000).emit("group:react", { groupId: activeId, messageId: message.id, emoji }, (timeoutError: Error | null, response: { ok?: boolean; message?: string; reactions?: GroupReaction[] }) => {
      if (timeoutError || !response?.ok) { setError(response?.message || "That reaction couldn't be saved."); return; }
      if (Array.isArray(response.reactions)) setMessages(current => current.map(item => item.id === message.id ? { ...item, reactions: response.reactions } : item));
    });
    setReactionPickerFor(null);
  }
  async function saveMessageEdit(message: GroupMessage) {
    const text = editMessageDraft.trim(); if (!text || !activeId) { setError("A message cannot be empty."); return; }
    try {
      const payload = await request(`/api/groups/${encodeURIComponent(activeId)}/messages/${encodeURIComponent(message.id)}`, { method: "PATCH", body: JSON.stringify({ text }) });
      const edited = payload.message;
      setMessages(current => current.map(item => item.id === message.id ? { ...item, text: edited.text, editedAt: edited.editedAt } : item));
      setEditingMessageId(null); setEditMessageDraft(""); setActionMenuFor(null);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to edit this message."); }
  }
  async function deleteGroupMessage(message: GroupMessage, scope: "me" | "everyone") {
    if (!activeId) return;
    try {
      await request(`/api/groups/${encodeURIComponent(activeId)}/messages/${encodeURIComponent(message.id)}?scope=${scope}`, { method: "DELETE" });
      if (scope === "everyone") setMessages(current => current.map(item => item.id === message.id ? { ...item, text: "", imageUrl: "", images: [], audioUrl: "", deletedForEveryone: true } : item));
      else setMessages(current => current.filter(item => item.id !== message.id));
      setActionMenuFor(null);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to delete this message."); }
  }

  async function sendMessage(event: React.FormEvent) { event.preventDefault(); if (typingTimerRef.current !== null) window.clearTimeout(typingTimerRef.current); socketRef.current?.emit("group:typing", { groupId: activeId, isTyping: false }); await sendGroupMessage(); }

  async function leaveGroup() {
    if (!activeId) return;
    setBusy(true);
    try { await request("/api/groups/" + encodeURIComponent(activeId) + "/leave", { method: "POST" }); setActiveId(""); setDetail(null); await loadGroups("mine"); setNotice("You left the group."); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to leave this group."); }
    finally { setBusy(false); }
  }

  async function deleteGroup() {
    if (!activeId) return;
    setBusy(true);
    try { await request("/api/groups/" + encodeURIComponent(activeId), { method: "DELETE" }); setActiveId(""); setDetail(null); await loadGroups("mine"); setNotice("Group deleted."); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to delete this group."); }
    finally { setBusy(false); }
  }

  async function removeMember(member: Member) {
    if (!activeId) return;
    try { await request("/api/groups/" + encodeURIComponent(activeId) + "/members/" + encodeURIComponent(member.id), { method: "DELETE" }); await loadDetail(activeId, false); setNotice("Member removed."); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to remove member."); }
  }

  async function changeRole(member: Member, role: "admin" | "member") {
    if (!activeId) return;
    try { await request("/api/groups/" + encodeURIComponent(activeId) + "/members/" + encodeURIComponent(member.id) + "/role", { method: "PATCH", body: JSON.stringify({ role }) }); await loadDetail(activeId, false); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to update role."); }
  }

  const isAdmin = detail?.role === "owner" || detail?.role === "admin";

  return <main className={`home-page social-home ${activeId && detail ? "chat-page chat-page-conversation-open" : ""}`}>
    <AppHeader homeHref="/home" />
    <section className={`home-shell social-shell ${activeId && detail ? "chat-shell" : ""}`} style={activeId && detail ? undefined : { paddingBottom: 112 }}>
      <div className={activeId && detail ? "chat-layout chat-layout-conversation-open" : ""} style={{ width: "100%", maxWidth: activeId && detail ? "none" : 820, margin: "0 auto", boxSizing: "border-box", height: activeId && detail ? "100%" : undefined, minHeight: activeId && detail ? 0 : undefined }}>
        {activeId && detail ? <section className="chat-conversation" aria-label="Group conversation" style={{ position: "relative" }}>
          <header className="chat-conversation-header">
            <button className="chat-back-button" type="button" onClick={() => { setActiveId(""); setMemberPanel(false); }} aria-label="Back to groups"><ArrowLeft size={19}/></button>
            <span className="chat-avatar chat-avatar-large">{detail.avatar ? <img src={detail.avatar} alt=""/> : initials(detail.name)}</span>
            <div className="chat-conversation-person" style={{ flex: 1 }}>
              <strong>{detail.name}</strong>
              <span>{detail.memberCount} members · {detail.visibility === "private" ? "Private group" : "Public group"}</span>
            </div>
            <GroupCallPanel socket={groupSocket} groupId={activeId} groupName={detail.name} currentUserId={currentUserId}/>
            <button type="button" className="chat-back-button" onClick={() => setMemberPanel(value => !value)} aria-label="Group details" aria-expanded={memberPanel} title="Group details"><UsersRound size={18}/></button>
          </header>
          {memberPanel && <div role="region" aria-label="Group details and members" style={{ position: "absolute", zIndex: 20, top: 64, right: 10, left: 10, maxHeight: "68%", overflowY: "auto", overscrollBehavior: "contain", padding: 14, border: "1px solid rgba(255,210,219,.16)", borderRadius: 15, background: "rgba(28,9,15,.98)", boxShadow: "0 16px 42px rgba(0,0,0,.45)", backdropFilter: "blur(16px)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}><strong>Group details</strong><button type="button" style={{ ...secondary, minHeight: 30, padding: "5px 10px" }} onClick={() => setMemberPanel(false)}>Done</button></div>
             <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}><span className="chat-avatar chat-avatar-large" style={{ width: 62, height: 62, flexBasis: 62, flexShrink: 0, borderRadius: 18, overflow: "hidden" }}>{detail.avatar ? <img src={detail.avatar} alt={detail.name + " group profile picture"} style={{ width: "100%", height: "100%", objectFit: "cover" }}/> : initials(detail.name)}</span><div style={{ minWidth: 0, flex: 1 }}><strong style={{ display: "block", overflowWrap: "anywhere" }}>{detail.name}</strong><span style={{ ...muted, display: "block", fontSize: ".72rem", marginTop: 4 }}>{detail.memberCount} members · {detail.visibility === "private" ? "Private group" : "Public group"}</span></div></div>
            {detail.description && <p style={{ ...muted, margin: "0 0 12px", fontSize: ".8rem", lineHeight: 1.5 }}>{detail.description}</p>}
            {detail.inviteCode && <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: 10, border: "1px solid rgba(255,210,219,.1)", borderRadius: 10 }}><LockKeyhole size={15} color="#ff9cab"/><div style={{ flex: 1, minWidth: 0 }}><div style={{ ...muted, fontSize: ".7rem" }}>Group ID</div><strong style={{ overflowWrap: "anywhere", fontSize: ".8rem", letterSpacing: ".12em", fontVariantNumeric: "tabular-nums" }}>{detail.inviteCode}</strong></div><button type="button" style={{ ...secondary, padding: "7px 9px" }} onClick={() => { void navigator.clipboard?.writeText(detail.inviteCode || ""); setNotice("Group ID copied."); }}>Copy</button></div>}
            <strong style={{ display: "block", fontSize: ".8rem", marginBottom: 10 }}>Members · {detail.members.length}</strong>
            <div style={{ display: "grid", gap: 10 }}>{detail.members.map(member => <div key={member.id} style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span className="chat-avatar" style={{ width: 36, height: 36, flexBasis: 36 }}>{member.profilePicture ? <img src={member.profilePicture} alt=""/> : initials(member.name)}</span>
              <div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: ".8rem", fontWeight: 750 }}>{member.name}</div><div style={{ ...muted, fontSize: ".7rem" }}>@{member.username} · {member.role}</div></div>
              {detail.role === "owner" && member.role !== "owner" && <button type="button" style={{ ...secondary, padding: "7px 9px" }} onClick={() => void changeRole(member, member.role === "admin" ? "member" : "admin")}>{member.role === "admin" ? "Make member" : "Make admin"}</button>}
              {isAdmin && member.role !== "owner" && member.id !== detail.ownerId && !(detail.role === "admin" && member.role === "admin") && <button type="button" aria-label={"Remove " + member.name} style={{ ...secondary, padding: 8 }} onClick={() => askConfirm("Remove @" + member.username + " from this group?", () => removeMember(member))}><Trash2 size={15}/></button>}
            </div>)}</div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button type="button" style={{ ...secondary, flex: 1 }} onClick={() => { void loadDetail(activeId); setMemberPanel(false); }}><RefreshCw size={15}/> Refresh</button>
              {detail.role === "owner" ? <button type="button" style={{ ...secondary, flex: 1, color: "#ffabb7" }} disabled={busy} onClick={() => { setMemberPanel(false); askConfirm("Delete this group and all its messages? This cannot be undone.", deleteGroup); }}><Trash2 size={15}/> Delete</button> : <button type="button" style={{ ...secondary, flex: 1, color: "#ffabb7" }} disabled={busy} onClick={() => { setMemberPanel(false); askConfirm("Leave this group? You will need to join again to read new messages.", leaveGroup); }}><LogOut size={15}/> Leave</button>}
            </div>
          </div>}
          <input ref={imageInputRef} type="file" accept="image/*" multiple hidden onChange={handleImageSelection}/>
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" hidden onChange={handleImageSelection}/>
          <div ref={groupMessageListRef} className="chat-message-list" style={{ flex: "1 1 0", minHeight: 0, height: "auto", maxHeight: "none" }} onClick={() => { setReactionPickerFor(null); setActionMenuFor(null); }}>
            {detailLoading && !messages.length ? <div className="chat-message-loading"><LoadingDots/></div> : messages.length ? messages.map(message => {
              const mine = Boolean(currentUserId) && (message.sender?.id === currentUserId || (message as GroupMessage & { senderId?: string }).senderId === currentUserId);
              const imgs = message.images?.length ? message.images : message.imageUrl ? [message.imageUrl] : [];
              const quoted = message.replyTo;
              const canEdit = mine && !message.pending && !message.deletedForEveryone && Boolean(message.text.trim()) && !imgs.length && !message.audioUrl && Date.now() - new Date(message.createdAt).getTime() <= 24 * 60 * 60 * 1000;
              const reactionGroups = Array.from((message.reactions || []).reduce((groups, reaction) => groups.set(reaction.emoji, [...(groups.get(reaction.emoji) || []), reaction]), new Map<string, GroupReaction[]>()).entries());
              if (message.callLog) {
                 const call = message.callLog;
                 const outgoing = call.callerId === currentUserId;
                 const missed = call.status === "missed";
                 const failed = call.status === "failed";
                 const statusText = missed || (call.status === "cancelled" && !outgoing) ? "Missed call" : failed ? "Call failed" : call.status === "declined" ? "Call declined" : call.status === "cancelled" ? "Call cancelled" : call.status === "ringing" ? "Calling…" : "Call ended";
                 const duration = call.durationSeconds > 0 ? ` · ${Math.floor(call.durationSeconds / 60)}:${String(call.durationSeconds % 60).padStart(2, "0")}` : "";
                 return <div key={message.id} id={"chat-message-" + message.id} className={"chat-message-line " + (outgoing ? "chat-message-line-mine" : "")}>
                   <div className={"chat-message-content " + (outgoing ? "chat-message-content-mine" : "chat-message-content-theirs") + " chat-call-bubble" + (missed || failed ? " chat-call-bubble-alert" : "")}>
                     <div className="chat-call-body"><span className="chat-call-icon">{call.kind === "video" ? <Video size={19}/> : <Phone size={19}/>}</span><div className="chat-call-copy"><strong>{call.kind === "video" ? "Group video call" : "Group audio call"}</strong><span className={missed || failed ? "chat-call-status-alert" : ""}>{statusText}{duration}</span></div></div>
                     <div className="chat-message-footer"><time>{new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time></div>
                   </div>
                 </div>;
               }
               return <div key={message.id} className={"chat-message-line" + (mine ? " chat-message-line-mine" : "")} id={"chat-message-" + message.id}
                onContextMenu={event => { event.preventDefault(); setActionMenuFor(message.id); }}
                onPointerDown={event => {
                  if (event.pointerType === "mouse" && event.button !== 0) return;
                  const gesture = { id: message.id, startX: event.clientX, startY: event.clientY, longPressed: false, timer: null as number | null };
                  gesture.timer = window.setTimeout(() => { gesture.longPressed = true; setActionMenuFor(message.id); setReactionPickerFor(null); }, 520);
                  messageGestureRef.current = gesture;
                }}
                onPointerMove={event => {
                  const gesture = messageGestureRef.current; if (!gesture || gesture.id !== message.id) return;
                  if (Math.abs(event.clientX - gesture.startX) > 12 || Math.abs(event.clientY - gesture.startY) > 12) {
                    if (gesture.timer !== null) window.clearTimeout(gesture.timer);
                    gesture.timer = null;
                  }
                }}
                onPointerUp={event => {
                  const gesture = messageGestureRef.current; if (!gesture || gesture.id !== message.id) return;
                  if (gesture.timer !== null) window.clearTimeout(gesture.timer);
                  const dx = event.clientX - gesture.startX; const dy = event.clientY - gesture.startY;
                  if (!gesture.longPressed && Math.abs(dx) > 64 && Math.abs(dy) < 48 && !message.pending && !message.deletedForEveryone) {
                    setReplyingTo(message); setActionMenuFor(null); draftInputRef.current?.focus();
                  }
                  messageGestureRef.current = null;
                }}
                onPointerCancel={() => { const gesture = messageGestureRef.current; if (gesture?.timer !== null && gesture?.timer !== undefined) window.clearTimeout(gesture.timer); messageGestureRef.current = null; }}>
                <div className={"chat-message-content " + (mine ? "chat-message-content-mine" : "chat-message-content-theirs")} style={{ maxWidth: "88%", position: "relative" }}>
                  <div className="chat-message-body">
                    {!mine && <span style={{ display: "block", color: "#ff9cab", fontSize: ".69rem", fontWeight: 800, marginBottom: 3 }}>{message.sender?.name || "Group member"} <span style={{ color: "rgba(246,220,225,.52)", fontWeight: 500 }}>@{message.sender?.username || "member"}</span></span>}
                    {message.deletedForEveryone ? <p className="chat-message-text" style={{ opacity: .65, fontStyle: "italic" }}>This message was deleted</p> : <>
                      {quoted && <button type="button" onClick={() => { const node = document.getElementById("chat-message-" + quoted.id); const list = groupMessageListRef.current; if (node && list) { list.scrollTo({ top: Math.max(0, list.scrollTop + node.getBoundingClientRect().top - list.getBoundingClientRect().top - 80), behavior: "smooth" }); node.style.outline = "2px solid #f07889"; window.setTimeout(() => { node.style.outline = ""; }, 1300); } }} style={{ display: "grid", width: "100%", gap: 3, textAlign: "left", padding: "7px 9px", marginBottom: 6, border: 0, borderLeft: "3px solid #f07889", borderRadius: "5px 8px 8px 5px", background: "rgba(240,120,137,.09)", color: "inherit" }}><strong style={{ fontSize: ".68rem", color: "#ff9cab" }}>{quoted.senderId === currentUserId ? "You" : (detail.members.find(member => member.id === quoted.senderId)?.name || "Group member")}</strong><span style={{ fontSize: ".75rem", opacity: .78, overflowWrap: "anywhere" }}>{quoted.deleted ? "This message was deleted" : quoted.text || (quoted.audioUrl ? "🎤 Voice note" : quoted.imageUrl ? "📷 Photo" : "Message")}</span></button>}
                      {editingMessageId === message.id ? <form onSubmit={event => { event.preventDefault(); void saveMessageEdit(message); }} style={{ display: "grid", gap: 7 }}><textarea value={editMessageDraft} onChange={event => setEditMessageDraft(event.target.value)} maxLength={4000} autoFocus rows={3} style={{ ...field, resize: "vertical" }}/><div style={{ display: "flex", gap: 7 }}><button type="button" style={{ ...secondary, flex: 1 }} onClick={() => { setEditingMessageId(null); setEditMessageDraft(""); }}>Cancel</button><button type="submit" style={{ ...primary, flex: 1 }} disabled={!editMessageDraft.trim()}>Save</button></div></form> : message.text && <p className="chat-message-text">{message.text}</p>}
                      {imgs.length > 0 && <div className={`chat-image-grid ${imgs.length === 1 ? "chat-image-grid-single" : ""}`}>{imgs.map((url, index) => <button key={`${url}-${index}`} type="button" className="chat-image-bubble" onClick={() => setViewingImageUrl(url)} aria-label={`View image ${index + 1}`}><img src={url} alt={message.text || `Shared image ${index + 1}`} loading="lazy" /></button>)}</div>}
                      {message.audioUrl && <GroupVoiceNotePlayer src={message.audioUrl} pending={Boolean(message.pending)}/>}
                    </>}
                  </div>
                  <div className="chat-message-footer"><time>{message.editedAt && !message.deletedForEveryone ? "Edited · " : ""}{new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}{message.pending ? " · Sending…" : ""}</time>
                    {!message.pending && !message.deletedForEveryone && <div className="chat-message-more" style={{ position: "relative" }}><button type="button" aria-label="Message actions" title="Message actions" onClick={event => { event.stopPropagation(); setActionMenuFor(current => current === message.id ? null : message.id); setReactionPickerFor(null); }} style={{ display: "grid", placeItems: "center", width: 25, height: 24, border: 0, background: "transparent", color: "inherit" }}><MoreVertical size={15}/></button>
                      {actionMenuFor === message.id && <div className="chat-message-actions" role="menu" onClick={event => event.stopPropagation()}>
                        <button type="button" role="menuitem" onClick={() => { setReplyingTo(message); setActionMenuFor(null); draftInputRef.current?.focus(); }}><Reply size={14}/> Reply</button>
                        <button type="button" role="menuitem" onClick={() => { setReactionPickerFor(message.id); setActionMenuFor(null); }}><Smile size={14}/> React</button>
                        {canEdit && <button type="button" role="menuitem" onClick={() => { setEditingMessageId(message.id); setEditMessageDraft(message.text); setActionMenuFor(null); }}><Pencil size={14}/> Edit</button>}
                        <button type="button" role="menuitem" onClick={() => void deleteGroupMessage(message, "me")}><Trash2 size={14}/> Delete for me</button>
                        {mine && <button type="button" role="menuitem" onClick={() => askConfirm("Delete this message for everyone in the group?", async () => deleteGroupMessage(message, "everyone"))}><Trash2 size={14}/> Delete for everyone</button>}
                      </div>}
                    </div>}
                  </div>
                  {reactionPickerFor === message.id && <div className="chat-reaction-picker" role="group" aria-label="React to message" onClick={event => event.stopPropagation()} style={{ display: "flex", gap: 7, padding: 7, border: "1px solid rgba(255,210,219,.15)", borderRadius: 20, background: "rgba(28,9,15,.98)" }}>{["❤️","😂","😮","😢","🙏","👍"].map(emoji => <button key={emoji} type="button" onClick={() => void reactToMessage(message, emoji)} aria-label={"React " + emoji} style={{ border: 0, background: "transparent", fontSize: 19, padding: 2 }}>{emoji}</button>)}</div>}
                  {reactionGroups.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 5 }}>{reactionGroups.map(([emoji,items]) => <button key={emoji} type="button" onClick={() => void reactToMessage(message, emoji)} style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "1px solid rgba(255,210,219,.17)", borderRadius: 15, padding: "3px 7px", background: items.some(item => item.userId === currentUserId) ? "rgba(240,120,137,.17)" : "rgba(255,255,255,.04)", color: "inherit", fontSize: 11 }}>{emoji} {items.length}</button>)}</div>}
                </div>
              </div>;
            }) : <div className="chat-empty-conversation"><span><MessageCircle size={25}/></span><strong>Say hello</strong><p>Messages sent to this group will appear here.</p></div>}
            {otherTyping && <div style={{ padding: "4px 10px", color: "#ff9cab", fontSize: ".75rem" }}>Someone is typing…</div>}
          </div>
          {(imagePreviews.length > 0 || compressingImages) && <div className="chat-image-pending-grid">{imagePreviews.map((url, index) => <div className="chat-image-pending" key={`${url}-${index}`}><img src={url} alt={`Image ${index + 1} ready to send`} /><button type="button" onClick={() => removeSelectedImage(index)} aria-label={`Remove image ${index + 1}`}><X size={17} /></button></div>)}<span className="chat-image-count">{compressingImages ? "Compressing images…" : `${imageFiles.length} ${imageFiles.length === 1 ? "image" : "images"} ready`}</span></div>}
          {replyingTo && <div className="chat-reply-composer"><div className="chat-reply-composer-copy"><strong>Replying to {replyingTo.sender?.id === currentUserId ? "yourself" : replyingTo.sender?.name || "group member"}</strong><span>{replyingTo.deletedForEveryone ? "This message was deleted" : replyingTo.text || (replyingTo.audioUrl ? "🎤 Voice note" : (replyingTo.images?.length || replyingTo.imageUrl) ? "📷 Photo" : "Message")}</span></div><button type="button" aria-label="Cancel reply" onClick={() => setReplyingTo(null)}><X size={17}/></button></div>}
          <form className="chat-composer" onSubmit={sendMessage}>
            <div className="chat-attachment-wrap" style={{ position: "relative" }}><button type="button" aria-label="Add attachment" title="Add attachment" onClick={() => setAttachmentMenuOpen(value => !value)} style={{ display: "grid", placeItems: "center", width: 36, height: 36, border: 0, borderRadius: 9, background: "rgba(255,255,255,.05)", color: "#ff9cab" }}><Paperclip size={18}/></button>
              {attachmentMenuOpen && <div className="chat-attachment-menu" style={{ position: "absolute", zIndex: 35, bottom: 44, left: 0, display: "grid", gap: 5, minWidth: 160, padding: 7, border: "1px solid rgba(255,210,219,.15)", borderRadius: 11, background: "rgba(28,9,15,.98)", boxShadow: "0 12px 30px #0008" }}><button type="button" style={{ ...secondary, justifyContent: "flex-start" }} onClick={() => imageInputRef.current?.click()}><ImageIcon size={15}/> Gallery</button><button type="button" style={{ ...secondary, justifyContent: "flex-start" }} onClick={() => cameraInputRef.current?.click()}><Camera size={15}/> Camera</button><button type="button" style={{ ...secondary, justifyContent: "flex-start" }} onClick={() => void recordVoiceNote()}><Mic size={15}/> Voice note</button></div>}
            </div>
            {(recording || recordingPaused) ? <div className={"chat-recording-status" + (recordingPaused ? " is-paused" : "")}><span className={"chat-recording-dot" + (recordingPaused ? " is-paused" : "")} />{recordingPaused ? "Recording paused" : "Recording voice note"} · {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, "0")}</div> : voiceDraft && voiceDraftUrl ? <div className="chat-voice-draft-preview"><GroupVoiceNotePlayer src={voiceDraftUrl} /></div> : <textarea ref={draftInputRef} aria-label="Write a group message" value={draft} onChange={event => { setDraft(event.target.value); socketRef.current?.emit("group:typing", { groupId: activeId, isTyping: true }); if (typingTimerRef.current !== null) window.clearTimeout(typingTimerRef.current); typingTimerRef.current = window.setTimeout(() => socketRef.current?.emit("group:typing", { groupId: activeId, isTyping: false }), 1200); }} placeholder="Message the group…" maxLength={4000} rows={1} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}/>}
            {!recording && !recordingPaused && !voiceDraft && <span className="chat-character-count">{draft.length > 3500 ? `${draft.length}/4000` : ""}</span>}{(recording || recordingPaused) ? <><button type="button" className="chat-recording-control" onClick={() => void recordVoiceNote()} aria-label={recordingPaused ? "Resume recording" : "Pause recording"} title={recordingPaused ? "Resume recording" : "Pause recording"}>{recordingPaused ? <Play size={17} fill="currentColor" /> : <Pause size={17} fill="currentColor" />}</button><button type="button" className="chat-stop-recording" onClick={finishVoiceRecording} aria-label="Finish recording and review" title="Finish recording and review"><Square size={17} fill="currentColor" /></button><button type="button" className="chat-discard-recording" onClick={discardVoiceDraft} aria-label="Delete recording" title="Delete recording"><Trash2 size={17} /></button></> : voiceDraft ? <><button type="button" className="chat-discard-recording" onClick={discardVoiceDraft} disabled={busy || voiceBusy} aria-label="Delete voice note" title="Delete voice note"><Trash2 size={17} /></button><button type="submit" className="chat-stop-recording" disabled={busy || voiceBusy} aria-label="Send voice note" title="Send voice note">{busy || voiceBusy ? <LoadingDots /> : <Send size={18} />}</button></> : <button type="submit" disabled={busy || voiceBusy || compressingImages || (!draft.trim() && !imageFiles.length)} aria-label="Send group message" title="Send"><Send size={18}/></button>}
          </form>
        </section> : <>
          <div style={{ ...panel, padding: 5, display: "flex", gap: 8, marginBottom: 15 }}>
            {([{ id: "mine", label: "My groups", icon: UsersRound }, { id: "discover", label: "Discover", icon: Compass }] as const).map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setTab(id)} aria-pressed={tab === id} style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "center", alignItems: "center", gap: 7, padding: "8px 10px", borderRadius: 9, border: tab === id ? "1px solid rgba(229,70,92,.7)" : "1px solid rgba(255,210,219,.11)", background: "rgba(255,255,255,.035)", color: tab === id ? "#ff9cab" : "rgba(246,220,225,.66)", fontSize: ".8rem", fontWeight: 750 }}><Icon size={16}/><span>{label}</span></button>)}
          </div>
          <input aria-label="Search groups" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search groups…" style={{ ...field, marginBottom: 12 }}/>
          <div style={{ display: "flex", gap: 9, marginBottom: 13 }}>
            <button type="button" onClick={() => setShowJoin(true)} style={{ ...secondary, flex: 1, minWidth: 0 }}><UserPlus size={16}/> Join group</button>
            <button type="button" onClick={() => setShowCreate(true)} style={{ ...secondary, flex: 1, minWidth: 0 }}><Plus size={17}/> Create group</button>
          </div>
          {loading ? <div style={{ ...panel, display: "grid", placeItems: "center", padding: 34 }}><LoadingDots/></div> : filteredGroups.length ? <div style={{ display: "grid", gap: 10 }}>{filteredGroups.map(group => <div key={group.id} style={{ ...panel, padding: 13, display: "flex", alignItems: "center", gap: 11 }}>
            <Avatar name={group.name} src={group.avatar} size={49}/><div style={{ flex: 1, minWidth: 0, textAlign: "left" }}><span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".9rem", fontWeight: 850, color: "#fff0f3" }}>{group.name}{group.visibility === "private" ? <LockKeyhole size={13} color="#ff9cab"/> : null}</span><span style={{ display: "block", ...muted, fontSize: ".75rem", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{group.lastMessage ? (group.lastMessage.senderName ? group.lastMessage.senderName + ": " : "") + group.lastMessage.text : group.description || "No messages yet"}</span><span style={{ display: "block", ...muted, fontSize: ".7rem", marginTop: 5 }}>{group.memberCount} members · {group.role || "Public"}{group.lastMessage ? " · " + formatTime(group.lastMessage.createdAt) : ""}</span></div>{tab === "discover" ? <button type="button" style={primary} disabled={busy} onClick={() => void joinGroup(group.id)}>Join</button> : <button type="button" aria-label={"Open " + group.name} title={"Open " + group.name} style={{ ...secondary, width: 38, minWidth: 38, padding: 0 }} onClick={() => setActiveId(group.id)}><ArrowLeft size={17} style={{ transform: "rotate(180deg)" }}/></button>}
          </div>)}</div> : <div style={{ ...panel, textAlign: "center", padding: "32px 18px" }}><div style={{ width: 49, height: 49, margin: "0 auto 12px", borderRadius: 16, display: "grid", placeItems: "center", background: "rgba(184,32,50,.14)", color: "#ff9cab" }}><UsersRound size={23}/></div><strong style={{ display: "block", fontSize: ".92rem" }}>{tab === "mine" ? "Your group story starts here" : "No groups found"}</strong><p style={{ ...muted, margin: "7px auto 14px", maxWidth: 320, fontSize: ".8rem", lineHeight: 1.6 }}>{tab === "mine" ? "Create a group for friends, family, classmates, or your community." : "Try another search, or create a public group for people to discover."}</p>{tab === "mine" && <button type="button" style={primary} onClick={() => setShowCreate(true)}><Plus size={16}/> Create your first group</button>}</div>}
        </>}
      </div>
    </section>
    {showCreate && <div role="dialog" aria-modal="true" aria-label="Create a group" style={{ position: "fixed", inset: 0, zIndex: 4000, display: "flex", flexDirection: "column", width: "100%", height: "100dvh", minHeight: 0, padding: 0, background: "#16080d", color: "#fff0f3", overflow: "hidden", border: 0, boxShadow: "none" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "calc(env(safe-area-inset-top, 0px) + 12px) 16px 8px", background: "transparent", border: 0, flexShrink: 0 }}>
        <button type="button" aria-label="Close create group" onClick={() => { setShowCreate(false); setError(""); }} style={{ ...secondary, width: 42, minWidth: 42, height: 42, padding: 0, border: 0, background: "transparent" }}><X size={23}/></button>
      </header>
      <div style={{ flex: 1, minHeight: 0, overflowY: "hidden", overscrollBehavior: "contain", padding: "8px 16px calc(12px + env(safe-area-inset-bottom, 0px))" }}>
        <form onSubmit={createGroup} style={{ display: "grid", gap: 13, maxWidth: 560, margin: "0 auto" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "8px 0 4px", textAlign: "center" }}>
            <button type="button" onClick={() => groupAvatarInputRef.current?.click()} aria-label="Upload group profile picture" style={{ position: "relative", width: 104, height: 104, minWidth: 104, borderRadius: 22, overflow: "hidden", border: "1px dashed rgba(255,156,171,.65)", background: "linear-gradient(145deg,rgba(197,45,68,.2),rgba(53,18,29,.8))", color: "#ff9cab", display: "grid", placeItems: "center", padding: 0 }}>
              {groupAvatarPreview ? <img src={groupAvatarPreview} alt="Group profile preview" style={{ width: "100%", height: "100%", objectFit: "cover" }}/> : <div style={{ display: "grid", justifyItems: "center", gap: 7 }}><Camera size={28}/><span style={{ fontSize: ".9rem", fontWeight: 750 }}>Add photo</span></div>}
              <span style={{ position: "absolute", right: 5, bottom: 5, width: 26, height: 26, display: "grid", placeItems: "center", borderRadius: 10, background: "#c52d44", color: "white", border: "2px solid #16080d" }}><Plus size={15}/></span>
            </button>
            <span style={{ ...muted, fontSize: ".86rem" }}>Group picture · optional</span>
            <input ref={groupAvatarInputRef} type="file" accept="image/*" hidden onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; setError(""); if (!file.type.startsWith("image/")) { setError("Choose an image file for the group picture."); return; } if (file.size > 10 * 1024 * 1024) { setError("Group picture must be 10 MB or smaller."); return; } if (groupAvatarCropSource) URL.revokeObjectURL(groupAvatarCropSource); setGroupAvatarCropSource(URL.createObjectURL(file)); }}/>
            {groupAvatarPreview && <button type="button" onClick={() => { URL.revokeObjectURL(groupAvatarPreview); setGroupAvatarFile(null); setGroupAvatarPreview(""); if (groupAvatarInputRef.current) groupAvatarInputRef.current.value = ""; }} style={{ ...secondary, minHeight: 32, padding: "6px 10px" }}>Remove photo</button>}
          </div>
          <label style={{ display: "grid", gap: 6, fontSize: ".9rem", fontWeight: 750 }}>Group name <span style={{ ...muted, fontWeight: 500 }}>Required</span><input required minLength={2} maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Weekend Football Crew" style={field}/></label>
          <label style={{ display: "grid", gap: 6, fontSize: ".9rem", fontWeight: 750 }}>Description <span style={{ ...muted, fontWeight: 500 }}>Optional</span><textarea maxLength={500} value={description} onChange={event => setDescription(event.target.value)} placeholder="Tell people what your group is about…" rows={2} style={{ ...field, resize: "none", minHeight: 76, padding: "11px 13px" }}/></label>
          <label style={{ display: "grid", gap: 6, fontSize: ".9rem", fontWeight: 750 }}>Group ID <span style={{ ...muted, fontWeight: 500 }}>Choose your own unique 8-digit code</span><span style={{ position: "relative", display: "flex", alignItems: "center", width: "100%", minWidth: 0 }}><input required type="text" inputMode="numeric" autoComplete="off" pattern="[0-9]{8}" minLength={8} maxLength={8} value={groupCode} aria-describedby="group-id-availability" aria-invalid={groupCodeStatus === "taken" || groupCodeStatus === "invalid"} onChange={event => { setGroupCode(event.target.value.replace(/\D/g, "").slice(0, 8)); setError(""); }} placeholder="e.g. 48271630" style={{ ...field, paddingRight: 42, letterSpacing: ".18em", fontVariantNumeric: "tabular-nums" }}/>{groupCodeStatus === "checking" ? <span aria-label="Checking Group ID" style={{ position: "absolute", right: 8, display: "inline-flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", color: "#f07889", lineHeight: 0 }}><LoadingDots /></span> : groupCodeStatus === "available" ? <Check size={16} aria-label="Group ID available" style={{ position: "absolute", right: 12, color: "#83ddb0", pointerEvents: "none" }} /> : null}</span><span id="group-id-availability" aria-live="polite" style={{ minHeight: 13, lineHeight: 1.45, fontSize: ".72rem", fontWeight: 500, color: groupCodeStatus === "available" ? "#83ddb0" : groupCodeStatus === "checking" || groupCodeStatus === "idle" ? "rgba(246,220,225,.62)" : "#ff929f" }}>{groupCodeMessage || "Unique 8-digit code used to find or join your group."}</span></label>
          <section style={{ display: "grid", gap: 9 }}>
            <strong style={{ fontSize: ".82rem" }}>Group privacy</strong>
            <span style={{ ...muted, fontSize: ".76rem", lineHeight: 1.35 }}>Choose who can discover and join your group.</span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 7 }}>
              { id: "private", label: "Private", detail: "Group ID required", icon: LockKeyhole }
            </div>
          </section>
          <button type="submit" disabled={busy || name.trim().length < 2 || !/^\d{8}$/.test(groupCode) || groupCodeStatus !== "available"} style={{ ...primary, width: "100%", minHeight: 50, position: "static", boxShadow: "none", opacity: busy || name.trim().length < 2 || !/^\d{8}$/.test(groupCode) || groupCodeStatus !== "available" ? .6 : 1 }}>{busy ? <LoadingDots/> : <><Plus size={17}/> Create group</>}</button>
        </form>
      </div>
    </div>}
    {showJoin && <div role="dialog" aria-modal="true" aria-label="Join a group using Group ID" onClick={event => { if (event.target === event.currentTarget) setShowJoin(false); }} style={{ position: "fixed", inset: 0, zIndex: 4000, display: "grid", placeItems: "center", padding: 18, background: "rgba(7,3,6,.78)", backdropFilter: "blur(8px)" }}>
      <div style={{ ...panel, width: "100%", maxWidth: 430, padding: 18, boxShadow: "0 20px 70px rgba(0,0,0,.5)" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 15 }}><strong style={{ fontSize: "1rem" }}>Join a group</strong></div>
        <form onSubmit={event => { event.preventDefault(); void joinGroup(undefined, inviteCode); }} style={{ display: "grid", gap: 12 }}><p style={{ ...muted, margin: 0, fontSize: ".82rem", lineHeight: 1.55 }}>Enter the 8-digit Group ID shared by the group owner or an admin.</p><input required value={inviteCode} onChange={event => setInviteCode(event.target.value.replace(/\D/g, "").slice(0, 8))} inputMode="numeric" maxLength={8} placeholder="Enter 8-digit Group ID" style={field}/><button type="submit" disabled={busy || inviteCode.length !== 8} style={{ ...primary, width: "100%" }}>{busy ? <LoadingDots/> : <><UserPlus size={16}/> Join group</>}</button></form>
      </div>
    </div>}
    {confirmAction && <div role="dialog" aria-modal="true" aria-label="Confirm group action" onClick={event => { if (event.target === event.currentTarget) { setConfirmAction(null); setConfirmMessage(""); } }} style={{ position: "fixed", inset: 0, zIndex: 4500, display: "grid", placeItems: "center", padding: 18, background: "rgba(7,3,6,.78)", backdropFilter: "blur(8px)" }}><div style={{ ...panel, width: "100%", maxWidth: 380, padding: 18, boxShadow: "0 20px 70px rgba(0,0,0,.5)" }}><div style={{ width: 42, height: 42, borderRadius: 13, display: "grid", placeItems: "center", background: "rgba(184,32,50,.16)", color: "#ff9cab", marginBottom: 12 }}><AlertTriangle size={20}/></div><strong style={{ display: "block", fontSize: ".98rem" }}>Are you sure?</strong><p style={{ ...muted, fontSize: ".82rem", lineHeight: 1.55, margin: "7px 0 17px" }}>{confirmMessage}</p><div style={{ display: "flex", gap: 9 }}><button type="button" style={{ ...secondary, flex: 1 }} onClick={() => { setConfirmAction(null); setConfirmMessage(""); }}>Cancel</button><button type="button" style={{ ...primary, flex: 1 }} disabled={busy} onClick={() => { const action = confirmAction; setConfirmAction(null); setConfirmMessage(""); if (action) void action(); }}>Confirm</button></div></div></div>}
    {(error || notice) && <div className={"halls-toast " + (error ? "halls-toast-error" : "halls-toast-success")} role={error ? "alert" : "status"}><span>{error || notice}</span><button type="button" aria-label="Dismiss notification" onClick={() => { setError(""); setNotice(""); }}>×</button></div>}
    {groupAvatarCropSource && <StoryImageCropModal imageUrl={groupAvatarCropSource} onCancel={cancelGroupAvatarCrop} onDone={confirmGroupAvatarCrop} title="Edit group picture" aspectRatio={1} />}
    {viewingImageUrl && <ImagePreviewModal imageUrl={viewingImageUrl} onClose={() => setViewingImageUrl(null)} />}
    {!activeId && <NowBar />}
  </main>;
}
