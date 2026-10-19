import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { ArrowLeft, ArrowUp, Plus, Pencil, Pin, PinOff, Camera, Image as ImageIcon, Mic, Square, Play, Pause, MessageCircle, ShieldCheck, UsersRound, X, Trash2, Send, Reply, MoreVertical, Phone, Video, Smile } from "lucide-react";
import AppHeader from "./AppHeader";
import VerificationBadge from "./VerificationBadge";
import NowBar from "./NowBar";
import LoadingDots from "./components/LoadingDots";
import ImagePreviewModal from "./components/ImagePreviewModal";
import { navigate } from "./utils/navigate";
import { finishBackgroundTask, hasActiveBackgroundTask, startBackgroundTask, updateBackgroundTask } from "./utils/backgroundTasks";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import CallsPanel from "./components/CallsPanel";

type RoomPerson = {
  isVerified?: boolean;
  verifiedAt?: string | null;
  id: string;
  name: string;
  username: string;
  profilePicture?: string;
  isOnline?: boolean;
  activeStatusHidden?: boolean;
  canMessage: boolean;
  lastMessage?: string;
  lastMessageAt?: string | null;
};
type RoomReply = { id: string; senderId: string; text?: string; imageUrl?: string; audioUrl?: string; deleted?: boolean };
type RoomReaction = { userId: string; emoji: string };
type RoomCall = { id: string; person: { id: string; name: string; username: string; profilePicture?: string }; direction: "incoming" | "outgoing"; kind: "audio" | "video"; status: "ringing" | "missed" | "declined" | "cancelled" | "completed" | "failed"; durationSeconds: number; createdAt: string };
type RoomMessage = { id: string; senderId: string; recipientId: string; text: string; imageUrl?: string; images?: string[]; audioUrl?: string; replyTo?: RoomReply | null; reactions?: RoomReaction[]; deletedForEveryone?: boolean; editedAt?: string | null; readAt?: string | null; createdAt: string; pending?: boolean };
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

async function compressRoomImage(file: File): Promise<File> {
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
    const baseName = file.name.replace(/\.[^.]+$/, "") || "rooms-image";
    return new File([blob], `${baseName}.${extension}`, { type, lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}
function Avatar({ person, size = "normal" }: { person: Pick<RoomPerson, "name" | "profilePicture" | "isOnline">; size?: "normal" | "large" }) {
  return <span className={`rooms-avatar ${size === "large" ? "rooms-avatar-large" : ""}`}>
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
  return <div className={"rooms-voice-note" + (pending ? " rooms-voice-note-pending" : "")}>
    <audio ref={audioRef} src={src} preload="metadata" onLoadedMetadata={event => setDuration(event.currentTarget.duration || 0)} onDurationChange={event => setDuration(event.currentTarget.duration || 0)} onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); setCurrentTime(0); }} />
    <button type="button" className="rooms-voice-play" onClick={() => void togglePlayback()} aria-label={playing ? "Pause voice note" : "Play voice note"}>{playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button>
    <div className="rooms-voice-track">
      <div className="rooms-voice-waveform" role="slider" aria-label="Voice note playback position" aria-valuemin={0} aria-valuemax={Math.floor(duration || 0)} aria-valuenow={Math.floor(currentTime)} tabIndex={0} onPointerDown={event => { if (event.pointerType === "mouse" && event.button !== 0) return; event.preventDefault(); draggingRef.current = true; event.currentTarget.setPointerCapture(event.pointerId); seek(event.clientX, event.currentTarget); }} onPointerMove={event => { if (draggingRef.current) seek(event.clientX, event.currentTarget); }} onPointerUp={event => { if (draggingRef.current) seek(event.clientX, event.currentTarget); draggingRef.current = false; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={event => { draggingRef.current = false; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onKeyDown={event => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); const audio = audioRef.current; if (audio && Number.isFinite(audio.duration)) { audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + (event.key === "ArrowRight" ? 5 : -5))); setCurrentTime(audio.currentTime); } } }}>
        {bars.map((height, index) => <span key={index} className={index / bars.length <= progress ? "is-played" : ""} style={{ height: height + "px" }} />)}
      </div>
      <div className="rooms-voice-meta"><span>{playing || currentTime > 0 ? formatAudioTime(currentTime) : formatAudioTime(duration)}</span>{pending && <span className="rooms-voice-sending">Sending…</span>}</div>
    </div>
    <span className="rooms-voice-mic"><Mic size={13} /></span>
  </div>;
}

export default function RoomsPage() {
  const [people, setPeople] = useState<RoomPerson[]>([]);
  const [conversationMenuFor, setConversationMenuFor] = useState<string | null>(null);
  const [pinnedConversationIds, setPinnedConversationIds] = useState<string[]>([]);
  const [activeId, setActiveId] = useState("");
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [conversationCalls, setConversationCalls] = useState<RoomCall[]>([]);
  const [draft, setDraft] = useState("");
  const [replyingTo, setReplyingTo] = useState<RoomMessage | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const alertJumpHandledRef = useRef("");
  const [actionMenuFor, setActionMenuFor] = useState<string | null>(null);
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmScope, setDeleteConfirmScope] = useState<"me" | "everyone">("everyone");
  const [deletingMessage, setDeletingMessage] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editMessageDraft, setEditMessageDraft] = useState("");
  const [savingMessageEdit, setSavingMessageEdit] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [liveSocket, setLiveSocket] = useState<Socket | null>(null);
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
  const [emojiPanelOpen, setEmojiPanelOpen] = useState(false);
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
  const roomsMessageListRef = useRef<HTMLDivElement | null>(null);
  const replyHighlightTimerRef = useRef<number | null>(null);
  const scrollOnOpenRef = useRef(false);
  const draftInputRef = useRef<HTMLTextAreaElement | null>(null);
  const activeIdRef = useRef(activeId);
  const currentUserIdRef = useRef(currentUserId);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const roomsPageActiveRef = useRef(true);
  useEffect(() => {
    roomsPageActiveRef.current = true;
    return () => { roomsPageActiveRef.current = false; };
  }, []);

  function releaseBackgroundRoomSocketIfNeeded() {
    if (roomsPageActiveRef.current) return;
    const socket = socketRef.current;
    if (!socket) return;
    socket.removeAllListeners();
    socket.disconnect();
    socketRef.current = null;
  }
  const retryClientIdsRef = useRef<{ text?: string; images: string[] }>({ images: [] });
  const typingRecipientRef = useRef("");
  const typingStopTimerRef = useRef<number | null>(null);
  const otherTypingTimerRef = useRef<number | null>(null);
  const messagePressTimerRef = useRef<number | null>(null);
  const messageSwipeRef = useRef<{ id: string; startX: number; startY: number; startLeft: number; triggered: boolean } | null>(null);
  const [swipingMessageId, setSwipingMessageId] = useState<string | null>(null);
  const [messageSwipeOffset, setMessageSwipeOffset] = useState(0);
  const activePerson = useMemo(() => people.find(person => person.id === activeId) || null, [people, activeId]);
  const visiblePeople = useMemo(() => [...people].sort((a, b) => {
    const aPinned = pinnedConversationIds.includes(a.id);
    const bPinned = pinnedConversationIds.includes(b.id);
    return aPinned === bPinned ? 0 : aPinned ? -1 : 1;
  }), [people, pinnedConversationIds]);

  useEffect(() => {
    if (!currentUserId) { setPinnedConversationIds([]); return; }
    try {
      const saved = localStorage.getItem("hallschat_pinned_conversations:" + currentUserId);
      const parsed: unknown = saved ? JSON.parse(saved) : [];
      setPinnedConversationIds(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
    } catch { setPinnedConversationIds([]); }
  }, [currentUserId]);

  function togglePinnedConversation(personId: string) {
    if (!currentUserId) { setError("Your account is still loading. Please try again."); return; }
    setPinnedConversationIds(current => {
      const next = current.includes(personId) ? current.filter(id => id !== personId) : [personId, ...current];
      try { localStorage.setItem("hallschat_pinned_conversations:" + currentUserId, JSON.stringify(next)); } catch { setError("Pinned conversations couldn't be saved on this device."); }
      return next;
    });
    setConversationMenuFor(null);
  }
  activeIdRef.current = activeId;
  currentUserIdRef.current = currentUserId;

  const token = () => localStorage.getItem("hallschat_token");

  async function persistRoomMessage(
    recipientId: string,
    savedToken: string,
    input: { text?: string; images?: string[]; audioUrl?: string; replyToId?: string; clientMessageId?: string }
  ): Promise<RoomMessage> {
    const response = await fetch(`${apiBase}/api/chat/${encodeURIComponent(recipientId)}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${savedToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
    const payload = await response.json().catch(() => ({}));
    if (response.status === 401) {
      localStorage.removeItem("hallschat_token");
      navigate("/signin", { replace: true });
      throw new Error("Please sign in again.");
    }
    const saved = payload?.message;
    if (!response.ok || !saved || typeof saved !== "object" || !saved.id) {
      throw new Error(typeof saved === "string" ? saved : (payload?.message?.message || payload?.message || "Your message couldn't be saved."));
    }
    return {
      ...saved,
      id: String(saved.id),
      senderId: String(saved.senderId || currentUserIdRef.current),
      recipientId: String(saved.recipientId || recipientId),
      text: typeof saved.text === "string" ? saved.text : "",
      images: Array.isArray(saved.images) ? saved.images : (saved.imageUrl ? [saved.imageUrl] : []),
      reactions: Array.isArray(saved.reactions) ? saved.reactions : [],
      createdAt: saved.createdAt || new Date().toISOString()
    } as RoomMessage;
  }
  async function deleteConversationForMe(personId: string, personName: string) {
    if (!currentUserId) {
      setError("Your account is still loading. Please try again.");
      return;
    }
    const savedToken = token();
    if (!savedToken) {
      navigate("/signin", { replace: true });
      return;
    }
    try {
      const response = await fetch(`${apiBase}/api/chat/conversations/${encodeURIComponent(personId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${savedToken}` }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "That conversation couldn't be deleted.");
      setPeople(current => current.filter(person => person.id !== personId));
      setConversationMenuFor(null);
      if (activeIdRef.current === personId) {
        stopTyping(personId);
        setOtherTyping(false);
        setMobileConversationOpen(false);
        setActiveId("");
        setMessages([]);
        setConversationCalls([]);
        setHistoryLoadedFor("");
      }
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : `Couldn't delete the conversation with ${personName}.`);
    }
  }

  function messagePreview(message: Pick<RoomMessage, "text" | "images" | "imageUrl" | "audioUrl" | "deletedForEveryone">) {
    if (message.deletedForEveryone) return "This message was deleted";
    if (message.text?.trim()) return message.text;
    if (message.audioUrl) return "🎤 Voice note";
    if (message.images?.length || message.imageUrl) return "📷 Photo";
    return "Message";
  }
  function jumpToRepliedMessage(messageId: string) {
    const list = roomsMessageListRef.current;
    const target = document.getElementById(`rooms-message-${messageId}`);
    if (!list || !target || !list.contains(target)) return;

    // Scroll only the message-list container; scrollIntoView can move the whole page.
    const listRect = list.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const top = list.scrollTop + targetRect.top - listRect.top - (list.clientHeight - targetRect.height) / 2;
    list.scrollTo({ top: Math.max(0, top), behavior: "smooth" });

    if (replyHighlightTimerRef.current !== null) window.clearTimeout(replyHighlightTimerRef.current);
    setHighlightedMessageId(messageId);
    replyHighlightTimerRef.current = window.setTimeout(() => {
      setHighlightedMessageId(current => current === messageId ? null : current);
      replyHighlightTimerRef.current = null;
    }, 1900);
  }

  useEffect(() => () => {
    if (replyHighlightTimerRef.current !== null) window.clearTimeout(replyHighlightTimerRef.current);
  }, []);

  useEffect(() => {
    const closePopoutsOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        setReactionPickerFor(null);
        setActionMenuFor(null);
        setAttachmentMenuOpen(false);
        return;
      }
      if (!target.closest(".rooms-reaction-picker")) setReactionPickerFor(null);
      if (!target.closest(".rooms-message-actions, .rooms-message-more")) setActionMenuFor(null);
      if (!target.closest(".rooms-message-delete-wrap")) setDeleteConfirmId(null);
      if (!target.closest(".rooms-attachment-menu, .rooms-attachment-wrap, .rooms-emoji-panel")) { setAttachmentMenuOpen(false); setEmojiPanelOpen(false); }
      if (!target.closest(".rooms-conversation-menu-anchor, .rooms-person-row")) setConversationMenuFor(null);
    };
    document.addEventListener("pointerdown", closePopoutsOutside);
    return () => document.removeEventListener("pointerdown", closePopoutsOutside);
  }, []);

  function beginReply(message: RoomMessage) {
    setReplyingTo(message); setActionMenuFor(null);
    window.setTimeout(() => draftInputRef.current?.focus(), 0);
  }
  function cancelMessagePress() {
    if (messagePressTimerRef.current !== null) window.clearTimeout(messagePressTimerRef.current);
    messagePressTimerRef.current = null;
  }
  function reactToMessage(message: RoomMessage, emoji: string) {
    if (message.pending || message.deletedForEveryone) return;
    const socket = socketRef.current;
    if (!socket?.connected) { setError("Reconnect to Rooms before reacting."); return; }
    setReactionPickerFor(null);
    socket.timeout(10000).emit("chat:react", { messageId: message.id, emoji }, (timeoutError: Error | null, response: { ok?: boolean; message?: string; reactions?: RoomReaction[] }) => {
      if (timeoutError || !response?.ok) {
        setError(response?.message || "That reaction couldn't be saved. Please try again.");
        return;
      }
      if (Array.isArray(response.reactions)) {
        setMessages(current => current.map(item => item.id === message.id ? { ...item, reactions: response.reactions } : item));
      }
    });
  }
  function beginEditMessage(message: RoomMessage) {
    if (message.senderId !== currentUserId || message.pending || message.deletedForEveryone || !message.text.trim() || message.images?.length || message.imageUrl || message.audioUrl || Date.now() - new Date(message.createdAt).getTime() > 24 * 60 * 60 * 1000) return;
    setEditingMessageId(message.id);
    setEditMessageDraft(message.text);
    setActionMenuFor(null);
    setError("");
  }

  async function saveMessageEdit(message: RoomMessage) {
    if (savingMessageEdit || editingMessageId !== message.id) return;
    const text = editMessageDraft.trim();
    if (!text) { setError("A message cannot be empty."); return; }
    if (text === message.text.trim()) { setEditingMessageId(null); setEditMessageDraft(""); return; }
    const savedToken = token();
    if (!savedToken) { navigate("/signin", { replace: true }); return; }
    setSavingMessageEdit(true);
    setError("");
    try {
      const response = await fetch(`${apiBase}/api/chat/messages/${encodeURIComponent(message.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${savedToken}` },
        body: JSON.stringify({ text })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.message) throw new Error(payload.message?.message || payload.message || "That message couldn't be edited.");
      const edited = payload.message as { id: string; text: string; editedAt?: string | null };
      setMessages(current => current.map(item => {
        if (item.id === message.id) return { ...item, text: edited.text, editedAt: edited.editedAt || new Date().toISOString() };
        if (item.replyTo?.id === message.id) return { ...item, replyTo: { ...item.replyTo, text: edited.text } };
        return item;
      }));
      setReplyingTo(current => current?.id === message.id ? { ...current, text: edited.text, editedAt: edited.editedAt || new Date().toISOString() } : current);
      setPeople(current => current.map(person => person.id === message.recipientId || person.id === message.senderId
        ? { ...person, lastMessage: edited.text }
        : person));
      setEditingMessageId(null);
      setEditMessageDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That message couldn't be edited.");
    } finally {
      setSavingMessageEdit(false);
    }
  }

  async function deleteMessage(scope: "me" | "everyone") {
    if (!deleteConfirmId || deletingMessage) return;
    const messageId = deleteConfirmId, savedToken = token();
    if (!savedToken) { navigate("/signin", { replace: true }); return; }
    setDeletingMessage(true);
    try {
      const response = await fetch(`${apiBase}/api/chat/messages/${encodeURIComponent(messageId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${savedToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ scope })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "That message couldn't be deleted.");
      if (scope === "me") {
        setMessages(current => current.filter(message => message.id !== messageId));
        setReplyingTo(current => current?.id === messageId ? null : current);
        setError("");
      } else {
        setMessages(current => current.map(message => {
          if (message.id === messageId) {
            return { ...message, text: "", imageUrl: "", images: [], audioUrl: "", deletedForEveryone: true };
          }
          const replyTo = message.replyTo;
          if (replyTo && replyTo.id === messageId) {
            return { ...message, replyTo: { ...replyTo, text: "", imageUrl: "", audioUrl: "", deleted: true } };
          }
          return message;
        }));
        setPeople(current => current.map(person => person.id === activeIdRef.current ? { ...person, lastMessage: "This message was deleted" } : person));
      }
      setDeleteConfirmId(null);
      setActionMenuFor(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That message couldn't be deleted.");
    } finally {
      setDeletingMessage(false);
    }
  }

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


  useEffect(() => {
    if (!activeId) { setConversationCalls([]); return; }
    let cancelled = false;
    const loadConversationCalls = async () => {
      const savedToken = localStorage.getItem("hallschat_token");
      if (!savedToken) return;
      try {
        const response = await fetch(`${apiBase}/api/calls/history`, { headers: { Authorization: `Bearer ${savedToken}` } });
        if (!response.ok) return;
        const payload = await response.json().catch(() => ({}));
        if (cancelled) return;
        const calls = Array.isArray(payload.calls) ? payload.calls as RoomCall[] : [];
        setConversationCalls(calls.filter(call => call.person?.id === activeId).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
      } catch {
        // Keep Rooms usable if call history temporarily cannot be fetched.
      }
    };
    void loadConversationCalls();
    const refresh = window.setInterval(() => { void loadConversationCalls(); }, 5000);
    return () => { cancelled = true; window.clearInterval(refresh); };
  }, [activeId]);

  const loadPeople = useCallback(async (showLoader = false) => {
    const savedToken = localStorage.getItem("hallschat_token");
    if (!savedToken) { navigate("/signin", { replace: true }); return; }
    if (showLoader) setListLoading(true);
    try {
      const response = await fetch(`${apiBase}/api/chat/people`, { headers: { Authorization: `Bearer ${savedToken}` } });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) { localStorage.removeItem("hallschat_token"); navigate("/signin", { replace: true }); return; }
      if (!response.ok) throw new Error(payload.message || "Unable to load Rooms.");
      const nextPeople = Array.isArray(payload.people) ? payload.people as RoomPerson[] : [];
      setPeople(nextPeople);
      const requestedUserId = new URLSearchParams(window.location.search).get("user");
      const requestedPerson = requestedUserId ? nextPeople.find(person => person.id === requestedUserId && person.canMessage) : undefined;
      if (requestedPerson) {
        setActiveId(requestedPerson.id);
        setMobileConversationOpen(true);
      } else {
        setActiveId(current => current && nextPeople.some(person => person.id === current) ? current : "");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load Rooms.");
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
    return () => { cancelled = true; };
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
    setLiveSocket(socket);
    let hasConnected = false;
    socket.on("connect", () => {
      if (hasConnected) {
        void loadPeople(false);
        const openConversationId = activeIdRef.current;
        if (openConversationId) {
          void loadMessages(openConversationId, false);
          socket.emit("chat:read", { senderId: openConversationId });
        }
      } else if (activeIdRef.current) {
        socket.emit("chat:read", { senderId: activeIdRef.current });
      }
      hasConnected = true;
    });
    socket.on("presence:update", (payload: { userId?: string; isOnline?: boolean; activeStatusHidden?: boolean }) => {
      if (!payload?.userId) return;
      if (payload.activeStatusHidden === true) {
        setPeople(current => current.map(person => person.id === payload.userId ? { ...person, activeStatusHidden: true, isOnline: undefined } : person));
        return;
      }
      if (typeof payload.isOnline === "boolean") setPeople(current => current.map(person => person.id === payload.userId ? { ...person, activeStatusHidden: false, isOnline: payload.isOnline } : person));
    });
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
    socket.on("chat:read", (payload: { readerId?: string; senderId?: string; readAt?: string }) => {
      if (!payload?.readerId || !payload.senderId || !payload.readAt) return;
      setMessages(current => current.map(message => message.senderId === currentUserIdRef.current && message.recipientId === payload.readerId && payload.senderId === currentUserIdRef.current ? { ...message, readAt: payload.readAt } : message));
    });
    socket.on("chat:reaction", (payload: { id?: string; reactions?: RoomReaction[] }) => {
      if (!payload?.id || !Array.isArray(payload.reactions)) return;
      setMessages(current => current.map(message => message.id === payload.id ? { ...message, reactions: payload.reactions } : message));
    });
    socket.on("chat:edited", (payload: { id?: string; text?: string; editedAt?: string | null }) => {
      if (!payload?.id || typeof payload.text !== "string") return;
      setMessages(current => current.map(message => {
        if (message.id === payload.id) return { ...message, text: payload.text!, editedAt: payload.editedAt || new Date().toISOString() };
        if (message.replyTo && message.replyTo.id === payload.id) return { ...message, replyTo: { ...message.replyTo, text: payload.text! } };
        return message;
      }));
      setReplyingTo(current => current && current.id === payload.id ? { ...current, text: payload.text!, editedAt: payload.editedAt || new Date().toISOString() } : current);
    });
    socket.on("chat:deleted-for-me", (payload: { id?: string; userId?: string }) => {
      if (!payload?.id || (payload.userId && payload.userId !== currentUserIdRef.current)) return;
      setMessages(current => current.filter(message => message.id !== payload.id));
      setReplyingTo(current => current?.id === payload.id ? null : current);
      setDeleteConfirmId(current => current === payload.id ? null : current);
    });
    socket.on("chat:deleted", (payload: { id?: string }) => {
      if (!payload?.id) return;
      setMessages(current => current.map(message => {
        if (message.id === payload.id) {
          return { ...message, text: "", imageUrl: "", images: [], audioUrl: "", deletedForEveryone: true };
        }
        const replyTo = message.replyTo;
        if (replyTo && replyTo.id === payload.id) {
          return { ...message, replyTo: { ...replyTo, text: "", imageUrl: "", audioUrl: "", deleted: true } };
        }
        return message;
      }));
    });
    socket.on("chat:message", (message: RoomMessage) => {
      const me = currentUserIdRef.current;
      const openId = activeIdRef.current;
      const belongsToOpenConversation =
        (message.senderId === me && message.recipientId === openId) ||
        (message.senderId === openId && message.recipientId === me);
      if (belongsToOpenConversation) {
        if (message.senderId !== me && socket.connected) socket.emit("chat:read", { senderId: message.senderId });
        setMessages(current => {
          if (current.some(item => item.id === message.id)) return current;
          // Reconcile the server echo with the optimistic message already shown in Rooms.
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
      const sendStillRunning = hasActiveBackgroundTask("Sending message") || hasActiveBackgroundTask("Sending voice note");
      if (sendStillRunning) return;
      socket.removeAllListeners();
      socket.disconnect();
      setLiveSocket(null);
      if (socketRef.current === socket) socketRef.current = null;
    };
  // loadMessages is a stable useCallback declared below; omit it here to avoid
  // evaluating its lexical binding before initialization during render.
  }, [currentUserId, loadPeople]);

  useEffect(() => {
    setOtherTyping(false);
    setReplyingTo(null);
    setActionMenuFor(null);
    setDeleteConfirmId(null);
    setReactionPickerFor(null);
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
      const history = Array.isArray(payload.messages) ? payload.messages as RoomMessage[] : [];
      if (socketRef.current?.connected && history.some(message => message.senderId === personId && !message.readAt)) socketRef.current.emit("chat:read", { senderId: personId });
      // Keep only this conversation's live/optimistic items when history returns.
      // Otherwise, messages from the previously opened Room can leak into this thread.
      setMessages(current => {
        const me = currentUserIdRef.current;
        const threadCurrent = current.filter(message =>
          (String(message.senderId) === personId && (!me || String(message.recipientId) === me)) ||
          (String(message.recipientId) === personId && (!me || String(message.senderId) === me || Boolean(message.pending)))
        );
        const byId = new Map<string, RoomMessage>();
        [...history, ...threadCurrent].forEach(message => byId.set(String(message.id), message));
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
    // Never leave the previous conversation's rows visible while this thread loads.
    setMessages([]);
    // Fetch history once when a conversation opens; new messages arrive over Socket.IO.
    void loadMessages(activeId, true);
  }, [activeId, loadMessages]);



  useEffect(() => {
    if (!activeId || messagesLoading || historyLoadedFor !== activeId) return;
    // Keep the newest sent or received message visible without scrolling the page itself.
    const frame = window.requestAnimationFrame(() => {
      const list = roomsMessageListRef.current;
      if (list) list.scrollTop = list.scrollHeight;
      scrollOnOpenRef.current = false;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeId, messages, messagesLoading, historyLoadedFor]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedUserId = params.get("user") || "";
    const requestedMessageId = params.get("message") || "";
    const jumpKey = requestedUserId + ":" + requestedMessageId;
    if (!requestedUserId || !requestedMessageId || activeId !== requestedUserId ||
        messagesLoading || historyLoadedFor !== activeId ||
        !messages.some(message => message.id === requestedMessageId) ||
        alertJumpHandledRef.current === jumpKey) return;

    // Reuse the same contained-scroll and temporary highlight used by reply quotes.
    alertJumpHandledRef.current = jumpKey;
    const frame = window.requestAnimationFrame(() => jumpToRepliedMessage(requestedMessageId));
    return () => window.cancelAnimationFrame(frame);
  }, [activeId, messages, messagesLoading, historyLoadedFor]);

  useEffect(() => {
    const input = draftInputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 144)}px`;
  }, [draft]);


  async function uploadRoomImage(file: File, savedToken: string): Promise<string> {
    const authResponse = await fetch(`${apiBase}/api/media/imagekit-auth`, { headers: { Authorization: `Bearer ${savedToken}` } });
    const auth = await authResponse.json().catch(() => ({}));
    if (authResponse.status === 401) { localStorage.removeItem("hallschat_token"); navigate("/signin", { replace: true }); throw new Error("Please sign in again."); }
    if (!authResponse.ok) throw new Error(auth.message || "Image uploads are not configured yet.");
    const form = new FormData();
    form.append("file", file);
    form.append("fileName", `hallsrooms-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`);
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
      const compressed = await Promise.all(picked.map(compressRoomImage));
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
    const pending: RoomMessage = { id: pendingId, senderId: currentUserIdRef.current, recipientId: person.id, text: "", audioUrl: previewUrl, createdAt: new Date().toISOString(), pending: true };
    setMessages(current => [...current, pending]);
    const backgroundTaskId = startBackgroundTask("Sending voice note", "Uploading voice note…");
    // Clear the composer immediately; the rooms-list pending bubble now owns the sending preview.
    setVoiceDraft(null);
    setVoiceDraftUrl("");
    setRecordingSeconds(0);
    try {
      updateBackgroundTask(backgroundTaskId, "Uploading voice note…");
      const audioUrl = await uploadRoomImage(file, savedToken);
      updateBackgroundTask(backgroundTaskId, "Sending voice note…");
      const replyTarget = replyingTo;
      const sent = await persistRoomMessage(person.id, savedToken, {
        text: "",
        images: [],
        audioUrl,
        ...(replyTarget ? { replyToId: replyTarget.id } : {})
      });
      setMessages(current => [...current.filter(item => item.id !== pendingId && item.id !== sent.id), sent].sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
      setPeople(current => current.map(item => item.id === person.id ? { ...item, lastMessage: "🎤 Voice note", lastMessageAt: sent.createdAt } : item));
      setReplyingTo(null);
      URL.revokeObjectURL(previewUrl);
      setVoiceDraft(null);
      setVoiceDraftUrl("");
      setRecordingSeconds(0);
      finishBackgroundTask(backgroundTaskId);
      releaseBackgroundRoomSocketIfNeeded();
    } catch (err) {
      setMessages(current => current.filter(item => item.id !== pendingId));
      // If sending fails, put the recording back so the user can retry it.
      setVoiceDraft(file);
      setVoiceDraftUrl(previewUrl);
      const voiceError = err instanceof Error ? err.message : "Your voice note couldn't be sent.";
      setError(voiceError);
      finishBackgroundTask(backgroundTaskId, voiceError);
      releaseBackgroundRoomSocketIfNeeded();
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
    const replyTarget = replyingTo;
    const replySnapshot: RoomReply | null = replyTarget ? { id: replyTarget.id, senderId: replyTarget.senderId, text: replyTarget.text, imageUrl: replyTarget.images?.[0] || replyTarget.imageUrl, audioUrl: replyTarget.audioUrl, deleted: Boolean(replyTarget.deletedForEveryone) } : null;
    const now = new Date().toISOString();
    const pendingItems: RoomMessage[] = [
      ...(text ? [{
        id: `pending-text-${Date.now()}`,
        senderId: currentUserId,
        recipientId,
        text,
        replyTo: replySnapshot,
        createdAt: now,
        pending: true
      } as RoomMessage] : []),
      ...imagePreviews.map((url, index) => ({
        id: `pending-image-${Date.now()}-${index}`,
        senderId: currentUserId,
        recipientId,
        text: "",
        imageUrl: url,
        replyTo: !text && index === 0 ? replySnapshot : null,
        createdAt: new Date(Date.now() + index).toISOString(),
        pending: true
      } as RoomMessage))
    ];
    const pendingIds = pendingItems.map(item => item.id);
    const filesToSend = [...imageFiles];
    const previewsToRelease = [...imagePreviews];
    const textClientMessageId = text ? (retryClientIdsRef.current.text || pendingIds[0]) : undefined;
    const imageClientMessageIds = filesToSend.map((_, index) => retryClientIdsRef.current.images[index] || pendingIds[(text ? 1 : 0) + index]);

    // Show the messages in the conversation immediately, before image upload/network sending.
    setMessages(current => [...current, ...pendingItems]);
    const backgroundTaskId = startBackgroundTask("Sending message", filesToSend.length ? "Preparing message attachments…" : "Sending message…");
    setDraft("");
    setReplyingTo(null);
    setImageFiles([]);
    setImagePreviews([]);
    setError("");

    const images: string[] = [];
    const sentMessages: RoomMessage[] = [];
    try {
      for (const [index, file] of filesToSend.entries()) {
        updateBackgroundTask(backgroundTaskId, `Uploading attachment ${index + 1} of ${filesToSend.length}…`);
        images.push(await uploadRoomImage(file, savedToken));
      }
      updateBackgroundTask(backgroundTaskId, "Sending message…");
      const sendOne = (messageText: string, imageUrl?: string, includeReply = false, clientMessageId?: string) =>
        persistRoomMessage(recipientId, savedToken, {
          text: messageText,
          images: imageUrl ? [imageUrl] : [],
          ...(includeReply && replyTarget ? { replyToId: replyTarget.id } : {}),
          ...(clientMessageId ? { clientMessageId } : {})
        });

      let pendingIndex = 0;
      if (text) {
        const sent = await sendOne(text, undefined, true, textClientMessageId);
        sentMessages.push(sent);
        retryClientIdsRef.current.text = undefined;
        const pendingId = pendingIds[pendingIndex++];
        setMessages(current => {
          const withoutPending = current.filter(message => message.id !== pendingId && message.id !== sent.id);
          return [...withoutPending, sent].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        });
      }
      for (const [imageIndex, imageUrl] of images.entries()) {
        const sent = await sendOne("", imageUrl, !text && imageIndex === 0, imageClientMessageIds[imageIndex]);
        sentMessages.push(sent);
        retryClientIdsRef.current.images[imageIndex] = "";
        const pendingId = pendingIds[pendingIndex++];
        setMessages(current => {
          const withoutPending = current.filter(message => message.id !== pendingId && message.id !== sent.id);
          return [...withoutPending, sent].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        });
      }
      previewsToRelease.forEach(url => URL.revokeObjectURL(url));
      retryClientIdsRef.current = { images: [] };
      const lastSent = sentMessages[sentMessages.length - 1];
      if (lastSent) setPeople(current => current.map(person => person.id === recipientId ? { ...person, lastMessage: lastSent.text || ((lastSent.images?.length || lastSent.imageUrl) ? "📷 Photo" : ""), lastMessageAt: lastSent.createdAt } : person).sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime || a.name.localeCompare(b.name);
      }));
      finishBackgroundTask(backgroundTaskId);
      releaseBackgroundRoomSocketIfNeeded();
    } catch (err) {
      setMessages(current => current.filter(message => !pendingIds.includes(message.id)));
      const sentText = Boolean(text && sentMessages.some(message => message.text === text));
      const sentImageUrls = new Set(sentMessages.flatMap(message => message.images?.length ? message.images : (message.imageUrl ? [message.imageUrl] : [])));
      const failedImageIndexes = filesToSend.map((_, index) => index).filter(index => !images[index] || !sentImageUrls.has(images[index]));
      const failedFiles = failedImageIndexes.map(index => filesToSend[index]);
      const failedPreviews = failedImageIndexes.map(index => previewsToRelease[index]);
      retryClientIdsRef.current.text = text && !sentText ? textClientMessageId : undefined;
      retryClientIdsRef.current.images = failedImageIndexes.map(index => imageClientMessageIds[index]);
      previewsToRelease.forEach((url, index) => { if (!failedImageIndexes.includes(index)) URL.revokeObjectURL(url); });
      setDraft(sentText ? "" : text);
      setImageFiles(failedFiles);
      setImagePreviews(failedPreviews);
      if ((text && !sentText) || (!text && sentMessages.length === 0)) setReplyingTo(replyTarget);
      const messageError = err instanceof Error ? err.message : "Your message couldn't be sent.";
      setError(`${messageError} Your unsent text and attachments have been restored so you can retry.`);
      finishBackgroundTask(backgroundTaskId, messageError);
      releaseBackgroundRoomSocketIfNeeded();
    } finally {
    }
  }

  return <main className={`home-page social-home rooms-page ${activePerson && mobileConversationOpen ? "rooms-page-conversation-open" : ""}`}>
    <AppHeader homeHref="/home" />
    <section className="home-shell social-shell rooms-shell theme-token-scope">
      <div className={`rooms-layout ${activePerson && mobileConversationOpen ? "rooms-layout-conversation-open" : ""}`}>
        <aside className="rooms-sidebar" aria-label="Your conversations">
          <div className="rooms-sidebar-heading"><strong>Rooms</strong></div>
          {listLoading ? <div className="rooms-list-state"><LoadingDots /></div> : visiblePeople.length ? <div className="rooms-people-list">
            {visiblePeople.map(person => <article key={person.id} className={`rooms-person-row ${activeId === person.id ? "rooms-person-row-active" : ""} ${conversationMenuFor === person.id ? "rooms-person-row-menu-open" : ""}`} onClick={() => setConversationMenuFor(current => current === person.id ? null : person.id)}>
              <button type="button" className="rooms-person-avatar-link" onClick={event => { event.stopPropagation(); navigate("/users/" + encodeURIComponent(person.id)); }} aria-label={"View " + person.name + " profile"}><Avatar person={person} /></button>
              <div className="rooms-person-copy" aria-label={`Conversation details for ${person.name}`}>
                <strong style={{ display: "inline-flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>{person.name}{person.isVerified && person.verifiedAt && <VerificationBadge size={13} />}{pinnedConversationIds.includes(person.id) && <Pin size={12} className="rooms-pinned-indicator" aria-label="Pinned conversation" />}</strong><small>@{person.username} · {person.activeStatusHidden ? "Recent" : person.isOnline ? "Online" : "Offline"}</small><span className="rooms-last-message">{person.canMessage ? (person.lastMessage || "Start a conversation") : (person.lastMessage || "No longer follows you")}</span>
              </div>
              <span className="rooms-person-meta">{formatTime(person.lastMessageAt)}{!person.canMessage && <span className="rooms-lock-dot" title="Messaging unavailable">•</span>}</span>
              <button type="button" className="rooms-open-button" onClick={event => { event.stopPropagation(); setConversationMenuFor(null); scrollOnOpenRef.current = true; setActiveId(person.id); setMobileConversationOpen(true); setError(""); }} aria-label={`Open conversation with ${person.name}`} title="Open Room"><MessageCircle size={18} /></button>
              {conversationMenuFor === person.id && <div className="rooms-conversation-menu-anchor" onClick={event => event.stopPropagation()}><div className="rooms-conversation-delete-popout" role="menu" aria-label={`Conversation options for ${person.name}`}><button type="button" role="menuitem" onClick={() => togglePinnedConversation(person.id)}>{pinnedConversationIds.includes(person.id) ? <PinOff size={15} /> : <Pin size={15} />}{pinnedConversationIds.includes(person.id) ? "Unpin conversation" : "Pin conversation"}</button><button type="button" role="menuitem" onClick={() => deleteConversationForMe(person.id, person.name)}><Trash2 size={15} />Delete conversation</button></div></div>}
            </article>)}
          </div> : <div className="rooms-list-empty"><UsersRound size={24} /><strong>{people.length ? "No conversations here" : "No followers yet"}</strong><p>{people.length ? "Your message list is clear. New conversations will appear here." : "When someone follows you, you can start a conversation with them here."}</p></div>}
        </aside>

        <section className="rooms-conversation" aria-label="Conversation">
          {activePerson ? <>
            <header className="rooms-conversation-header">
              <button className="rooms-back-button" type="button" onClick={() => { stopTyping(); setOtherTyping(false); setMobileConversationOpen(false); setActiveId(""); }} aria-label="Back to Rooms"><ArrowLeft size={19} /></button>
              <button type="button" onClick={() => navigate("/users/" + encodeURIComponent(activePerson.id))} aria-label={"View " + activePerson.name + " profile"} style={{ padding: 0, border: 0, background: "transparent", borderRadius: "50%", flexShrink: 0 }}><Avatar person={activePerson} size="large" /></button>
              <button type="button" className="rooms-conversation-person" onClick={() => navigate("/users/" + encodeURIComponent(activePerson.id))} style={{ minWidth: 0, padding: 0, border: 0, background: "transparent", color: "inherit", textAlign: "left", cursor: "pointer" }} aria-label={"View " + activePerson.name + " profile"}><strong style={{ display: "inline-flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>{activePerson.name}{activePerson.isVerified && activePerson.verifiedAt && <VerificationBadge size={14} />}</strong><span className={otherTyping ? "rooms-typing-label" : ""}>{otherTyping ? "Typing…" : "@" + activePerson.username}</span></button>
              <span className={`rooms-access-pill ${activePerson.activeStatusHidden ? "rooms-status-offline" : activePerson.isOnline ? "rooms-status-online" : "rooms-status-offline"}`} aria-label={activePerson.activeStatusHidden ? "Recent" : activePerson.isOnline ? "Online" : "Offline"}>{activePerson.activeStatusHidden ? "Recent" : activePerson.isOnline ? "Online" : "Offline"}</span>
              <CallsPanel socket={liveSocket} person={activePerson} enableIncoming={false} />
            </header>
            <div className="rooms-message-list" ref={roomsMessageListRef}>
              {messagesLoading ? <div className="rooms-message-loading"><LoadingDots /></div> : (messages.length || conversationCalls.length) ? <>{messages.map((message, messageIndex) => {
                const previousMessageTime = messageIndex > 0 ? new Date(messages[messageIndex - 1].createdAt).getTime() : -Infinity;
                const messageTime = new Date(message.createdAt).getTime();
                const callsBeforeMessage = conversationCalls.filter(call => {
                  const callTime = new Date(call.createdAt).getTime();
                  return Number.isFinite(callTime) && callTime > previousMessageTime && callTime <= messageTime;
                });
                const renderCall = (call: RoomCall) => {
                  const missed = call.status === "missed";
                  const declined = call.status === "declined";
                  const failed = call.status === "failed";
                  const outgoing = call.direction === "outgoing";
                  const statusText = missed ? (outgoing ? "No answer" : "Missed call") : declined ? (outgoing ? "Call declined" : "Declined call") : failed ? "Call failed" : call.status === "cancelled" ? "Call cancelled" : call.status === "completed" ? "Call ended" : "Call";
                  const duration = call.durationSeconds > 0 ? ` · ${Math.floor(call.durationSeconds / 60)}:${String(call.durationSeconds % 60).padStart(2, "0")}` : "";
                  return <div className={`rooms-message-line ${outgoing ? "rooms-message-line-mine" : ""}`} key={`call-${call.id}`}>
                    <div className={`rooms-message-content ${outgoing ? "rooms-message-content-mine" : "rooms-message-content-theirs"} rooms-call-bubble${missed || failed ? " rooms-call-bubble-alert" : ""}`}>
                      <div className="rooms-call-body">
                        <span className="rooms-call-icon">{call.kind === "video" ? <Video size={19} /> : <Phone size={19} />}</span>
                        <div className="rooms-call-copy">
                          <strong>{call.kind === "video" ? "Video call" : "Audio call"}</strong>
                          <span className={missed || failed ? "rooms-call-status-alert" : ""}>{statusText}{duration}</span>
                        </div>
                      </div>
                      <div className="rooms-message-footer"><time>{new Date(call.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time></div>
                    </div>
                  </div>;
                };
                return <Fragment key={message.id}>{callsBeforeMessage.map(renderCall)} {(() => {
                const mine = message.senderId === currentUserId;
                const quotedMessage = message.replyTo;
                const messageImages = message.images?.length ? message.images : message.imageUrl ? [message.imageUrl] : [];
                return <div id={`rooms-message-${message.id}`} key={message.id} className={`rooms-message-line ${mine ? "rooms-message-line-mine" : ""} ${highlightedMessageId === message.id ? "rooms-message-highlighted" : ""}`}
                  onContextMenu={event => { event.preventDefault(); if (!message.pending && !message.deletedForEveryone) { setReactionPickerFor(message.id); setActionMenuFor(null); } }}
                  onPointerDown={event => {
                    if (event.pointerType !== "touch" || message.pending) return;
                    cancelMessagePress();
                    messageSwipeRef.current = { id: message.id, startX: event.clientX, startY: event.clientY, startLeft: 0, triggered: false };
                    messagePressTimerRef.current = window.setTimeout(() => { setReactionPickerFor(message.id); setActionMenuFor(null); }, 520);
                  }}
                  onPointerMove={event => {
                    const swipe = messageSwipeRef.current;
                    if (event.pointerType !== "touch" || !swipe || swipe.id !== message.id) return;
                    const deltaX = event.clientX - swipe.startX;
                    const deltaY = event.clientY - swipe.startY;
                    if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) cancelMessagePress();
                    // Only claim a clear horizontal right-swipe; vertical movement remains native scrolling.
                    if (deltaX > 6 && deltaX > Math.abs(deltaY) * 1.15 && !message.deletedForEveryone) {
                      setSwipingMessageId(message.id);
                      setMessageSwipeOffset(Math.min(76, Math.max(0, deltaX)));
                    }
                    if (!swipe.triggered && deltaX > 58 && deltaX > Math.abs(deltaY) * 1.25 && !message.deletedForEveryone) {
                      swipe.triggered = true;
                      beginReply(message);
                    }
                  }}
                  onPointerUp={() => {
                    cancelMessagePress();
                    messageSwipeRef.current = null;
                    setSwipingMessageId(null);
                    setMessageSwipeOffset(0);
                  }}
                  onPointerLeave={() => {
                    cancelMessagePress();
                    messageSwipeRef.current = null;
                    setSwipingMessageId(null);
                    setMessageSwipeOffset(0);
                  }}
                  onPointerCancel={() => {
                    cancelMessagePress();
                    messageSwipeRef.current = null;
                    setSwipingMessageId(null);
                    setMessageSwipeOffset(0);
                  }}>
                  <div className={`rooms-message-content ${mine ? "rooms-message-content-mine" : "rooms-message-content-theirs"} ${message.deletedForEveryone ? "rooms-message-deleted" : ""} ${swipingMessageId === message.id ? "rooms-message-swiping" : ""}`} style={{ ...(swipingMessageId === message.id ? { transform: `translateX(${messageSwipeOffset}px)` } : {}), ...(deleteConfirmId === message.id ? { position: "relative" as const } : {}) }}>
                    {quotedMessage && <button type="button" className="rooms-reply-quote" onClick={() => jumpToRepliedMessage(quotedMessage.id)} aria-label="Jump to replied message">
                      <strong>{quotedMessage.senderId === currentUserId ? "You" : activePerson.username}</strong>
                      <span>{quotedMessage.deleted ? "This message was deleted" : quotedMessage.text || (quotedMessage.audioUrl ? "🎤 Voice note" : quotedMessage.imageUrl ? "📷 Photo" : "Message")}</span>
                    </button>}
                    {message.deletedForEveryone ? <p className="rooms-message-deleted-text"><Trash2 size={14} /> This message was deleted</p> : <div className="rooms-message-body">
                      {messageImages.length > 0 && <div className={`rooms-image-grid ${messageImages.length === 1 ? "rooms-image-grid-single" : ""}`}>{messageImages.map((url, index) => <button key={`${url}-${index}`} type="button" className="rooms-image-bubble" onClick={() => setViewingImageUrl(url)} aria-label={`View image ${index + 1}`}><img src={url} alt={message.text || `Shared image ${index + 1}`} loading="lazy" /></button>)}</div>}
                      {message.audioUrl && <VoiceNotePlayer src={message.audioUrl} pending={Boolean(message.pending)} />}
                      {message.text && (editingMessageId === message.id ? <form onSubmit={event => { event.preventDefault(); void saveMessageEdit(message); }} onClick={event => event.stopPropagation()} style={{ display: "grid", gap: 8, minWidth: 0, margin: "3px 0" }}><textarea value={editMessageDraft} onChange={event => setEditMessageDraft(event.target.value)} maxLength={4000} rows={Math.max(2, Math.min(6, editMessageDraft.split("\n").length + 1))} aria-label="Edit message" autoFocus style={{ width: "100%", minWidth: 0, boxSizing: "border-box", resize: "vertical", padding: "9px 10px", border: "1px solid var(--theme-border-strong)", borderRadius: 10, background: "var(--theme-input-bg)", color: "inherit", font: "inherit", lineHeight: 1.45 }} /><div style={{ display: "flex", justifyContent: "flex-end", gap: 7 }}><button type="button" onClick={() => { setEditingMessageId(null); setEditMessageDraft(""); }} disabled={savingMessageEdit} style={{ minHeight: 30, padding: "5px 10px", border: "1px solid var(--theme-border)", borderRadius: 8, background: "transparent", color: "inherit", fontSize: ".75rem" }}>Cancel</button><button type="submit" disabled={savingMessageEdit || !editMessageDraft.trim() || editMessageDraft.trim() === message.text.trim()} style={{ minHeight: 30, padding: "5px 10px", border: 0, borderRadius: 8, background: "var(--theme-primary)", color: "var(--theme-primary-contrast)", fontSize: ".75rem", fontWeight: 700 }}>{savingMessageEdit ? <LoadingDots /> : "Save"}</button></div></form> : <p className="rooms-message-text">{message.text}</p>)}
                    </div>}
                    <div className="rooms-message-footer"><time>{message.pending ? "Sending…" : new Date(message.createdAt).toLocaleString()}{message.editedAt && !message.pending ? " · Edited" : ""}</time>{!message.pending && message.senderId === currentUserId && <span aria-label={message.readAt ? "Seen" : "Sent"} title={message.readAt ? `Seen ${new Date(message.readAt).toLocaleString()}` : "Sent"} style={{ fontSize: ".68rem", opacity: message.readAt ? 1 : .65, whiteSpace: "nowrap" }}>{message.readAt ? "✓✓ Seen" : "✓ Sent"}</span>}
                      {!message.pending && !message.deletedForEveryone && <div className="rooms-message-delete-wrap" style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
                        <button type="button" className="rooms-message-more" aria-label="Message actions" title="Message actions" onClick={event => { event.stopPropagation(); setDeleteConfirmId(null); setActionMenuFor(current => current === message.id ? null : message.id); }}><MoreVertical size={15} /></button>
                        {deleteConfirmId === message.id && <div className="rooms-delete-popout" role="alertdialog" aria-label="Confirm delete message" onClick={event => event.stopPropagation()} style={{ position: "absolute", right: 0, bottom: "calc(100% + 8px)", zIndex: 10000, width: "min(188px, calc(100vw - 24px))", maxWidth: "calc(100vw - 24px)", boxSizing: "border-box", padding: 11, border: "1px solid var(--theme-border-strong)", borderRadius: 13, background: "var(--theme-popover-bg)", boxShadow: "var(--theme-shadow-card-soft)", color: "var(--theme-text-primary)", textAlign: "left", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
                          <div style={{ fontSize: ".76rem", fontWeight: 750, lineHeight: 1.4 }}>{deleteConfirmScope === "me" ? "Delete for me?" : "Delete for everyone?"}</div>
                          <div style={{ fontSize: ".7rem", marginTop: 4, color: "var(--theme-text-secondary)", lineHeight: 1.4 }}>{deleteConfirmScope === "me" ? "This message will disappear only for you." : "This removes the message for everyone in this conversation."}</div>
                          <div style={{ display: "flex", gap: 6, marginTop: 9 }}>
                            <button type="button" onClick={() => setDeleteConfirmId(null)} disabled={deletingMessage} style={{ flex: 1, minHeight: 29, padding: "5px 7px", border: "1px solid var(--theme-border)", borderRadius: 8, background: "var(--theme-action-secondary-bg)", color: "var(--theme-action-secondary-text)", fontSize: ".7rem" }}>Cancel</button>
                            <button type="button" onClick={() => void deleteMessage(deleteConfirmScope)} disabled={deletingMessage} style={{ flex: 1, minHeight: 29, padding: "5px 7px", border: 0, borderRadius: 8, background: "var(--theme-danger-strong)", color: "var(--theme-text-inverse)", fontSize: ".7rem", fontWeight: 750 }}>{deletingMessage ? <LoadingDots /> : "Delete"}</button>
                          </div>
                        </div>}
    
                      </div>}
                    </div>
                    {reactionPickerFor === message.id && !message.pending && !message.deletedForEveryone && <div className="rooms-reaction-picker" role="group" aria-label="React to message" onClick={event => event.stopPropagation()} style={{ display: "flex", gap: 7, padding: 7, border: "1px solid var(--theme-border)", borderRadius: 20, background: "var(--theme-popover-bg)" }}>{["❤️","😂","😮","😢","🙏","👍"].map(emoji => <button key={emoji} type="button" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); reactToMessage(message, emoji); }} aria-label={`React ${emoji}`} style={{ border: 0, background: "transparent", fontSize: 19, padding: 2, cursor: "pointer" }}>{emoji}</button>)}</div>}
                    {Array.from((message.reactions || []).reduce((groups, reaction) => groups.set(reaction.emoji, [...(groups.get(reaction.emoji) || []), reaction]), new Map<string, RoomReaction[]>()).entries()).length > 0 && <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", alignSelf: "flex-start", width: "fit-content", maxWidth: "100%", gap: 5, marginTop: 5 }}>{Array.from((message.reactions || []).reduce((groups, reaction) => groups.set(reaction.emoji, [...(groups.get(reaction.emoji) || []), reaction]), new Map<string, RoomReaction[]>()).entries()).map(([emoji, reactions]) => <button key={emoji} type="button" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); reactToMessage(message, (reactions as RoomReaction[]).some(reaction => reaction.userId === currentUserId) ? "" : emoji); }} aria-label={`${emoji}, ${(reactions as RoomReaction[]).length} reactions`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4, flex: "0 0 auto", border: "1px solid var(--theme-border-strong)", borderRadius: 15, padding: "3px 7px", background: (reactions as RoomReaction[]).some(reaction => reaction.userId === currentUserId) ? "var(--theme-accent-soft)" : "var(--theme-surface-hover)", color: "inherit", fontSize: 11, lineHeight: 1.2, cursor: "pointer" }}>{emoji} {(reactions as RoomReaction[]).length}</button>)}</div>}
                    {actionMenuFor === message.id && <div className="rooms-message-actions" role="menu">
                      <button type="button" role="menuitem" onClick={() => beginReply(message)}><Reply size={16} /><span>Reply</span></button>
                      {mine && !message.deletedForEveryone && !message.pending && message.text.trim() && !message.images?.length && !message.imageUrl && !message.audioUrl && Date.now() - new Date(message.createdAt).getTime() <= 24 * 60 * 60 * 1000 && <button type="button" role="menuitem" onClick={() => beginEditMessage(message)}><Pencil size={16} /><span>Edit message</span></button>}
                      <button type="button" role="menuitem" className="rooms-message-action-delete" onClick={() => { setActionMenuFor(null); setDeleteConfirmScope("me"); setDeleteConfirmId(message.id); }}><Trash2 size={16} /><span>Delete for me</span></button>
                      {mine && !message.deletedForEveryone && <button type="button" role="menuitem" className="rooms-message-action-delete" onClick={() => { setActionMenuFor(null); setDeleteConfirmScope("everyone"); setDeleteConfirmId(message.id); }}><Trash2 size={16} /><span>Delete for everyone</span></button>}
                    </div>}

                  </div>
                </div>; })()}</Fragment>;
              })}
                {conversationCalls.filter(call => !messages.some(message => {
                  const callTime = new Date(call.createdAt).getTime();
                  const messageTime = new Date(message.createdAt).getTime();
                  return Number.isFinite(callTime) && Number.isFinite(messageTime) && callTime <= messageTime;
                })).map(call => {
                  const missed = call.status === "missed";
                  const declined = call.status === "declined";
                  const failed = call.status === "failed";
                  const outgoing = call.direction === "outgoing";
                  const statusText = missed ? (outgoing ? "No answer" : "Missed call") : declined ? (outgoing ? "Call declined" : "Declined call") : failed ? "Call failed" : call.status === "cancelled" ? "Call cancelled" : call.status === "completed" ? "Call ended" : "Call";
                  const duration = call.durationSeconds > 0 ? ` · ${Math.floor(call.durationSeconds / 60)}:${String(call.durationSeconds % 60).padStart(2, "0")}` : "";
                  return <div className={`rooms-message-line ${outgoing ? "rooms-message-line-mine" : ""}`} key={`call-${call.id}`}>
                    <div className={`rooms-message-content ${outgoing ? "rooms-message-content-mine" : "rooms-message-content-theirs"} rooms-call-bubble${missed || failed ? " rooms-call-bubble-alert" : ""}`}>
                      <div className="rooms-call-body">
                        <span className="rooms-call-icon">{call.kind === "video" ? <Video size={19} /> : <Phone size={19} />}</span>
                        <div className="rooms-call-copy">
                          <strong>{call.kind === "video" ? "Video call" : "Audio call"}</strong>
                          <span className={missed || failed ? "rooms-call-status-alert" : ""}>{statusText}{duration}</span>
                        </div>
                      </div>
                      <div className="rooms-message-footer"><time>{new Date(call.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time></div>
                    </div>
                  </div>;
                })}
              </> : <div className="rooms-empty-conversation"><span><MessageCircle size={25} /></span><strong>Say hello</strong><p>Your messages with @{activePerson.username} will appear here.</p></div>}
              <div ref={bottomRef} />
            </div>
            {activePerson.canMessage ? <><input ref={imageInputRef} type="file" accept="image/*" multiple hidden onChange={handleImageSelection} />{(imagePreviews.length > 0 || compressingImages) && <div className="rooms-image-pending-grid">{imagePreviews.map((url, index) => <div className="rooms-image-pending" key={`${url}-${index}`}><img src={url} alt={`Image ${index + 1} ready to send`} /><button type="button" onClick={() => removeSelectedImage(index)} aria-label={`Remove image ${index + 1}`}><X size={17} /></button></div>)}<span className="rooms-image-count">{compressingImages ? "Compressing images…" : `${imageFiles.length} ${imageFiles.length === 1 ? "image" : "images"} ready`}</span></div>}{replyingTo && <div className="rooms-reply-composer"><div className="rooms-reply-composer-copy"><strong>Replying to {replyingTo.senderId === currentUserId ? "yourself" : activePerson.username}</strong><span>{messagePreview(replyingTo)}</span></div><button type="button" onClick={() => setReplyingTo(null)} aria-label="Cancel reply"><X size={17} /></button></div>}<form className="rooms-composer" onSubmit={sendMessage}>
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" hidden onChange={handleImageSelection} />
              <div className="rooms-attachment-wrap">
                <button type="button" className="rooms-attach-button" onClick={() => setAttachmentMenuOpen(value => !value)} aria-label="Open attachments" title="Attach"><Plus size={22} /></button>
                {attachmentMenuOpen && <div className="rooms-attachment-menu">
                  <button type="button" onClick={() => { setAttachmentMenuOpen(false); setEmojiPanelOpen(value => !value); }}><Smile size={19}/><span>Emoji</span></button>
                  <button type="button" onClick={() => { setAttachmentMenuOpen(false); cameraInputRef.current?.click(); }}><Camera size={19} /><span>Camera</span></button>
                  <button type="button" onClick={() => { setAttachmentMenuOpen(false); imageInputRef.current?.click(); }}><ImageIcon size={19} /><span>Gallery</span></button>
                  <button type="button" onClick={() => { setAttachmentMenuOpen(false); void recordVoiceNote(); }} disabled={voiceBusy}><Mic size={19} /><span>Voice Note</span></button>
                </div>}
              </div>
                {emojiPanelOpen && <div className="rooms-emoji-panel" role="dialog" aria-label="Emoji picker"><div className="rooms-emoji-panel-header"><strong>Emojis</strong><button type="button" aria-label="Close emoji panel" onClick={() => setEmojiPanelOpen(false)}><X size={16}/></button></div><div className="rooms-emoji-grid">{["😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","🙃","😉","😍","🥰","😘","😋","😎","🤩","🥳","😭","😢","😡","🤔","🤗","🙏","👏","🙌","👍","👎","❤️","🧡","💛","💚","💙","💜","🖤","🤍","💔","💕","💯","🔥","✨","⭐","🎉","🎊","🌹","🌸","🌈","☀️","🌙","⚡","☕","🍕","🍔","🍎","🍉","🍓","🎂","⚽","🏆","🎮","🎵","🚗","✈️","🏠","💡","📸","📱","💻","🎁","✅","❌","💖","💪","🤝","👀","💀","🤦","🤷","🙈","😴","🥹","😏","😱","🤯","😈","👻","🤖","💬"].map((emoji, index) => <button type="button" key={emoji + index} aria-label={emoji} onClick={() => { const input = draftInputRef.current; const start = input?.selectionStart ?? draft.length; const end = input?.selectionEnd ?? draft.length; handleDraftChange(draft.slice(0, start) + emoji + draft.slice(end)); setEmojiPanelOpen(false); window.setTimeout(() => { input?.focus(); input?.setSelectionRange(start + emoji.length, start + emoji.length); }, 0); }}>{emoji}</button>)}</div></div>}
              {(recording || recordingPaused) ? + (recordingPaused ? " is-paused" : "")}><span className={"rooms-recording-dot" + (recordingPaused ? " is-paused" : "")} />{recordingPaused ? "Recording paused" : "Recording voice note"} · {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, "0")}</div> : voiceDraft && voiceDraftUrl ? <div className="rooms-voice-draft-preview"><VoiceNotePlayer src={voiceDraftUrl} /></div> : <textarea ref={draftInputRef} value={draft} onChange={event => handleDraftChange(event.target.value)} maxLength={4000} rows={1} placeholder={`Message @${activePerson.username}…`} aria-label="Write a message" onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />}
              {!recording && !recordingPaused && !voiceDraft && <span className="rooms-character-count">{draft.length > 3500 ? `${draft.length}/4000` : ""}</span>}
              {(recording || recordingPaused) ? <><button type="button" className="rooms-recording-control" onClick={() => void recordVoiceNote()} aria-label={recordingPaused ? "Resume recording" : "Pause recording"} title={recordingPaused ? "Resume recording" : "Pause recording"}>{recordingPaused ? <Play size={17} fill="currentColor" /> : <Pause size={17} fill="currentColor" />}</button><button type="button" className="rooms-stop-recording" onClick={finishVoiceRecording} aria-label="Finish recording and review" title="Finish recording and review"><Square size={17} fill="currentColor" /></button><button type="button" className="rooms-discard-recording" onClick={discardVoiceDraft} aria-label="Delete recording" title="Delete recording"><Trash2 size={17} /></button></> : voiceDraft ? <><button type="button" className="rooms-discard-recording" onClick={discardVoiceDraft} disabled={voiceBusy} aria-label="Delete voice note" title="Delete voice note"><Trash2 size={17} /></button><button type="button" className="rooms-stop-recording" onClick={() => void sendVoiceDraft()} disabled={voiceBusy} aria-label="Send voice note" title="Send voice note">{voiceBusy ? <LoadingDots /> : <Send size={18} />}</button></> : <button type="submit" disabled={(!draft.trim() && imageFiles.length === 0) || compressingImages} aria-label="Send message"><ArrowUp size={20} strokeWidth={2.5} /></button>}
            </form></> : <div className="rooms-readonly-notice"><ShieldCheck size={16} /><span>This person no longer follows you, so you can’t send new messages.</span></div>}
          </> : <div className="rooms-welcome"><span><MessageCircle size={30} /></span><h2>Your conversations, all in one place</h2><p>Select a follower to start a conversation. Only people who follow you can receive messages from you.</p></div>}
        </section>
      </div>
    </section>
    {viewingImageUrl && <ImagePreviewModal imageUrl={viewingImageUrl} onClose={() => setViewingImageUrl(null)} />}
    {error && <div className="halls-toast halls-toast-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Dismiss notification">×</button></div>}
    {!(activePerson && mobileConversationOpen) && <NowBar />}
  </main>;
}
