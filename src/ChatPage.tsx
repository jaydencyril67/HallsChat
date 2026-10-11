import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, ArrowUp, MessageCircle, ShieldCheck, UsersRound } from "lucide-react";
import AppHeader from "./AppHeader";
import NowBar from "./NowBar";
import LoadingDots from "./components/LoadingDots";
import { navigate } from "./utils/navigate";

type ChatPerson = {
  id: string;
  name: string;
  username: string;
  profilePicture?: string;
  canMessage: boolean;
  lastMessage?: string;
  lastMessageAt?: string | null;
};
type ChatMessage = { id: string; senderId: string; recipientId: string; text: string; createdAt: string };
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
function Avatar({ person, size = "normal" }: { person: Pick<ChatPerson, "name" | "profilePicture">; size?: "normal" | "large" }) {
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
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const draftInputRef = useRef<HTMLTextAreaElement | null>(null);
  const activePerson = useMemo(() => people.find(person => person.id === activeId) || null, [people, activeId]);

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
      setMessages(Array.isArray(payload.messages) ? payload.messages as ChatMessage[] : []);
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
    void loadMessages(activeId, true);
    const timer = window.setInterval(() => { void loadMessages(activeId, false); }, 4000);
    return () => window.clearInterval(timer);
  }, [activeId, loadMessages]);

  useEffect(() => {
    const input = draftInputRef.current;
    if (!input) return;
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 144)}px`;
  }, [draft]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, activeId]);

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!activePerson || !activePerson.canMessage || !text || sending) return;
    const savedToken = token();
    if (!savedToken) { navigate("/signin", { replace: true }); return; }
    setSending(true);
    setError("");
    try {
      const response = await fetch(`${apiBase}/api/chat/${encodeURIComponent(activePerson.id)}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${savedToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) { localStorage.removeItem("hallschat_token"); navigate("/signin", { replace: true }); return; }
      if (!response.ok) throw new Error(payload.message || "Your message couldn't be sent.");
      const sent = payload.message as ChatMessage;
      setMessages(current => current.some(item => item.id === sent.id) ? current : [...current, sent]);
      setDraft("");
      setPeople(current => current.map(person => person.id === activePerson.id ? { ...person, lastMessage: sent.text, lastMessageAt: sent.createdAt } : person).sort((a, b) => {
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
      <div className="chat-heading">
        <div className="chat-heading-icon"><MessageCircle size={22} /></div>
        <div><h1>Chats</h1><p>Private conversations with people who follow you.</p></div>
      </div>
      <div className={`chat-layout ${activePerson && mobileConversationOpen ? "chat-layout-conversation-open" : ""}`}>
        <aside className="chat-sidebar" aria-label="Your conversations">
          <div className="chat-sidebar-heading"><strong>Messages</strong><span>{people.filter(person => person.canMessage).length} followers</span></div>
          {listLoading ? <div className="chat-list-state"><LoadingDots /></div> : people.length ? <div className="chat-people-list">
            {people.map(person => <article key={person.id} className={`chat-person-row ${activeId === person.id ? "chat-person-row-active" : ""}`}>
              <Avatar person={person} />
              <button type="button" className="chat-person-copy chat-person-select" onClick={() => { setActiveId(person.id); setMobileConversationOpen(true); setError(""); }} aria-label={`Open chat with ${person.name}`}>
                <strong>{person.name}</strong><small>@{person.username}</small><span className="chat-last-message">{person.canMessage ? (person.lastMessage || "Start a conversation") : (person.lastMessage || "No longer follows you")}</span>
              </button>
              <span className="chat-person-meta">{formatTime(person.lastMessageAt)}{!person.canMessage && <span className="chat-lock-dot" title="Messaging unavailable">•</span>}</span>
              <button type="button" className="chat-open-button" onClick={() => { setActiveId(person.id); setMobileConversationOpen(true); setError(""); }} aria-label={`Open conversation with ${person.name}`} title="Open chat"><MessageCircle size={18} /></button>
            </article>)}
          </div> : <div className="chat-list-empty"><UsersRound size={24} /><strong>No followers yet</strong><p>When someone follows you, you can start chatting with them here.</p></div>}
          <div className="chat-rule-note"><ShieldCheck size={15} /><span>You can message your followers only. Following someone doesn't grant messaging access.</span></div>
        </aside>

        <section className="chat-conversation" aria-label="Conversation">
          {activePerson ? <>
            <header className="chat-conversation-header">
              <button className="chat-back-button" type="button" onClick={() => { setMobileConversationOpen(false); setActiveId(""); }} aria-label="Back to messages"><ArrowLeft size={19} /></button>
              <Avatar person={activePerson} size="large" />
              <div className="chat-conversation-person"><strong>{activePerson.name}</strong><span>@{activePerson.username}</span></div>
              <span className={`chat-access-pill ${activePerson.canMessage ? "chat-access-allowed" : "chat-access-blocked"}`}>{activePerson.canMessage ? "Follower" : "Read only"}</span>
            </header>
            <div className="chat-message-list">
              {messagesLoading ? <div className="chat-message-loading"><LoadingDots /></div> : messages.length ? messages.map(message => {
                const mine = message.senderId === currentUserId;
                return <div key={message.id} className={`chat-message-line ${mine ? "chat-message-line-mine" : ""}`}>
                  <div className="chat-message-content">
                    <p className="chat-message-text">{message.text}</p>
                    <time>{formatTime(message.createdAt)}</time>
                  </div>
                </div>;
              }) : <div className="chat-empty-conversation"><span><MessageCircle size={25} /></span><strong>Say hello</strong><p>Your messages with @{activePerson.username} will appear here.</p></div>}
              <div ref={bottomRef} />
            </div>
            {activePerson.canMessage ? <form className="chat-composer" onSubmit={sendMessage}>
              <textarea ref={draftInputRef} value={draft} onChange={event => setDraft(event.target.value)} maxLength={4000} rows={1} placeholder={`Message @${activePerson.username}…`} aria-label="Write a message" onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
              <span className="chat-character-count">{draft.length > 3500 ? `${draft.length}/4000` : ""}</span>
              <button type="submit" disabled={!draft.trim() || sending} aria-label="Send message">{sending ? <LoadingDots /> : <ArrowUp size={20} strokeWidth={2.5} />}</button>
            </form> : <div className="chat-readonly-notice"><ShieldCheck size={16} /><span>This person no longer follows you, so you can’t send new messages.</span></div>}
          </> : <div className="chat-welcome"><span><MessageCircle size={30} /></span><h2>Your conversations, all in one place</h2><p>Select a follower to start chatting. Only people who follow you can receive messages from you.</p></div>}
        </section>
      </div>
    </section>
    {error && <div className="halls-toast halls-toast-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError("")} aria-label="Dismiss notification">×</button></div>}
    <NowBar />
  </main>;
}
