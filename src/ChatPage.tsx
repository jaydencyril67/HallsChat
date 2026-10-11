import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { ArrowLeft, ArrowUp, Plus, Camera, Mic, Square, Play, Pause, MessageCircle, ShieldCheck, UsersRound, X, Trash2, Send } from "lucide-react";
import AppHeader from "./AppHeader";
import NowBar from "./NowBar";
import LoadingDots from "./components/LoadingDots";
import ImagePreviewModal from "./components/ImagePreviewModal";
import { navigate } from "./utils/navigate";
import { io } from "socket.io-client";

type ChatPerson = {
  id: string;
  name: string;
  username: string;
  profilePicture?: string;
  isOnline?: boolean;
  canMessage: boolean;
  lastMessage?: string;
  lastMessageAt?: string | null;
};
type ChatMessage = { id: string; senderId: string; recipientId: string; text: string; imageUrl?: string; images?: string[]; audioUrl?: string; createdAt: string; pending?: boolean };
const MAX_CHAT_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_CHAT_IMAGES = 4;
const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase() || "H";
}
function formatTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  return date.toDateString() === now.toDateString()
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

async function compressChatImage(file: File): Promise<File> {
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
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image compression isn't available in this browser.");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, width, height);

    const encode = (type: string, quality: number) => new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("This image couldn't be compressed.")), type, quality);
    });
    let blob = await encode("image/webp", 0.82);
    let type = blob.type === "image/webp" ? "image/webp" : "image/jpeg";
    if (type === "image/jpeg") {
      const jpegCanvas = document.createElement("canvas");
      jpegCanvas.width = width;
      jpegCanvas.height = height;
      const jpegContext = jpegCanvas.getContext("2d");
      if (!jpegContext) throw new Error("Image compression isn't available in this browser.");
      jpegContext.fillStyle = "#fff";
      jpegContext.fillRect(0, 0, width, height);
      jpegContext.drawImage(image, 0, 0, width, height);
      blob = await new Promise<Blob>((resolve, reject) => {
        jpegCanvas.toBlob(result => result ? resolve(result) : reject(new Error("This image couldn't be compressed.")), "image/jpeg", 0.82);
      });
    }
    const extension = type === "image/webp" ? "webp" : "jpg";
    const baseName = file.name.replace(/\.[^.]+$/, "") || "chat-image";
    return new File([blob], `${baseName}.${extension}`, { type, lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}
function Avatar({ person, size = "normal" }: { person: Pick<ChatPerson, "name" | "profilePicture" | "isOnline">; size?: "normal" | "large" }) {
  return <span className={`chat-avatar ${size === "large" ? "chat-avatar-large" : ""}`}>
    {person.profilePicture ? <img src={person.profilePicture} alt="" /> : initials(person.name)}
  </span>;
}

function formatAudioTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  return Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0");
}

function VoiceNotePlayer({ src, pending = false }: { src: string; pending?: boolean }) {
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
      <div className="chat-voice-meta"><span>{playing || currentTime > 0 ? formatAudioTime(currentTime) : formatAudioTime(duration)}</span>{pending && <span className="chat-voice-sending">Sending…</span>}</div>
    </div>
    <span className="chat-voice-mic"><Mic size={13} /></span>
  </div>;
}

export default function ChatPage() {
  const [people, setPeople] = useState<ChatPerson[]>([]);
  const [activeId, setActiveId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [otherTyping, setOtherTyping] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [historyLoadedFor, setHistoryLoadedFor] = useState("");
  const [error, setError] = useState("");
  const [mobileConversationOpen, setMobileConversationOpen] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [compressingImages, setCompressingImages] = useState(false);
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingPaused, setRecordingPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceDraft, setVoiceDraft] = useState<File | null>(null);
  const [voiceDraftUrl, setVoiceDraftUrl] = useState("");
  const [voiceBusy, setVoiceBusy] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const discardRecordingRef = useRef(false);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollOnOpenRef = useRef(false);
  const draftInputRef = useRef<HTMLTextAreaElement | null>(null);
  const activeIdRef = useRef(activeId);
  const currentUserIdRef = useRef(currentUserId);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const typingRecipientRef = useRef("");
  const typingStopTimerRef = useRef<number | null>(null);
  const otherTypingTimerRef = useRef<number | null>(null);
  const activePerson = useMemo(() => people.find(person => person.id === activeId) || null, [people, activeId]);
  activeIdRef.current = activeId;
  currentUserIdRef.current = currentUserId;

  const token = () => localStorage.getItem("hallschat_token");

  function stopTyping(recipientId = typingRecipientRef.current) {
    if (typingStopTimerRef.current !== null) window.clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = null;
    if (recipientId && typingRecipientRef.current === recipientId) {
      const socket = socketRef.current;
      if (socket?.connected) socket.emit("chat:typing", { recipientId, isTyping: false });
      typingRecipientRef.current = "";
    }
  }

  function handleDraftChange(value: string) {
    setDraft(value);
    const recipientId = activeIdRef.current;
    const socket = socketRef.current;
    if (!value.trim() || !recipientId || !socket?.connected) {
      stopTyping();
      return;
    }
    if (typingRecipientRef.current !== recipientId) {
      stopTyping();
      typingRecipientRef.current = recipientId;
      socket.emit("chat:typing", { recipientId, isTyping: true });
    }
    if (typingStopTimerRef.current !== null) window.clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = window.setTimeout(() => stopTyping(recipientId), 1800);
  }


  const loadPeople = useCallback(async (showLoader = false) => {
    const savedToken = localStorage.getItem("hallschat_token");
    if (!savedToken) { navigate("/signin", { replace: true }); return; }
    if (showLoader) setListLoading(true);
    try {
      const response = await fetch(`${apiBase}/api/chat/people`, { headers: { Authorization: `Bearer ${savedToken}` } });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) { localStorage.removeItem("hallschat_token"); navigate("/signin", { replace: true }); return; }
      if (!response.ok) throw new Error(payload.message || "Your chats couldn't be loaded.");
      const nextPeople = Array.isArray(payload.people) ? payload.people as ChatPerson[] : [];
      setPeople(nextPeople);
      setActiveId(current => current && nextPeople.some(person => person.id === current) ? current : "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Your chats couldn't be loaded.");
    } finally {
      if (showLoader) setListLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedToken = token();
    if (!savedToken) { navigate("/signin", { replace: true }); return; }
    let cancelled = false;
    fetch(`${apiBase}/api/auth/me`, { headers: { Authorization: `Bearer ${savedToken}` } })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (response.status === 401) { localStorage.removeItem("hallschat_token"); navigate("/signin", { replace: true }); return; }
        if (!response.ok) throw new Error(payload.message || "Your account couldn't be loaded.");
        if (!cancelled) setCurrentUserId(payload.user?.id || "");
      })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "Your account couldn't be loaded."); });
    void loadPeople(true);
    const timer = window.setInterval(() => { void loadPeople(false); }, 15000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [loadPeople]);

  useEffect(() => {
    if (!currentUserId) return;
    const savedToken = localStorage.getItem("hallschat_token");
    if (!savedToken) return;
    const socket = io(apiBase, {
      auth: { token: savedToken },
      transports: ["websocket", "polling"]
    });
    socketRef.current = socket;
    socket.on("connect_error", () => {
      // REST history remains available while the socket reconnects.
    });
    socket.on("chat:typing", (payload: { senderId?: string; isTyping?: boolean }) => {
      if (!payload?.senderId || payload.senderId !== activeIdRef.current) return;
      if (otherTypingTimerRef.current !== null) window.clearTimeout(otherTypingTimerRef.current);
      setOtherTyping(Boolean(payload.isTyping));
      if (payload.isTyping) {
        otherTypingTimerRef.current = window.setTimeout(() => {
          setOtherTyping(false);
          otherTypingTimerRef.current = null;
        }, 2500);
      } else {
        otherTypingTimerRef.current = null;
      }
    });
    socket.on("chat:message", (message: ChatMessage) => {
      const me = currentUserIdRef.current;
      const openId = activeIdRef.current;
      const belongsToOpenConversation =
        (message.senderId === me && message.recipientId === openId) ||
        (message.senderId === openId && message.recipientId === me);
      if (belongsToOpenConversation) {
        setMessages(current => {
          if (current.some(item => item.id === message.id)) return current;
          // Reconcile the server echo with the optimistic message already shown in the chat.
          if (message.senderId === me) {
            const incomingHasImage = Boolean(message.images?.length || message.imageUrl);
            const pendingIndex = current.findIndex(item =>
              item.pending &&
              (incomingHasImage
                ? Boolean(item.images?.length || item.imageUrl) && !item.text
                : Boolean(message.text) && item.text === message.text)
            );
            if (pendingIndex >= 0) {
              const next = [...current];
              next[pendingIndex] = message;
              return next;
            }
          }
          return [...current, message].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        });
      }
      const otherId = message.senderId === me ? message.recipientId : message.senderId;
      const preview = message.text || (message.audioUrl ? "🎤 Voice note" : (message.images?.length || message.imageUrl) ? "📷 Photo" : "");
      setPeople(current => {
        const next = current.map(person => person.id === otherId
          ? { ...person, lastMessage: preview, lastMessageAt: message.createdAt }
          : person);
        return next.sort((a, b) => {
          const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return bTime - aTime || a.name.localeCompare(b.name);
        });
      });
    });
    return () => {
      stopTyping();
      if (otherTypingTimerRef.current !== null) window.clearTimeout(otherTypingTimerRef.current);
      socket.removeAllListeners();
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [currentUserId]);

  useEffect(() => {
    setOtherTyping(false);
    if (otherTypingTimerRef.current !== null) window.clearTimeout(otherTypingTimerRef.current);
    otherTypingTimerRef.current = null;
    stopTyping();
  }, [activeId]);

  const loadMessages = useCallback(async (personId: string, showLoader = false) => {
    const savedToken = localStorage.getItem("hallschat_token");
    if (!savedToken || !personId) return;
    setHistoryLoadedFor("");
    if (showLoader) setMessagesLoading(true);
    try {
      const response = await fetch(`${apiBase}/api/chat/${encodeURIComponent(personId)}/messages`, {
        headers: { Authorization: `Bearer ${savedToken}` }
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) { localStorage.removeItem("hallschat_token"); navigate("/signin", { replace: true }); return; }
      if (!response.ok) throw new Error(payload.message || "This conversation couldn't be loaded.");
      const history = Array.isArray(payload.messages) ? payload.messages as ChatMessage[] : [];
      // Merge history with any socket event that arrived while the history request was in flight.
      setMessages(current => {
        const byId = new Map<string, ChatMessage>();
        [...history, ...current].forEach(message => byId.set(message.id, message));
        return Array.from(byId.values()).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      });
      setPeople(current => current.map(person => person.id === personId ? { ...person, canMessage: Boolean(payload.canMessage) } : person));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "This conversation couldn't be loaded.");
    } finally {
      if (showLoader) setMessagesLoading(false);
      setHistoryLoadedFor(personId);
    }
  }, []);

  useEffect(() => {
    if (!activeId) { setMessages([]); setMessagesLoading(false); setHistoryLoadedFor(""); return; }
    // Fetch history once when a conversation opens; new messages arrive over Socket.IO.
    void loadMessages(activeId, true);
  }, [activeId, loadMessages]);



  useEffect(() => {
    if (!scrollOnOpenRef.current || !activeId || messagesLoading || historyLoadedFor !== activeId) return;
    // Wait until the fetched history has rendered before moving to the latest message.
    const frame = window.requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
      scrollOnOpenRef.current = false;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeId, messages, messagesLoading, historyLoadedFor]);

  useEffect(() => {
    const input = draftInputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 144)}px`;
  }, [draft]);


  async function uploadChatImage(file: File, savedToken: string): Promise<string> {
    const authResponse = await fetch(`${apiBase}/api/media/imagekit-auth`, { headers: { Authorization: `Bearer ${savedToken}` } });
    const auth = await authResponse.json().catch(() => ({}));
    if (authResponse.status === 401) { localStorage.removeItem("hallschat_token"); navigate("/signin", { replace: true }); throw new Error("Please sign in again."); }
    if (!authResponse.ok) throw new Error(auth.message || "Image uploads are not configured yet.");
    const form = new FormData();
    form.append("file", file);
    form.append("fileName", `hallschat-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`);
    form.append("publicKey", auth.publicKey);
    form.append("token", auth.token);
    form.append("expire", String(auth.expire));
    form.append("signature", auth.signature);
    const uploadResponse = await fetch("https://upload.imagekit.io/api/v1/files/upload", { method: "POST", body: form });
    const uploaded = await uploadResponse.json().catch(() => ({}));
    if (!uploadResponse.ok || typeof uploaded.url !== "string") throw new Error(uploaded.message || "The image couldn't be uploaded. Please try again.");
    return uploaded.url;
  }

  async function handleImageSelection(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files || []);
    event.target.value = "";
    if (!picked.length) return;
    if (imageFiles.length + picked.length > MAX_CHAT_IMAGES) {
      setError(`You can attach up to ${MAX_CHAT_IMAGES} images per message.`);
      return;
    }
    if (picked.some(file => !file.type.startsWith("image/"))) { setError("Choose image files only."); return; }
    if (picked.some(file => file.size > MAX_CHAT_IMAGE_SIZE)) { setError("Each original image must be 10 MB or smaller."); return; }
    setError("");
    setCompressingImages(true);
    try {
      const compressed = await Promise.all(picked.map(compressChatImage));
      setImageFiles(current => [...current, ...compressed]);
      setImagePreviews(current => [...current, ...compressed.map(file => URL.createObjectURL(file))]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "One or more images couldn't be prepared.");
    } finally {
      setCompressingImages(false);
    }
  }

  function removeSelectedImage(index: number) {
    const preview = imagePreviews[index];
    if (preview) URL.revokeObjectURL(preview);
    setImageFiles(current => current.filter((_, i) => i !== index));
    setImagePreviews(current => current.filter((_, i) => i !== index));
  }

  async function recordVoiceNote() {
    if (recording) {
      mediaRecorderRef.current?.pause();
      setRecording(false);
      setRecordingPaused(true);
      return;
    }
    if (recordingPaused) {
      mediaRecorderRef.current?.resume();
      setRecording(true);
      setRecordingPaused(false);
      return;
    }
    if (voiceBusy || voiceDraft) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setError("Voice recording is not supported by this browser or app."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      recordingChunksRef.current = [];
      discardRecordingRef.current = false;
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find(type => MediaRecorder.isTypeSupported(type));
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      setRecordingSeconds(0);
      setRecording(true);
      setRecordingPaused(false);
      setAttachmentMenuOpen(false);
      recorder.ondataavailable = event => { if (event.data.size) recordingChunksRef.current.push(event.data); };
      recorder.onerror = () => {
        setError("Recording failed. Please try again.");
        setRecording(false);
        setRecordingPaused(false);
        stream.getTracks().forEach(track => track.stop());
        recordingStreamRef.current = null;
      };
      recorder.onstop = () => {
        setRecording(false);
        setRecordingPaused(false);
        stream.getTracks().forEach(track => track.stop());
        recordingStreamRef.current = null;
        const chunks = recordingChunksRef.current;
        recordingChunksRef.current = [];
        if (discardRecordingRef.current) { discardRecordingRef.current = false; return; }
        if (!chunks.length) return;
        const type = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunks, { type });
        if (blob.size > 12 * 1024 * 1024) { setError("That voice note is too large. Please record a shorter one."); return; }
        const ext = type.includes("ogg") ? "ogg" : type.includes("mp4") ? "m4a" : "webm";
        const file = new File([blob], "voice-note-" + Date.now() + "." + ext, { type });
        setVoiceDraft(file);
        setVoiceDraftUrl(URL.createObjectURL(blob));
      };
      recorder.start(250);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Microphone access was denied.");
      setRecording(false);
      setRecordingPaused(false);
    }
  }

  function finishVoiceRecording() {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }

  function discardVoiceDraft() {
    if (recording || recordingPaused) {
      discardRecordingRef.current = true;
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") recorder.stop();
      else {
        setRecording(false);
        setRecordingPaused(false);
        recordingStreamRef.current?.getTracks().forEach(track => track.stop());
        recordingStreamRef.current = null;
        recordingChunksRef.current = [];
      }
    }
    if (voiceDraftUrl) URL.revokeObjectURL(voiceDraftUrl);
    setVoiceDraft(null);
    setVoiceDraftUrl("");
    setRecordingSeconds(0);
    setRecording(false);
    setRecordingPaused(false);
  }

  async function sendVoiceDraft() {
    if (!voiceDraft || voiceBusy) return;
    const savedToken = token();
    const person = people.find(item => item.id === activeIdRef.current);
    if (!savedToken || !person?.canMessage) return;
    const file = voiceDraft;
    const previewUrl = voiceDraftUrl;
    setVoiceBusy(true);
    setError("");
    const pendingId = "pending-audio-" + Date.now();
    const pending: ChatMessage = { id: pendingId, senderId: currentUserIdRef.current, recipientId: person.id, text: "", audioUrl: previewUrl, createdAt: new Date().toISOString(), pending: true };
    setMessages(current => [...current, pending]);
    try {
      const audioUrl = await uploadChatImage(file, savedToken);
      const socket = socketRef.current;
      if (!socket?.connected) throw new Error("Reconnecting to live chat. Please try sending the voice note again.");
      const sent = await new Promise<ChatMessage>((resolve, reject) => socket.timeout(20000).emit("chat:send", { recipientId: person.id, text: "", images: [], audioUrl }, (timeoutError: Error | null, response: { ok?: boolean; message?: ChatMessage | string }) => {
        if (timeoutError) return reject(new Error("The live connection timed out while sending your voice note."));
        if (!response?.ok) return reject(new Error(typeof response?.message === "string" ? response.message : "Your voice note couldn't be sent."));
        const result = response.message as ChatMessage;
        if (!result || typeof result !== "object" || !result.id) return reject(new Error("The server didn't confirm your voice note."));
        resolve(result);
      }));
      setMessages(current => [...current.filter(item => item.id !== pendingId && item.id !== sent.id), sent].sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
      setPeople(current => current.map(item => item.id === person.id ? { ...item, lastMessage: "🎤 Voice note", lastMessageAt: sent.createdAt } : item));
      URL.revokeObjectURL(previewUrl);
      setVoiceDraft(null);
      setVoiceDraftUrl("");
      setRecordingSeconds(0);
    } catch (err) {
      setMessages(current => current.filter(item => item.id !== pendingId));
      setError(err instanceof Error ? err.message : "Your voice note couldn't be sent.");
    } finally { setVoiceBusy(false); }
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

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    stopTyping();
    const text = draft.trim();
    if (!activePerson || !activePerson.canMessage || (!text && imageFiles.length === 0) || compressingImages) return;
    const savedToken = token();
    if (!savedToken) { navigate("/signin", { replace: true }); return; }

    const recipientId = activePerson.id;
    const now = new Date().toISOString();
    const pendingItems: ChatMessage[] = [
      ...(text ? [{
        id: `pending-text-${Date.now()}`,
        senderId: currentUserId,
        recipientId,
        text,
        createdAt: now,
        pending: true
      } as ChatMessage] : []),
      ...imagePreviews.map((url, index) => ({
        id: `pending-image-${Date.now()}-${index}`,
        senderId: currentUserId,
        recipientId,
        text: "",
        imageUrl: url,
        createdAt: new Date(Date.now() + index).toISOString(),
        pending: true
      } as ChatMessage))
    ];
    const pendingIds = pendingItems.map(item => item.id);
    const filesToSend = [...imageFiles];
    const previewsToRelease = [...imagePreviews];

    // Show the messages in the conversation immediately, before image upload/network sending.
    setMessages(current => [...current, ...pendingItems]);
    setDraft("");
    setImageFiles([]);
    setImagePreviews([]);
    setError("");

    try {
      const images: string[] = [];
      for (const file of filesToSend) images.push(await uploadChatImage(file, savedToken));
      const socket = socketRef.current;
      if (!socket?.connected) throw new Error("Reconnecting to live chat. Please try sending again in a moment.");

      const sendOne = (messageText: string, imageUrl?: string) => new Promise<ChatMessage>((resolve, reject) => {
        socket.timeout(15000).emit(
          "chat:send",
          { recipientId, text: messageText, images: imageUrl ? [imageUrl] : [] },
          (timeoutError: Error | null, response: { ok?: boolean; message?: ChatMessage | string }) => {
            if (timeoutError) return reject(new Error("The live connection timed out. Some items may already have been sent."));
            if (!response?.ok) return reject(new Error(typeof response?.message === "string" ? response.message : "Your message couldn't be sent."));
            const sent = response.message as ChatMessage;
            if (!sent || typeof sent !== "object" || !sent.id) return reject(new Error("The server didn't confirm your message."));
            resolve(sent);
          }
        );
      });

      let pendingIndex = 0;
      const sentMessages: ChatMessage[] = [];
      if (text) {
        const sent = await sendOne(text);
        sentMessages.push(sent);
        const pendingId = pendingIds[pendingIndex++];
        setMessages(current => {
          const withoutPending = current.filter(message => message.id !== pendingId && message.id !== sent.id);
          return [...withoutPending, sent].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        });
      }
      for (const imageUrl of images) {
        const sent = await sendOne("", imageUrl);
        sentMessages.push(sent);
        const pendingId = pendingIds[pendingIndex++];
        setMessages(current => {
          const withoutPending = current.filter(message => message.id !== pendingId && message.id !== sent.id);
          return [...withoutPending, sent].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        });
      }
      previewsToRelease.forEach(url => URL.revokeObjectURL(url));
      const lastSent = sentMessages[sentMessages.length - 1];
      if (lastSent) setPeople(current => current.map(person => person.id === recipientId ? { ...person, lastMessage: lastSent.text || ((lastSent.images?.length || lastSent.imageUrl) ? "📷 Photo" : ""), lastMessageAt: lastSent.createdAt } : person).sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime || a.name.localeCompare(b.name);
      }));
    } catch (err) {
      setMessages(current => current.filter(message => !pendingIds.includes(message.id)));
      previewsToRelease.forEach(url => URL.revokeObjectURL(url));
      setError(err instanceof Error ? err.message : "Your message couldn't be sent.");
    } finally {
    }
  }

  return <main className={`home-page social-home chat-page ${activePerson && mobileConversationOpen ? "chat-page-conversation-open" : ""}`}>
    <AppHeader homeHref="/home" />
    <section className="home-shell social-shell chat-shell">
      <div className={`chat-layout ${activePerson && mobileConversationOpen ? "chat-layout-conversation-open" : ""}`}>
        <aside className="chat-sidebar" aria-label="Your conversations">
          <div className="chat-sidebar-heading"><strong>Messages</strong></div>
          {listLoading ? <div className="chat-list-state"><LoadingDots /></div> : people.length ? <div className="chat-people-list">
            {people.map(person => <article key={person.id} className={`chat-person-row ${activeId === person.id ? "chat-person-row-active" : ""}`}>
              <Avatar person={person} />
              <button type="button" className="chat-person-copy chat-person-select" onClick={() => { stopTyping(); setOtherTyping(false); scrollOnOpenRef.current = true; setActiveId(person.id); setMobileConversationOpen(true); setError(""); }} aria-label={`Open chat with ${person.name}`}>
                <strong>{person.name}</strong><small>@{person.username} · {person.isOnline ? "Online" : "Offline"}</small><span className="chat-last-message">{person.canMessage ? (person.lastMessage || "Start a conversation") : (person.lastMessage || "No longer follows you")}</span>
              </button>
              <span className="chat-person-meta">{formatTime(person.lastMessageAt)}{!person.canMessage && <span className="chat-lock-dot" title="Messaging unavailable">•</span>}</span>
              <button type="button" className="chat-open-button" onClick={() => { scrollOnOpenRef.current = true; setActiveId(person.id); setMobileConversationOpen(true); setError(""); }} aria-label={`Open conversation with ${person.name}`} title="Open chat"><MessageCircle size={18} /></button>
            </article>)}
          </div> : <div className="chat-list-empty"><UsersRound size={24} /><strong>No followers yet</strong><p>When someone follows you, you can start chatting with them here.</p></div>}
        </aside>

        <section className="chat-conversation" aria-label="Conversation">
          {activePerson ? <>
            <header className="chat-conversation-header">
              <button className="chat-back-button" type="button" onClick={() => { stopTyping(); setOtherTyping(false); setMobileConversationOpen(false); setActiveId(""); }} aria-label="Back to messages"><ArrowLeft size={19} /></button>
              <Avatar person={activePerson} size="large" />
              <div className="chat-conversation-person"><strong>{activePerson.name}</strong><span className={otherTyping ? "chat-typing-label" : ""}>{otherTyping ? "Typing…" : `@${activePerson.username}`}</span></div>
              <span className={`chat-access-pill ${activePerson.isOnline ? "chat-status-online" : "chat-status-offline"}`} aria-label={activePerson.isOnline ? "Online" : "Offline"}>{activePerson.isOnline ? "Online" : "Offline"}</span>
            </header>
            <div className="chat-message-list">
              {messagesLoading ? <div className="chat-message-loading"><LoadingDots /></div> : messages.length ? messages.map(message => {
                const mine = message.senderId === currentUserId;
                return <div key={message.id} className={`chat-message-line ${mine ? "chat-message-line-mine" : ""}`}>
                  <div className={`chat-message-content ${mine ? "chat-message-content-mine" : "chat-message-content-theirs"}`}>
                    <div className="chat-message-body">
                    {(message.images?.length ? message.images : message.imageUrl ? [message.imageUrl] : []).length > 0 && <div className={`chat-image-grid ${(message.images?.length || (message.imageUrl ? 1 : 0)) === 1 ? "chat-image-grid-single" : ""}`}>{(message.images?.length ? message.images : message.imageUrl ? [message.imageUrl] : []).map((url, index) => <button key={`${url}-${index}`} type="button" className="chat-image-bubble" onClick={() => setViewingImageUrl(url)} aria-label={`View image ${index + 1}`}><img src={url} alt={message.text || `Shared image ${index + 1}`} loading="lazy" /></button>)}</div>}
                    {message.audioUrl && <VoiceNotePlayer src={message.audioUrl} pending={Boolean(message.pending)} />}
                    {message.text && <p className="chat-message-text">{message.text}</p>}
                    </div>
                    <time>{message.pending ? "Sending…" : new Date(message.createdAt).toLocaleString()}</time>
                  </div>
                </div>;
              }) : <div className="chat-empty-conversation"><span><MessageCircle size={25} /></span><strong>Say hello</strong><p>Your messages with @{activePerson.username} will appear here.</p></div>}
              <div ref={bottomRef} />
            </div>
            {activePerson.canMessage ? <><input ref={imageInputRef} type="file" accept="image/*" multiple hidden onChange={handleImageSelection} />{(imagePreviews.length > 0 || compressingImages) && <div className="chat-image-pending-grid">{imagePreviews.map((url, index) => <div className="chat-image-pending" key={`${url}-${index}`}><img src={url} alt={`Image ${index + 1} ready to send`} /><button type="button" onClick={() => removeSelectedImage(index)} aria-label={`Remove image ${index + 1}`}><X size={17} /></button></div>)}<span className="chat-image-count">{compressingImages ? "Compressing images…" : `${imageFiles.length} ${imageFiles.length === 1 ? "image" : "images"} ready`}</span></div>}<form className="chat-composer" onSubmit={sendMessage}>
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" hidden onChange={handleImageSelection} />
              <div className="chat-attachment-wrap">
                <button type="button" className="chat-attach-button" onClick={() => setAttachmentMenuOpen(value => !value)} aria-label="Open attachments" title="Attach"><Plus size={22} /></button>
                {attachmentMenuOpen && <div className="chat-attachment-menu">
                  <button type="button" onClick={() => { setAttachmentMenuOpen(false); cameraInputRef.current?.click(); }}><Camera size={19} /><span>Camera / photo</span></button>
                  <button type="button" onClick={() => void recordVoiceNote()} disabled={voiceBusy}><Mic size={19} /><span>Voice note</span></button>
                </div>}
              </div>
              {(recording || recordingPaused) ? <div className={"chat-recording-status" + (recordingPaused ? " is-paused" : "")}><span className={"chat-recording-dot" + (recordingPaused ? " is-paused" : "")} />{recordingPaused ? "Recording paused" : "Recording voice note"} · {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, "0")}</div> : voiceDraft && voiceDraftUrl ? <div className="chat-voice-draft-preview"><VoiceNotePlayer src={voiceDraftUrl} /><span>Voice note ready</span></div> : <textarea ref={draftInputRef} value={draft} onChange={event => handleDraftChange(event.target.value)} maxLength={4000} rows={1} placeholder={`Message @${activePerson.username}…`} aria-label="Write a message" onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />}
              {!recording && !recordingPaused && !voiceDraft && <span className="chat-character-count">{draft.length > 3500 ? `${draft.length}/4000` : ""}</span>}
              {(recording || recordingPaused) ? <><button type="button" className="chat-recording-control" onClick={() => void recordVoiceNote()} aria-label={recordingPaused ? "Resume recording" : "Pause recording"} title={recordingPaused ? "Resume recording" : "Pause recording"}>{recordingPaused ? <Play size={17} fill="currentColor" /> : <Pause size={17} fill="currentColor" />}</button><button type="button" className="chat-stop-recording" onClick={finishVoiceRecording} aria-label="Finish recording and review" title="Finish recording and review"><Square size={17} fill="currentColor" /></button><button type="button" className="chat-discard-recording" onClick={discardVoiceDraft} aria-label="Delete recording" title="Delete recording"><Trash2 size={17} /></button></> : voiceDraft ? <><button type="button" className="chat-discard-recording" onClick={discardVoiceDraft} disabled={voiceBusy} aria-label="Delete voice note" title="Delete voice note"><Trash2 size={17} /></button><button type="button" className="chat-stop-recording" onClick={() => void sendVoiceDraft()} disabled={voiceBusy} aria-label="Send voice note" title="Send voice note">{voiceBusy ? <LoadingDots /> : <Send size={18} />}</button></> : <button type="submit" disabled={(!draft.trim() && imageFiles.length === 0) || compressingImages} aria-label="Send message"><ArrowUp size={20} strokeWidth={2.5} /></button>}
            </form></> : <div className="chat-readonly-notice"><ShieldCheck size={16} /><span>This person no longer follows you, so you can’t send new messages.</span></div>}
          </> : <div className="chat-welcome"><span><MessageCircle size={30} /></span><h2>Your conversations, all in one place</h2><p>Select a follower to start chatting. Only people who follow you can receive messages from you.</p></div>}
        </section>
      </div>
    </section>
    {viewingImageUrl && <ImagePreviewModal imageUrl={viewingImageUrl} onClose={() => setViewingImageUrl(null)} />}
    {error && <div className="halls-toast halls-toast-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Dismiss notification">×</button></div>}
    {!(activePerson && mobileConversationOpen) && <NowBar />}
  </main>;
}
