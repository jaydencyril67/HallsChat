import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { ArrowLeft, ArrowUp, ImagePlus, MessageCircle, ShieldCheck, UsersRound, X } from "lucide-react";
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
type ChatMessage = { id: string; senderId: string; recipientId: string; text: string; imageUrl?: string; images?: string[]; createdAt: string };
const MAX_CHAT_IMAGE_SIZE = 10 * 1024 * 1024;
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
function Avatar({ person, size = "normal" }: { person: Pick<ChatPerson, "name" | "profilePicture" | "isOnline">; size?: "normal" | "large" }) {
  return <span className={`chat-avatar ${size === "large" ? "chat-avatar-large" : ""}`}>
    {person.profilePicture ? <img src={person.profilePicture} alt="" /> : initials(person.name)}
  </span>;
}

export default function ChatPage() {
  const [people, setPeople] = useState<ChatPerson[]>([]);
  const [activeId, setActiveId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [listLoading, setListLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [mobileConversationOpen, setMobileConversationOpen] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollOnOpenRef = useRef(false);
  const draftInputRef = useRef<HTMLTextAreaElement | null>(null);
  const activeIdRef = useRef(activeId);
  const currentUserIdRef = useRef(currentUserId);
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const activePerson = useMemo(() => people.find(person => person.id === activeId) || null, [people, activeId]);
  activeIdRef.current = activeId;
  currentUserIdRef.current = currentUserId;

  const token = () => localStorage.getItem("hallschat_token");


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
    socket.on("chat:message", (message: ChatMessage) => {
      const me = currentUserIdRef.current;
      const openId = activeIdRef.current;
      const belongsToOpenConversation =
        (message.senderId === me && message.recipientId === openId) ||
        (message.senderId === openId && message.recipientId === me);
      if (belongsToOpenConversation) {
        setMessages(current => current.some(item => item.id === message.id) ? current : [...current, message]);
      }
      const otherId = message.senderId === me ? message.recipientId : message.senderId;
      const preview = message.text || ((message.images?.length || message.imageUrl) ? "📷 Photo" : "");
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
      socket.removeAllListeners();
      socket.disconnect();
      if (socketRef.current === socket) socketRef.current = null;
    };
  }, [currentUserId]);

  const loadMessages = useCallback(async (personId: string, showLoader = false) => {
    const savedToken = localStorage.getItem("hallschat_token");
    if (!savedToken || !personId) return;
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
    }
  }, []);

  useEffect(() => {
    if (!activeId) { setMessages([]); setMessagesLoading(false); return; }
    // Fetch history once when a conversation opens; new messages arrive over Socket.IO.
    void loadMessages(activeId, true);
  }, [activeId, loadMessages]);



  useEffect(() => {
    if (!scrollOnOpenRef.current || !activeId || messagesLoading) return;
    bottomRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    scrollOnOpenRef.current = false;
  }, [activeId, messages, messagesLoading]);

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

  function handleImageSelection(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files || []);
    event.target.value = "";
    if (!picked.length) return;
    if (picked.length > 1 || imageFiles.length + picked.length > 1) { setError("You can send one image per message."); return; }
    if (picked.some(file => !file.type.startsWith("image/"))) { setError("Choose image files only."); return; }
    if (picked.some(file => file.size > MAX_CHAT_IMAGE_SIZE)) { setError("Each chat image must be 10 MB or smaller."); return; }
    setError("");
    setImageFiles(current => [...current, ...picked]);
    setImagePreviews(current => [...current, ...picked.map(file => URL.createObjectURL(file))]);
  }

  function removeSelectedImage(index: number) {
    const preview = imagePreviews[index];
    if (preview) URL.revokeObjectURL(preview);
    setImageFiles(current => current.filter((_, i) => i !== index));
    setImagePreviews(current => current.filter((_, i) => i !== index));
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!activePerson || !activePerson.canMessage || (!text && imageFiles.length === 0) || sending) return;
    const savedToken = token();
    if (!savedToken) { navigate("/signin", { replace: true }); return; }
    setSending(true);
    setError("");
    try {
      const images: string[] = [];
      for (const file of imageFiles) images.push(await uploadChatImage(file, savedToken));
      const socket = socketRef.current;
      if (!socket?.connected) throw new Error("Reconnecting to live chat. Please try sending again in a moment.");
      const result = await new Promise<{ ok: boolean; message?: ChatMessage }>((resolve, reject) => {
        socket.timeout(15000).emit(
          "chat:send",
          { recipientId: activePerson.id, text, images },
          (timeoutError: Error | null, response: { ok?: boolean; message?: ChatMessage | string }) => {
            if (timeoutError) return reject(new Error("The live connection timed out. Please try again."));
            if (!response?.ok) return reject(new Error(typeof response?.message === "string" ? response.message : "Your message couldn't be sent."));
            resolve({ ok: true, message: response.message as ChatMessage });
          }
        );
      });
      const sent = result.message;
      if (!sent) throw new Error("The server didn't confirm your message.");
      setMessages(current => current.some(item => item.id === sent.id) ? current : [...current, sent]);
      setDraft("");
      imagePreviews.forEach(url => URL.revokeObjectURL(url));
      setImageFiles([]);
      setImagePreviews([]);
      setPeople(current => current.map(person => person.id === activePerson.id ? { ...person, lastMessage: sent.text || ((sent.images?.length || sent.imageUrl) ? "📷 Photo" : ""), lastMessageAt: sent.createdAt } : person).sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime || a.name.localeCompare(b.name);
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Your message couldn't be sent.");
    } finally {
      setSending(false);
    }
  }

  return <main className={`home-page social-home chat-page ${activePerson && mobileConversationOpen ? "chat-page-conversation-open" : ""}`}>
    <AppHeader homeHref="/home" />
    <section className="home-shell social-shell chat-shell">
      <div className={`chat-layout ${activePerson && mobileConversationOpen ? "chat-layout-conversation-open" : ""}`}>
        <aside className="chat-sidebar" aria-label="Your conversations">
          <div className="chat-sidebar-heading"><strong>Messages</strong><span>{people.filter(person => person.canMessage).length} followers</span></div>
          {listLoading ? <div className="chat-list-state"><LoadingDots /></div> : people.length ? <div className="chat-people-list">
            {people.map(person => <article key={person.id} className={`chat-person-row ${activeId === person.id ? "chat-person-row-active" : ""}`}>
              <Avatar person={person} />
              <button type="button" className="chat-person-copy chat-person-select" onClick={() => { scrollOnOpenRef.current = true; setActiveId(person.id); setMobileConversationOpen(true); setError(""); }} aria-label={`Open chat with ${person.name}`}>
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
              <button className="chat-back-button" type="button" onClick={() => { setMobileConversationOpen(false); setActiveId(""); }} aria-label="Back to messages"><ArrowLeft size={19} /></button>
              <Avatar person={activePerson} size="large" />
              <div className="chat-conversation-person"><strong>{activePerson.name}</strong><span>@{activePerson.username} · {activePerson.isOnline ? "Online" : "Offline"}</span></div>
              <span className={`chat-access-pill ${activePerson.canMessage ? "chat-access-allowed" : "chat-access-blocked"}`}>{activePerson.canMessage ? "Follower" : "Read only"}</span>
            </header>
            <div className="chat-message-list">
              {messagesLoading ? <div className="chat-message-loading"><LoadingDots /></div> : messages.length ? messages.map(message => {
                const mine = message.senderId === currentUserId;
                return <div key={message.id} className={`chat-message-line ${mine ? "chat-message-line-mine" : ""}`}>
                  <div className={`chat-message-content ${mine ? "chat-message-content-mine" : "chat-message-content-theirs"}`}>
                    <div className="chat-message-body">
                    {(message.images?.length ? message.images : message.imageUrl ? [message.imageUrl] : []).length > 0 && <div className={`chat-image-grid ${(message.images?.length || (message.imageUrl ? 1 : 0)) === 1 ? "chat-image-grid-single" : ""}`}>{(message.images?.length ? message.images : message.imageUrl ? [message.imageUrl] : []).map((url, index) => <button key={`${url}-${index}`} type="button" className="chat-image-bubble" onClick={() => setViewingImageUrl(url)} aria-label={`View image ${index + 1}`}><img src={url} alt={message.text || `Shared image ${index + 1}`} loading="lazy" /></button>)}</div>}
                    {message.text && <p className="chat-message-text">{message.text}</p>}
                    </div>
                    <time>{new Date(message.createdAt).toLocaleString()}</time>
                  </div>
                </div>;
              }) : <div className="chat-empty-conversation"><span><MessageCircle size={25} /></span><strong>Say hello</strong><p>Your messages with @{activePerson.username} will appear here.</p></div>}
              <div ref={bottomRef} />
            </div>
            {activePerson.canMessage ? <><input ref={imageInputRef} type="file" accept="image/*" hidden onChange={handleImageSelection} />{imagePreviews.length > 0 && <div className="chat-image-pending-grid">{imagePreviews.map((url, index) => <div className="chat-image-pending" key={`${url}-${index}`}><img src={url} alt={`Image ${index + 1} ready to send`} /><button type="button" onClick={() => removeSelectedImage(index)} aria-label={`Remove image ${index + 1}`}><X size={17} /></button></div>)}<span className="chat-image-count">1 image ready</span></div>}<form className="chat-composer" onSubmit={sendMessage}>
              <button type="button" className="chat-attach-button" onClick={() => imageInputRef.current?.click()} disabled={sending} aria-label="Attach image" title="Send image"><ImagePlus size={20} /></button>
              <textarea ref={draftInputRef} value={draft} onChange={event => setDraft(event.target.value)} maxLength={4000} rows={1} placeholder={`Message @${activePerson.username}…`} aria-label="Write a message" onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
              <span className="chat-character-count">{draft.length > 3500 ? `${draft.length}/4000` : ""}</span>
              <button type="submit" disabled={(!draft.trim() && imageFiles.length === 0) || sending} aria-label="Send message">{sending ? <LoadingDots /> : <ArrowUp size={20} strokeWidth={2.5} />}</button>
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
