import { useMemo, useState } from "react";
import { MessageCircle, Search, Plus, Users, Phone, Settings, MoreHorizontal, Paperclip, Send, CheckCheck, Bell, ChevronDown, CircleHelp, Video, ArrowLeft, Smile } from "lucide-react";

type Chat = { id: number; name: string; message: string; time: string; unread: number; color: string; initials: string; online?: boolean; group?: boolean };
const starterChats: Chat[] = [
  { id: 1, name: "HallsChat Team", message: "Welcome home 👋 Let’s get connected.", time: "9:41 AM", unread: 2, color: "#7d2937", initials: "HC", online: true, group: true },
  { id: 2, name: "Amara Okafor", message: "That photo came out so good 😂", time: "9:28 AM", unread: 1, color: "#9a5c47", initials: "AO", online: true },
  { id: 3, name: "David Mensah", message: "Voice message · 0:18", time: "Yesterday", unread: 0, color: "#3b6471", initials: "DM" },
  { id: 4, name: "Weekend plans", message: "Chidi: Saturday works for me", time: "Yesterday", unread: 0, color: "#765c8c", initials: "WP", group: true },
  { id: 5, name: "Mum ❤️", message: "Have you eaten, my dear?", time: "Tuesday", unread: 0, color: "#9b6b32", initials: "M" },
  { id: 6, name: "Tobi Adebayo", message: "Sent you the document.", time: "Monday", unread: 0, color: "#436d50", initials: "TA" }
];
const starterMessages = [
  { id: 1, from: "them", text: "Hey! Welcome to HallsChat 👋", time: "9:39 AM" },
  { id: 2, from: "them", text: "A fresh place to keep your people close.", time: "9:39 AM" },
  { id: 3, from: "me", text: "I’m here! This looks good ❤️", time: "9:40 AM" },
  { id: 4, from: "them", text: "Closer conversations. Stronger connections.", time: "9:41 AM" }
];

export default function App() {
  const [chats, setChats] = useState(starterChats);
  const [activeId, setActiveId] = useState<number | null>(1);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [dark, setDark] = useState(true);
  const [tab, setTab] = useState("Chats");
  const [messages, setMessages] = useState<Record<number, typeof starterMessages>>({ 1: starterMessages });
  const [mobileChat, setMobileChat] = useState(false);
  const [nowbarExpanded, setNowbarExpanded] = useState(false);
  const activeChat = chats.find(c => c.id === activeId) ?? null;
  const visibleChats = useMemo(() => chats.filter(c => c.name.toLowerCase().includes(query.toLowerCase()) || c.message.toLowerCase().includes(query.toLowerCase())), [chats, query]);
  const activeMessages = activeId ? (messages[activeId] ?? []) : [];
  const sendMessage = () => {
    const text = draft.trim();
    if (!text || !activeId) return;
    const next = [...activeMessages, { id: Date.now(), from: "me", text, time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) }];
    setMessages(prev => ({ ...prev, [activeId]: next }));
    setChats(prev => prev.map(c => c.id === activeId ? { ...c, message: text, time: "Now", unread: 0 } : c));
    setDraft("");
  };
  const openChat = (id: number) => { setActiveId(id); setMobileChat(true); setTab("Chats"); setChats(prev => prev.map(c => c.id === id ? { ...c, unread: 0 } : c)); };
  const newChat = () => {
    const name = window.prompt("Who would you like to chat with?");
    if (!name?.trim()) return;
    const id = Date.now();
    const fresh: Chat = { id, name: name.trim(), message: "You’re connected. Say hello!", time: "Now", unread: 0, color: "#87303d", initials: name.trim().split(/\s+/).map(x => x[0]).join("").slice(0,2).toUpperCase(), online: true };
    setChats(prev => [fresh, ...prev]); setActiveId(id); setMobileChat(true);
  };
  return <main className={dark ? "app dark" : "app light"}>
    <aside className={`sidebar ${mobileChat ? "sidebar-hidden-mobile" : ""}`}>
      <div className="brand-row"><div className="brand-mark"><MessageCircle size={23} strokeWidth={2.5}/><span /></div><div><div className="brand-name">Halls<span>Chat</span></div><div className="brand-sub">YOUR PEOPLE, CLOSER.</div></div><button className="icon-button sidebar-more" aria-label="More options"><MoreHorizontal size={21}/></button></div>
      <button className="profile-switch"><div className="mini-avatar">Y</div><div className="profile-copy"><strong>Your space</strong><small>Personal account</small></div><ChevronDown size={16}/></button>
      <div className="search-box"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search conversations" aria-label="Search conversations"/><kbd>⌘ K</kbd></div>
      <div className="section-label"><span>MESSAGES</span><button className="icon-button tiny" onClick={newChat} aria-label="New chat"><Plus size={17}/></button></div>
      <nav className="chat-list">{visibleChats.map(chat => <button key={chat.id} className={`chat-row ${activeId === chat.id ? "selected" : ""}`} onClick={() => openChat(chat.id)}><div className="avatar-wrap"><div className="avatar" style={{background:chat.color}}>{chat.initials}</div>{chat.online && <i className="online-dot"/>}</div><div className="chat-row-content"><div className="chat-top"><strong>{chat.name}</strong><time>{chat.time}</time></div><div className="chat-bottom"><span>{chat.message}</span>{chat.unread > 0 && <b className="unread">{chat.unread}</b>}</div></div></button>)}
        {visibleChats.length === 0 && <div className="empty-search">No conversations found.</div>}
      </nav>
      <div className="sidebar-footer"><div className="secure-dot"/> <span>Your conversations, your space</span><button className="icon-button tiny" onClick={() => setDark(v => !v)} aria-label="Toggle theme"><Settings size={17}/></button></div>
    </aside>
    <section className={`workspace ${mobileChat ? "workspace-mobile-chat" : ""}`}>
      <header className="topbar"><div className="topbar-context"><span className="live-indicator"/> <span>MESSAGES</span><span className="crumb">/</span><strong>{activeChat?.name ?? tab}</strong></div><div className="top-actions"><button className="icon-button" aria-label="Notifications"><Bell size={18}/><i className="notification-dot"/></button><button className="icon-button" aria-label="Help"><CircleHelp size={18}/></button><div className="user-avatar">Y</div></div></header>
      {tab === "Chats" && activeChat ? <div className="conversation-layout">
        <section className="conversation">
          <header className="conversation-header"><button className="icon-button back-mobile" onClick={() => setMobileChat(false)} aria-label="Back to chats"><ArrowLeft size={19}/></button><div className="avatar-wrap"><div className="avatar large" style={{background:activeChat.color}}>{activeChat.initials}</div>{activeChat.online && <i className="online-dot"/>}</div><div className="contact-heading"><strong>{activeChat.name}</strong><span>{activeChat.online ? "Active now" : activeChat.group ? "Group conversation" : "Last seen recently"}</span></div><div className="conversation-actions"><button className="icon-button" aria-label="Voice call"><Phone size={18}/></button><button className="icon-button" aria-label="Video call"><Video size={18}/></button><button className="icon-button" aria-label="Conversation details"><MoreHorizontal size={19}/></button></div></header>
          <div className="messages-area"><div className="day-divider"><span>TODAY</span></div>{activeMessages.map(m => <div key={m.id} className={`message-line ${m.from === "me" ? "mine" : ""}`}><div className="message-bubble">{m.text}<div className="message-meta"><time>{m.time}</time>{m.from === "me" && <CheckCheck size={13}/>}</div></div></div>)}<div className="encryption-note"><span className="lock-symbol">✳</span> This is a design preview. Messages are not being sent to another person yet.</div></div>
          <form className="composer" onSubmit={e => { e.preventDefault(); sendMessage(); }}><button type="button" className="icon-button attach" aria-label="Attach file"><Paperclip size={19}/></button><input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Write a message..." aria-label="Write a message"/><button type="button" className="icon-button emoji" aria-label="Emoji"><Smile size={19}/></button><button className="send-button" type="submit" aria-label="Send preview message"><Send size={17}/></button></form>
        </section>
        <aside className="details-panel"><div className="details-top"><span>CONVERSATION</span><button className="icon-button tiny" aria-label="More conversation options"><MoreHorizontal size={18}/></button></div><div className="detail-profile"><div className="avatar detail-avatar" style={{background:activeChat.color}}>{activeChat.initials}</div><h2>{activeChat.name}</h2><p>{activeChat.group ? "A little corner for your people." : "Good conversations start here."}</p><span className="status-pill"><i/> {activeChat.online ? "Online" : "Away"}</span></div><div className="detail-divider"/><div className="detail-section"><span className="section-kicker">SHARED SPACE</span><div className="detail-item"><span className="detail-icon"><Users size={16}/></span><div><strong>{activeChat.group ? "Group members" : "Contact details"}</strong><small>{activeChat.group ? "Manage your circle" : "Profile and availability"}</small></div></div><div className="detail-item"><span className="detail-icon"><Paperclip size={16}/></span><div><strong>Media & files</strong><small>Photos, links and documents</small></div></div></div><div className="detail-bottom"><div className="brand-mark small"><MessageCircle size={16}/></div><span>Made for meaningful moments.</span></div></aside>
      </div> : <div className="placeholder-view"><div className="placeholder-icon">{tab === "Contacts" ? <Users/> : tab === "Calls" ? <Phone/> : tab === "Groups" ? <MessageCircle/> : <Settings/>}</div><h2>{tab}</h2><p>{tab === "Contacts" ? "Your people will have a home here." : tab === "Calls" ? "Voice and video calling will be built in a later stage." : tab === "Groups" ? "Bring your people together in one place." : "Make HallsChat feel like yours."}</p><button className="primary-button" onClick={tab === "Contacts" || tab === "Groups" ? newChat : () => setDark(v => !v)}>{tab === "Contacts" || tab === "Groups" ? "Start a conversation" : "Switch appearance"}</button></div>}
      <nav className={`nowbar ${nowbarExpanded ? "expanded" : "compact"}`} aria-label="HallsChat NowBar"><div className="nowbar-items">{[{label:"Chats",icon:<MessageCircle size={18}/>},{label:"Contacts",icon:<Users size={18}/>},{label:"Calls",icon:<Phone size={18}/>},{label:"Groups",icon:<Users size={18}/>},{label:"Settings",icon:<Settings size={18}/>}].map(item => <button key={item.label} onClick={() => {setTab(item.label);setMobileChat(false);}} className={`nowbar-item ${tab === item.label ? "active" : ""}`} aria-current={tab === item.label ? "page" : undefined}>{item.icon}<span>{item.label}</span></button>)}</div><button className="nowbar-toggle" onClick={() => setNowbarExpanded(v => !v)} aria-label={nowbarExpanded ? "Collapse NowBar" : "Expand NowBar"} title={nowbarExpanded ? "Collapse navigation" : "Expand navigation"}><ChevronDown size={17}/></button></nav>
    </section>
  </main>;
}