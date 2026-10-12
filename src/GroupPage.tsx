import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Compass, LockKeyhole, MessageCircle, Plus, Send, UsersRound, UserPlus, X, LogOut, Trash2, RefreshCw, AlertTriangle, Image as ImageIcon, Camera, Mic, Square, Play, Pause, Reply, MoreVertical, Pencil, Smile, Paperclip } from "lucide-react";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import type { ChangeEvent } from "react";
import ImagePreviewModal from "./components/ImagePreviewModal";
import AppHeader from "./AppHeader";
import NowBar from "./NowBar";
import LoadingDots from "./components/LoadingDots";

const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");
type GroupSummary = { id: string; name: string; description: string; visibility: "public" | "private"; avatar?: string; ownerId: string; memberCount: number; role: string | null; inviteCode?: string; createdAt: string; updatedAt: string; lastMessage?: { text: string; createdAt: string; senderName: string } | null };
type Member = { id: string; name: string; username: string; profilePicture?: string; role: "owner" | "admin" | "member"; joinedAt?: string };
type GroupReply = { id: string; senderId: string; text?: string; imageUrl?: string; audioUrl?: string; deleted?: boolean };
type GroupReaction = { userId: string; emoji: string };
type GroupMessage = { id: string; text: string; imageUrl?: string; images?: string[]; audioUrl?: string; replyTo?: GroupReply | null; reactions?: GroupReaction[]; deletedForEveryone?: boolean; createdAt: string; editedAt?: string | null; pending?: boolean; sender: { id: string; name: string; username: string; profilePicture?: string } | null };
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
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [inviteCode, setInviteCode] = useState("");
  const [draft, setDraft] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
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
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const discardRecordingRef = useRef(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const draftInputRef = useRef<HTMLTextAreaElement | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const [memberPanel, setMemberPanel] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState<null | (() => Promise<void>)>(null);
  const currentUserId = useMemo(() => { try { const token = localStorage.getItem("hallschat_token") || ""; const part = token.split(".")[0].replace(/-/g, "+").replace(/_/g, "/"); return JSON.parse(atob(part + "=".repeat((4 - part.length % 4) % 4))).sub || ""; } catch { return ""; } }, []);
  const askConfirm = (message: string, action: () => Promise<void>) => { setConfirmMessage(message); setConfirmAction(() => action); };

  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    const token = localStorage.getItem("hallschat_token");
    if (!token) { window.location.href = "/signin"; throw new Error("Please sign in to continue."); }
    const response = await fetch(apiBase + path, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers || {}) } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || "That action couldn't be completed.");
    return payload;
  }, []);

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

  useEffect(() => { void loadGroups(tab); const timer = window.setInterval(() => void loadGroups(tab, false), 15000); return () => window.clearInterval(timer); }, [tab, loadGroups]);
  useEffect(() => { if (!activeId) { setDetail(null); setMessages([]); return; } void loadDetail(activeId); const timer = window.setInterval(() => void loadDetail(activeId, false), 5000); return () => window.clearInterval(timer); }, [activeId, loadDetail]);
  useEffect(() => { const list = groupMessageListRef.current; if (list) list.scrollTop = list.scrollHeight; }, [activeId, messages.length]);
  useEffect(() => {
    if (!activeId) { socketRef.current?.disconnect(); socketRef.current = null; return; }
    const token = localStorage.getItem("hallschat_token");
    if (!token) return;
    const socket = io(apiBase, { auth: { token }, transports: ["websocket", "polling"] });
    socketRef.current = socket;
    socket.on("connect", () => socket.emit("group:join", { groupId: activeId }, (result: { ok?: boolean }) => { if (!result?.ok) setError("Live group updates are unavailable. You can still refresh messages."); }));
    socket.on("group:message", (message: GroupMessage) => {
      setMessages(current => current.some(item => item.id === message.id) ? current : [...current, message].sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
      setOtherTyping(false);
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
      setOtherTyping(Boolean(event.isTyping));
    });
    return () => { socket.emit("group:leave", { groupId: activeId }); socket.removeAllListeners(); socket.disconnect(); if (socketRef.current === socket) socketRef.current = null; };
  }, [activeId, currentUserId]);
  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setRecordingSeconds(value => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);
  useEffect(() => () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") { discardRecordingRef.current = true; mediaRecorderRef.current.stop(); }
    recordingStreamRef.current?.getTracks().forEach(track => track.stop());
    imagePreviews.forEach(url => URL.revokeObjectURL(url));
    if (voiceDraftUrl) URL.revokeObjectURL(voiceDraftUrl);
    if (typingTimerRef.current !== null) window.clearTimeout(typingTimerRef.current);
  }, [imagePreviews, voiceDraftUrl]);

  const filteredGroups = useMemo(() => groups.filter(group => (group.name + " " + group.description).toLowerCase().includes(search.trim().toLowerCase())), [groups, search]);

  async function createGroup(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const payload = await request("/api/groups", { method: "POST", body: JSON.stringify({ name, description, visibility }) });
      setShowCreate(false); setName(""); setDescription(""); setVisibility("public"); setTab("mine");
      await loadGroups("mine"); if (payload.group?.id) setActiveId(payload.group.id);
      setNotice(visibility === "private" && payload.group?.inviteCode ? "Group created. Keep the private invite code safe: " + payload.group.inviteCode : "Your group is ready.");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to create group."); }
    finally { setBusy(false); }
  }

  async function joinGroup(id?: string, code?: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const payload = await request("/api/groups/join", { method: "POST", body: JSON.stringify(id ? { groupId: id } : { inviteCode: code }) });
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
  function handleImageSelection(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files || []); event.target.value = "";
    if (!picked.length) return;
    if (imageFiles.length + picked.length > 4) { setError("You can attach up to 4 images per message."); return; }
    if (picked.some(file => !file.type.startsWith("image/"))) { setError("Choose image files only."); return; }
    if (picked.some(file => file.size > 10 * 1024 * 1024)) { setError("Each image must be 10 MB or smaller."); return; }
    setImageFiles(current => [...current, ...picked]);
    setImagePreviews(current => [...current, ...picked.map(file => URL.createObjectURL(file))]);
    setAttachmentMenuOpen(false); setError("");
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
  function discardVoiceDraft() {
    if (recording || recordingPaused) { discardRecordingRef.current = true; const recorder = mediaRecorderRef.current; if (recorder && recorder.state !== "inactive") recorder.stop(); }
    if (voiceDraftUrl) URL.revokeObjectURL(voiceDraftUrl);
    setVoiceDraft(null); setVoiceDraftUrl(""); setRecordingSeconds(0); setRecording(false); setRecordingPaused(false);
  }
  async function sendGroupMessage() {
    if (!activeId || busy || voiceBusy) return;
    const savedToken = localStorage.getItem("hallschat_token");
    if (!savedToken) { window.location.href = "/signin"; return; }
    const text = draft.trim();
    if (!text && !imageFiles.length && !voiceDraft) return;
    setBusy(true); setError("");
    const pendingId = "pending-" + Date.now();
    const pending: GroupMessage = { id: pendingId, text, images: [...imagePreviews], audioUrl: voiceDraftUrl, imageUrl: imagePreviews[0], replyTo: replyingTo ? { id: replyingTo.id, senderId: replyingTo.sender?.id || "", text: replyingTo.text, imageUrl: replyingTo.images?.[0] || replyingTo.imageUrl, audioUrl: replyingTo.audioUrl, deleted: Boolean(replyingTo.deletedForEveryone) } : null, reactions: [], createdAt: new Date().toISOString(), pending: true, sender: { id: currentUserId, name: "You", username: "" } };
    setMessages(current => [...current, pending]); setDraft(""); setReplyingTo(null); setAttachmentMenuOpen(false);
    const files = [...imageFiles]; const previews = [...imagePreviews]; const voiceFile = voiceDraft;
    setImageFiles([]); setImagePreviews([]); setVoiceDraft(null); setVoiceDraftUrl(""); setRecordingSeconds(0);
    try {
      const images: string[] = [];
      for (const file of files) images.push(await uploadGroupMedia(file, savedToken));
      const audioUrl = voiceFile ? await uploadGroupMedia(voiceFile, savedToken) : "";
      const payload = await request(`/api/groups/${encodeURIComponent(activeId)}/messages`, { method: "POST", body: JSON.stringify({ text, images, audioUrl, ...(replyingTo ? { replyToId: replyingTo.id } : {}) }) });
      const sent = payload.message as GroupMessage;
      if (!sent?.id) throw new Error("The server didn't confirm your message.");
      setMessages(current => [...current.filter(message => message.id !== pendingId && message.id !== sent.id), sent].sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
      await loadGroups("mine", false);
      previews.forEach(url => URL.revokeObjectURL(url));
      setNotice("");
    } catch (err) {
      setMessages(current => current.filter(message => message.id !== pendingId));
      setDraft(text); setImageFiles(files); setImagePreviews(previews); if (voiceFile) { setVoiceDraft(voiceFile); setVoiceDraftUrl(URL.createObjectURL(voiceFile)); }
      setError(err instanceof Error ? err.message : "Message wasn't sent.");
    } finally { setBusy(false); }
  }
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
            <button type="button" className="chat-back-button" onClick={() => setMemberPanel(value => !value)} aria-label="Group details" aria-expanded={memberPanel} title="Group details"><UsersRound size={18}/></button>
          </header>
          {memberPanel && <div role="region" aria-label="Group details and members" style={{ position: "absolute", zIndex: 20, top: 64, right: 10, left: 10, maxHeight: "68%", overflowY: "auto", overscrollBehavior: "contain", padding: 14, border: "1px solid rgba(255,210,219,.16)", borderRadius: 15, background: "rgba(28,9,15,.98)", boxShadow: "0 16px 42px rgba(0,0,0,.45)", backdropFilter: "blur(16px)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}><strong>Group details</strong><button type="button" style={{ ...secondary, minHeight: 30, padding: "5px 10px" }} onClick={() => setMemberPanel(false)}>Done</button></div>
            {detail.description && <p style={{ ...muted, margin: "0 0 12px", fontSize: ".8rem", lineHeight: 1.5 }}>{detail.description}</p>}
            {detail.inviteCode && <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, padding: 10, border: "1px solid rgba(255,210,219,.1)", borderRadius: 10 }}><LockKeyhole size={15} color="#ff9cab"/><div style={{ flex: 1, minWidth: 0 }}><div style={{ ...muted, fontSize: ".7rem" }}>Private invite code</div><strong style={{ overflowWrap: "anywhere", fontSize: ".8rem" }}>{detail.inviteCode}</strong></div><button type="button" style={{ ...secondary, padding: "7px 9px" }} onClick={() => { void navigator.clipboard?.writeText(detail.inviteCode || ""); setNotice("Invite code copied."); }}>Copy</button></div>}
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
              const mine = message.sender?.id === currentUserId;
              const imgs = message.images?.length ? message.images : message.imageUrl ? [message.imageUrl] : [];
              const quoted = message.replyTo;
              const canEdit = mine && !message.pending && !message.deletedForEveryone && Boolean(message.text.trim()) && !imgs.length && !message.audioUrl && Date.now() - new Date(message.createdAt).getTime() <= 24 * 60 * 60 * 1000;
              const reactionGroups = Array.from((message.reactions || []).reduce((groups, reaction) => groups.set(reaction.emoji, [...(groups.get(reaction.emoji) || []), reaction]), new Map<string, GroupReaction[]>()).entries());
              return <div key={message.id} className={"chat-message-line" + (mine ? " chat-message-line-mine" : "")} id={"chat-message-" + message.id}>
                <div className={"chat-message-content " + (mine ? "chat-message-content-mine" : "chat-message-content-theirs")} style={{ maxWidth: "88%", position: "relative" }}>
                  <div className="chat-message-body">
                    {!mine && <span style={{ display: "block", color: "#ff9cab", fontSize: ".69rem", fontWeight: 800, marginBottom: 3 }}>{message.sender?.name || "Group member"} <span style={{ color: "rgba(246,220,225,.52)", fontWeight: 500 }}>@{message.sender?.username || "member"}</span></span>}
                    {message.deletedForEveryone ? <p className="chat-message-text" style={{ opacity: .65, fontStyle: "italic" }}>This message was deleted</p> : <>
                      {quoted && <button type="button" onClick={() => { const node = document.getElementById("chat-message-" + quoted.id); const list = groupMessageListRef.current; if (node && list) { list.scrollTo({ top: Math.max(0, list.scrollTop + node.getBoundingClientRect().top - list.getBoundingClientRect().top - 80), behavior: "smooth" }); node.style.outline = "2px solid #f07889"; window.setTimeout(() => { node.style.outline = ""; }, 1300); } }} style={{ display: "grid", width: "100%", gap: 3, textAlign: "left", padding: "7px 9px", marginBottom: 6, border: 0, borderLeft: "3px solid #f07889", borderRadius: "5px 8px 8px 5px", background: "rgba(240,120,137,.09)", color: "inherit" }}><strong style={{ fontSize: ".68rem", color: "#ff9cab" }}>{quoted.senderId === currentUserId ? "You" : (detail.members.find(member => member.id === quoted.senderId)?.name || "Group member")}</strong><span style={{ fontSize: ".75rem", opacity: .78, overflowWrap: "anywhere" }}>{quoted.deleted ? "This message was deleted" : quoted.text || (quoted.audioUrl ? "🎤 Voice note" : quoted.imageUrl ? "📷 Photo" : "Message")}</span></button>}
                      {editingMessageId === message.id ? <form onSubmit={event => { event.preventDefault(); void saveMessageEdit(message); }} style={{ display: "grid", gap: 7 }}><textarea value={editMessageDraft} onChange={event => setEditMessageDraft(event.target.value)} maxLength={4000} autoFocus rows={3} style={{ ...field, resize: "vertical" }}/><div style={{ display: "flex", gap: 7 }}><button type="button" style={{ ...secondary, flex: 1 }} onClick={() => { setEditingMessageId(null); setEditMessageDraft(""); }}>Cancel</button><button type="submit" style={{ ...primary, flex: 1 }} disabled={!editMessageDraft.trim()}>Save</button></div></form> : message.text && <p className="chat-message-text">{message.text}</p>}
                      {imgs.length > 0 && <div style={{ display: "grid", gridTemplateColumns: imgs.length === 1 ? "minmax(0,1fr)" : "repeat(2,minmax(0,1fr))", gap: 3, marginTop: message.text ? 5 : 0 }}>{imgs.map((url,index) => <button key={url + index} type="button" onClick={() => setViewingImageUrl(url)} aria-label="Preview group image" style={{ display: "block", minWidth: 0, padding: 0, border: 0, background: "transparent", overflow: "hidden", borderRadius: 8 }}><img src={url} alt="Group attachment" loading="lazy" style={{ display: "block", width: "100%", maxHeight: 320, aspectRatio: imgs.length > 1 ? "1 / 1" : "auto", objectFit: imgs.length > 1 ? "cover" : "contain" }}/></button>)}</div>}
                      {message.audioUrl && <audio controls preload="metadata" src={message.audioUrl} style={{ display: "block", width: "min(270px,100%)", height: 42, marginTop: 5 }}/>}
                    </>}
                  </div>
                  <div className="chat-message-footer"><time>{message.editedAt && !message.deletedForEveryone ? "Edited · " : ""}{new Date(message.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}{message.pending ? " · Sending…" : ""}</time>
                    {!message.pending && !message.deletedForEveryone && <div className="chat-message-more" style={{ position: "relative" }}><button type="button" aria-label="Message actions" title="Message actions" onClick={event => { event.stopPropagation(); setActionMenuFor(current => current === message.id ? null : message.id); setReactionPickerFor(null); }} style={{ display: "grid", placeItems: "center", width: 25, height: 24, border: 0, background: "transparent", color: "inherit" }}><MoreVertical size={15}/></button>
                      {actionMenuFor === message.id && <div className="chat-message-actions" role="menu" onClick={event => event.stopPropagation()} style={{ position: "absolute", zIndex: 30, bottom: 26, right: 0, minWidth: 160, padding: 6, border: "1px solid rgba(255,210,219,.15)", borderRadius: 11, background: "rgba(28,9,15,.98)", boxShadow: "0 12px 30px #0008" }}>
                        <button type="button" role="menuitem" onClick={() => { setReplyingTo(message); setActionMenuFor(null); draftInputRef.current?.focus(); }} style={{ ...secondary, width: "100%", justifyContent: "flex-start", marginBottom: 4 }}><Reply size={14}/> Reply</button>
                        <button type="button" role="menuitem" onClick={() => { setReactionPickerFor(message.id); setActionMenuFor(null); }} style={{ ...secondary, width: "100%", justifyContent: "flex-start", marginBottom: 4 }}><Smile size={14}/> React</button>
                        {canEdit && <button type="button" role="menuitem" onClick={() => { setEditingMessageId(message.id); setEditMessageDraft(message.text); setActionMenuFor(null); }} style={{ ...secondary, width: "100%", justifyContent: "flex-start", marginBottom: 4 }}><Pencil size={14}/> Edit</button>}
                        <button type="button" role="menuitem" onClick={() => void deleteGroupMessage(message, "me")} style={{ ...secondary, width: "100%", justifyContent: "flex-start", marginBottom: 4 }}><Trash2 size={14}/> Delete for me</button>
                        {mine && <button type="button" role="menuitem" onClick={() => askConfirm("Delete this message for everyone in the group?", async () => deleteGroupMessage(message, "everyone"))} style={{ ...secondary, width: "100%", justifyContent: "flex-start", color: "#ffabb7" }}><Trash2 size={14}/> Delete for everyone</button>}
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
          <form className="chat-composer" onSubmit={sendMessage}>
            {replyingTo && <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", borderLeft: "3px solid #f07889", borderRadius: 7, background: "rgba(240,120,137,.08)" }}><div style={{ minWidth: 0, flex: 1 }}><strong style={{ display: "block", fontSize: ".72rem", color: "#ff9cab" }}>Replying to {replyingTo.sender?.id === currentUserId ? "yourself" : replyingTo.sender?.name || "group member"}</strong><span style={{ display: "block", fontSize: ".75rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{replyingTo.deletedForEveryone ? "This message was deleted" : replyingTo.text || (replyingTo.audioUrl ? "🎤 Voice note" : (replyingTo.images?.length || replyingTo.imageUrl) ? "📷 Photo" : "Message")}</span></div><button type="button" aria-label="Cancel reply" onClick={() => setReplyingTo(null)} style={{ ...secondary, minHeight: 28, padding: 5 }}><X size={14}/></button></div>}
            {(imagePreviews.length > 0 || voiceDraftUrl) && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", width: "100%", padding: "5px 0" }}>{imagePreviews.map((url,index) => <div key={url} style={{ position: "relative", width: 66, height: 66 }}><img src={url} alt="Selected attachment" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }}/><button type="button" aria-label="Remove image" onClick={() => removeSelectedImage(index)} style={{ position: "absolute", top: -5, right: -5, display: "grid", placeItems: "center", width: 22, height: 22, borderRadius: "50%", border: "1px solid #ffffff55", background: "#2b0d17", color: "#fff" }}><X size={13}/></button></div>)}{voiceDraftUrl && <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}><audio controls src={voiceDraftUrl} style={{ width: "min(240px,100%)", height: 38 }}/><button type="button" onClick={discardVoiceDraft} style={{ ...secondary, minHeight: 30, padding: 5 }}><Trash2 size={14}/></button></div>}</div>}
            {(recording || recordingPaused) && <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", color: recordingPaused ? "#d7b7be" : "#ff9cab", fontSize: ".8rem" }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: recordingPaused ? "#a58b91" : "#ff657d" }}/>{recordingPaused ? "Recording paused" : "Recording voice note"} · {Math.floor(recordingSeconds/60)}:{String(recordingSeconds%60).padStart(2,"0")}<button type="button" onClick={discardVoiceDraft} style={{ ...secondary, marginLeft: "auto", minHeight: 30, padding: "5px 8px" }}>Discard</button><button type="button" onClick={() => { if (recordingPaused) void recordVoiceNote(); else { mediaRecorderRef.current?.stop(); } }} style={{ ...primary, minHeight: 30, padding: "5px 8px" }}>{recordingPaused ? "Resume" : "Finish"}</button></div>}
            <div className="chat-attachment-wrap" style={{ position: "relative" }}><button type="button" aria-label="Add attachment" title="Add attachment" onClick={() => setAttachmentMenuOpen(value => !value)} style={{ display: "grid", placeItems: "center", width: 36, height: 36, border: 0, borderRadius: 9, background: "rgba(255,255,255,.05)", color: "#ff9cab" }}><Paperclip size={18}/></button>
              {attachmentMenuOpen && <div className="chat-attachment-menu" style={{ position: "absolute", zIndex: 35, bottom: 44, left: 0, display: "grid", gap: 5, minWidth: 160, padding: 7, border: "1px solid rgba(255,210,219,.15)", borderRadius: 11, background: "rgba(28,9,15,.98)", boxShadow: "0 12px 30px #0008" }}><button type="button" style={{ ...secondary, justifyContent: "flex-start" }} onClick={() => imageInputRef.current?.click()}><ImageIcon size={15}/> Gallery</button><button type="button" style={{ ...secondary, justifyContent: "flex-start" }} onClick={() => cameraInputRef.current?.click()}><Camera size={15}/> Camera</button><button type="button" style={{ ...secondary, justifyContent: "flex-start" }} onClick={() => void recordVoiceNote()}><Mic size={15}/> Voice note</button></div>}
            </div>
            <textarea ref={draftInputRef} aria-label="Write a group message" value={draft} onChange={event => { setDraft(event.target.value); socketRef.current?.emit("group:typing", { groupId: activeId, isTyping: true }); if (typingTimerRef.current !== null) window.clearTimeout(typingTimerRef.current); typingTimerRef.current = window.setTimeout(() => socketRef.current?.emit("group:typing", { groupId: activeId, isTyping: false }), 1200); }} placeholder="Message the group…" maxLength={4000} rows={1} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }}/>
            <button type="submit" disabled={busy || voiceBusy || (!draft.trim() && !imageFiles.length && !voiceDraft) || recording || recordingPaused} aria-label="Send group message" title="Send"><Send size={18}/></button>
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
            <Avatar name={group.name} src={group.avatar} size={49}/><button type="button" onClick={() => tab === "discover" ? void joinGroup(group.id) : setActiveId(group.id)} style={{ flex: 1, minWidth: 0, textAlign: "left", padding: 0, border: 0, background: "transparent", color: "inherit" }}><span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: ".9rem", fontWeight: 850, color: "#fff0f3" }}>{group.name}{group.visibility === "private" ? <LockKeyhole size={13} color="#ff9cab"/> : null}</span><span style={{ display: "block", ...muted, fontSize: ".75rem", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{group.lastMessage ? (group.lastMessage.senderName ? group.lastMessage.senderName + ": " : "") + group.lastMessage.text : group.description || "No messages yet"}</span><span style={{ display: "block", ...muted, fontSize: ".7rem", marginTop: 5 }}>{group.memberCount} members · {group.role || "Public"}{group.lastMessage ? " · " + formatTime(group.lastMessage.createdAt) : ""}</span></button>{tab === "discover" ? <button type="button" style={primary} disabled={busy} onClick={() => void joinGroup(group.id)}>Join</button> : <button type="button" aria-label={"Open " + group.name} style={{ ...secondary, width: 38, padding: 0 }} onClick={() => setActiveId(group.id)}><ArrowLeft size={17} style={{ transform: "rotate(180deg)" }}/></button>}
          </div>)}</div> : <div style={{ ...panel, textAlign: "center", padding: "32px 18px" }}><div style={{ width: 49, height: 49, margin: "0 auto 12px", borderRadius: 16, display: "grid", placeItems: "center", background: "rgba(184,32,50,.14)", color: "#ff9cab" }}><UsersRound size={23}/></div><strong style={{ display: "block", fontSize: ".92rem" }}>{tab === "mine" ? "Your group story starts here" : "No groups found"}</strong><p style={{ ...muted, margin: "7px auto 14px", maxWidth: 320, fontSize: ".8rem", lineHeight: 1.6 }}>{tab === "mine" ? "Create a group for friends, family, classmates, or your community." : "Try another search, or create a public group for people to discover."}</p>{tab === "mine" && <button type="button" style={primary} onClick={() => setShowCreate(true)}><Plus size={16}/> Create your first group</button>}</div>}
        </>}
      </div>
    </section>
    {(showCreate || showJoin) && <div role="dialog" aria-modal="true" aria-label={showCreate ? "Create a group" : "Join a group"} onClick={event => { if (event.target === event.currentTarget) { setShowCreate(false); setShowJoin(false); } }} style={{ position: "fixed", inset: 0, zIndex: 4000, display: "grid", placeItems: "center", padding: 18, background: "rgba(7,3,6,.78)", backdropFilter: "blur(8px)" }}>
      <div style={{ ...panel, width: "100%", maxWidth: 430, padding: 18, boxShadow: "0 20px 70px rgba(0,0,0,.5)" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 15 }}><strong style={{ fontSize: "1rem" }}>{showCreate ? "Create a group" : "Join a private group"}</strong></div>
        {showCreate ? <form onSubmit={createGroup} style={{ display: "grid", gap: 11 }}><label style={{ fontSize: ".78rem", fontWeight: 750 }}>Group name<input required minLength={2} maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Weekend Football Crew" style={{ ...field, marginTop: 6 }}/></label><label style={{ fontSize: ".78rem", fontWeight: 750 }}>Description <span style={muted}>(optional)</span><textarea maxLength={500} value={description} onChange={event => setDescription(event.target.value)} placeholder="What is this group about?" rows={3} style={{ ...field, resize: "vertical", marginTop: 6 }}/></label><div style={{ fontSize: ".78rem", fontWeight: 750 }}>Who can join?</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{([{ id: "public", label: "Public", detail: "Anyone can discover it" }, { id: "private", label: "Private", detail: "Invite code required" }] as const).map(option => <button key={option.id} type="button" onClick={() => setVisibility(option.id)} style={{ ...secondary, minHeight: 68, flexDirection: "column", alignItems: "flex-start", borderColor: visibility === option.id ? "rgba(229,70,92,.75)" : "rgba(255,210,219,.16)", background: visibility === option.id ? "rgba(184,32,50,.13)" : "rgba(255,255,255,.03)" }}><span>{option.id === "public" ? <Compass size={15}/> : <LockKeyhole size={15}/>} {option.label}</span><span style={{ ...muted, fontSize: ".68rem", fontWeight: 500 }}>{option.detail}</span></button>)}</div><button type="submit" disabled={busy || name.trim().length < 2} style={{ ...primary, width: "100%", opacity: busy || name.trim().length < 2 ? .6 : 1 }}>{busy ? <LoadingDots/> : <><Plus size={16}/> Create group</>}</button></form> : <form onSubmit={event => { event.preventDefault(); void joinGroup(undefined, inviteCode); }} style={{ display: "grid", gap: 12 }}><p style={{ ...muted, margin: 0, fontSize: ".82rem", lineHeight: 1.55 }}>Enter the invite code shared by the group owner or an admin.</p><input required value={inviteCode} onChange={event => setInviteCode(event.target.value.trim())} placeholder="Invite code" style={field}/><button type="submit" disabled={busy || !inviteCode.trim()} style={{ ...primary, width: "100%" }}>{busy ? <LoadingDots/> : <><UserPlus size={16}/> Join group</>}</button></form>}
      </div>
    </div>}
    {confirmAction && <div role="dialog" aria-modal="true" aria-label="Confirm group action" onClick={event => { if (event.target === event.currentTarget) { setConfirmAction(null); setConfirmMessage(""); } }} style={{ position: "fixed", inset: 0, zIndex: 4500, display: "grid", placeItems: "center", padding: 18, background: "rgba(7,3,6,.78)", backdropFilter: "blur(8px)" }}><div style={{ ...panel, width: "100%", maxWidth: 380, padding: 18, boxShadow: "0 20px 70px rgba(0,0,0,.5)" }}><div style={{ width: 42, height: 42, borderRadius: 13, display: "grid", placeItems: "center", background: "rgba(184,32,50,.16)", color: "#ff9cab", marginBottom: 12 }}><AlertTriangle size={20}/></div><strong style={{ display: "block", fontSize: ".98rem" }}>Are you sure?</strong><p style={{ ...muted, fontSize: ".82rem", lineHeight: 1.55, margin: "7px 0 17px" }}>{confirmMessage}</p><div style={{ display: "flex", gap: 9 }}><button type="button" style={{ ...secondary, flex: 1 }} onClick={() => { setConfirmAction(null); setConfirmMessage(""); }}>Cancel</button><button type="button" style={{ ...primary, flex: 1 }} disabled={busy} onClick={() => { const action = confirmAction; setConfirmAction(null); setConfirmMessage(""); if (action) void action(); }}>Confirm</button></div></div></div>}
    {(error || notice) && <div role={error ? "alert" : "status"} style={{ position: "fixed", left: 14, right: 14, bottom: 90, zIndex: 5000, maxWidth: 520, margin: "0 auto", padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, borderRadius: 13, border: "1px solid " + (error ? "rgba(255,120,120,.3)" : "rgba(255,210,219,.16)"), background: "rgba(28,9,15,.97)", color: "#fff0f3", boxShadow: "0 12px 30px rgba(0,0,0,.35)", fontSize: ".8rem" }}><span style={{ flex: 1, overflowWrap: "anywhere" }}>{error || notice}</span><button type="button" aria-label="Dismiss" onClick={() => { setError(""); setNotice(""); }} style={{ ...secondary, minHeight: 28, padding: "3px 7px" }}><X size={15}/></button></div>}
    {viewingImageUrl && <ImagePreviewModal imageUrl={viewingImageUrl} onClose={() => setViewingImageUrl(null)} />}
    {!activeId && <NowBar />}
  </main>;
}
