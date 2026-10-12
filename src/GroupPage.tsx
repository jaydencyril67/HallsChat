import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Compass, LockKeyhole, MessageCircle, Plus, Send, UsersRound, UserPlus, X, LogOut, Trash2, RefreshCw, AlertTriangle } from "lucide-react";
import AppHeader from "./AppHeader";
import NowBar from "./NowBar";
import LoadingDots from "./components/LoadingDots";

const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");
type GroupSummary = { id: string; name: string; description: string; visibility: "public" | "private"; avatar?: string; ownerId: string; memberCount: number; role: string | null; inviteCode?: string; createdAt: string; updatedAt: string; lastMessage?: { text: string; createdAt: string; senderName: string } | null };
type Member = { id: string; name: string; username: string; profilePicture?: string; role: "owner" | "admin" | "member"; joinedAt?: string };
type GroupMessage = { id: string; text: string; imageUrl?: string; createdAt: string; editedAt?: string | null; sender: { id: string; name: string; username: string; profilePicture?: string } | null };
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

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault(); if (!activeId || !draft.trim() || busy) return;
    const text = draft.trim(); setDraft(""); setBusy(true);
    try { await request("/api/groups/" + encodeURIComponent(activeId) + "/messages", { method: "POST", body: JSON.stringify({ text }) }); await loadDetail(activeId, false); }
    catch (err) { setDraft(text); setError(err instanceof Error ? err.message : "Message wasn't sent."); }
    finally { setBusy(false); }
  }

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

  return <main className="home-page social-home">
    <AppHeader homeHref="/home" />
    <section className="home-shell social-shell" style={{ paddingBottom: 112 }}>
      <div style={{ width: "100%", maxWidth: 820, margin: "0 auto", boxSizing: "border-box" }}>
        {activeId && detail ? <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 13 }}>
            <button type="button" onClick={() => { setActiveId(""); setMemberPanel(false); }} aria-label="Back to groups" style={{ ...secondary, width: 42, padding: 0 }}><ArrowLeft size={18}/></button>
            <Avatar name={detail.name} src={detail.avatar} size={43}/>
            <div style={{ minWidth: 0, flex: 1 }}><div style={{ color: "#fff0f3", fontSize: ".98rem", fontWeight: 850, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{detail.name}</div><div style={{ ...muted, fontSize: ".75rem", marginTop: 3 }}>{detail.memberCount} members · {detail.visibility === "private" ? "Private group" : "Public group"}</div></div>
            <button type="button" onClick={() => setMemberPanel(value => !value)} aria-label="Group members" style={{ ...secondary, padding: "9px 10px" }}><UsersRound size={17}/></button>
          </div>
          {detail.description && <p style={{ ...muted, margin: "0 0 12px", fontSize: ".82rem", lineHeight: 1.5 }}>{detail.description}</p>}
          {detail.inviteCode && <div style={{ ...panel, padding: 11, marginBottom: 12, display: "flex", alignItems: "center", gap: 9 }}><LockKeyhole size={16} color="#ff9cab"/><div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: ".73rem", ...muted }}>Private invite code</div><strong style={{ letterSpacing: ".06em", overflowWrap: "anywhere" }}>{detail.inviteCode}</strong></div><button type="button" style={secondary} onClick={() => { void navigator.clipboard?.writeText(detail.inviteCode || ""); setNotice("Invite code copied."); }}>Copy</button></div>}
          {memberPanel && <div style={{ ...panel, padding: 12, marginBottom: 12 }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}><strong>Members · {detail.members.length}</strong><button type="button" aria-label="Close members" onClick={() => setMemberPanel(false)} style={{ ...secondary, minHeight: 30, padding: "4px 8px" }}><X size={15}/></button></div>
            <div style={{ display: "grid", gap: 9 }}>{detail.members.map(member => <div key={member.id} style={{ display: "flex", alignItems: "center", gap: 9 }}><Avatar name={member.name} src={member.profilePicture} size={36}/><div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: ".82rem", fontWeight: 750 }}>{member.name}</div><div style={{ ...muted, fontSize: ".72rem" }}>@{member.username} · {member.role}</div></div>{detail.role === "owner" && member.role !== "owner" && <button type="button" style={secondary} onClick={() => void changeRole(member, member.role === "admin" ? "member" : "admin")}>{member.role === "admin" ? "Make member" : "Make admin"}</button>}{isAdmin && member.role !== "owner" && member.id !== detail.ownerId && !(detail.role === "admin" && member.role === "admin") && <button type="button" aria-label={"Remove " + member.name} style={{ ...secondary, padding: "8px" }} onClick={() => askConfirm("Remove @" + member.username + " from this group?", () => removeMember(member))}><Trash2 size={15}/></button>}</div>)}</div>
          </div>}
          <div style={{ ...panel, minHeight: "44vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,210,219,.1)", display: "flex", alignItems: "center", justifyContent: "space-between" }}><strong style={{ fontSize: ".84rem" }}>Group conversation</strong><span style={{ ...muted, fontSize: ".72rem" }}>Latest 100 messages</span></div>
            <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 280, maxHeight: "54vh", overflowY: "auto" }}>
              {detailLoading && !messages.length ? <div style={{ display: "grid", placeItems: "center", padding: 28 }}><LoadingDots/></div> : messages.length ? messages.map(message => { const mine = message.sender?.id === currentUserId; return <div key={message.id} style={{ display: "flex", gap: 8, alignItems: "flex-end", flexDirection: mine ? "row-reverse" : "row" }}><Avatar name={message.sender?.name || "Member"} src={message.sender?.profilePicture} size={29}/><div style={{ maxWidth: "82%", minWidth: 0, border: "1px solid rgba(255,210,219,.1)", borderRadius: 13, padding: "9px 11px", background: mine ? "rgba(184,32,50,.2)" : "rgba(8,5,8,.35)" }}><div style={{ color: "#ffabb7", fontSize: ".69rem", fontWeight: 800, marginBottom: 4 }}>{message.sender?.name || "Member"} <span style={{ ...muted, fontWeight: 500 }}>· {formatTime(message.createdAt)}</span></div><div style={{ color: "#fff0f3", fontSize: ".84rem", lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{message.text}</div>{message.imageUrl && <img src={message.imageUrl} alt="Group attachment" loading="lazy" style={{ display: "block", maxWidth: "100%", maxHeight: 280, objectFit: "contain", borderRadius: 8, marginTop: 6 }}/>}</div></div>; }) : <div style={{ textAlign: "center", padding: "40px 14px", ...muted }}><MessageCircle size={27} style={{ marginBottom: 10, color: "#ff9cab" }}/><div style={{ color: "#fff0f3", fontWeight: 800, marginBottom: 5 }}>Start the conversation</div><div style={{ fontSize: ".8rem" }}>Say hello to your group.</div></div>}
            </div>
            <form onSubmit={sendMessage} style={{ display: "flex", gap: 8, padding: 10, borderTop: "1px solid rgba(255,210,219,.1)" }}><input aria-label="Write a group message" value={draft} onChange={event => setDraft(event.target.value)} placeholder="Message the group…" maxLength={4000} style={{ ...field, minWidth: 0, flex: 1 }}/><button type="submit" disabled={!draft.trim() || busy} aria-label="Send group message" style={{ ...primary, width: 46, padding: 0, flexShrink: 0, opacity: !draft.trim() || busy ? .55 : 1 }}><Send size={17}/></button></form>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}><button type="button" style={{ ...secondary, flex: 1 }} onClick={() => { void loadDetail(activeId); }}><RefreshCw size={15}/> Refresh</button>{detail.role === "owner" ? <button type="button" style={{ ...secondary, flex: 1, color: "#ffabb7" }} disabled={busy} onClick={() => askConfirm("Delete this group and all its messages? This cannot be undone.", deleteGroup)}><Trash2 size={15}/> Delete group</button> : <button type="button" style={{ ...secondary, flex: 1, color: "#ffabb7" }} disabled={busy} onClick={() => askConfirm("Leave this group? You will need to join again to read new messages.", leaveGroup)}><LogOut size={15}/> Leave group</button>}</div>
        </> : <>
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 15 }}><strong style={{ fontSize: "1rem" }}>{showCreate ? "Create a group" : "Join a private group"}</strong><button type="button" aria-label="Close" onClick={() => { setShowCreate(false); setShowJoin(false); }} style={{ ...secondary, minHeight: 32, width: 32, padding: 0 }}><X size={17}/></button></div>
        {showCreate ? <form onSubmit={createGroup} style={{ display: "grid", gap: 11 }}><label style={{ fontSize: ".78rem", fontWeight: 750 }}>Group name<input required minLength={2} maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Weekend Football Crew" style={{ ...field, marginTop: 6 }}/></label><label style={{ fontSize: ".78rem", fontWeight: 750 }}>Description <span style={muted}>(optional)</span><textarea maxLength={500} value={description} onChange={event => setDescription(event.target.value)} placeholder="What is this group about?" rows={3} style={{ ...field, resize: "vertical", marginTop: 6 }}/></label><div style={{ fontSize: ".78rem", fontWeight: 750 }}>Who can join?</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>{([{ id: "public", label: "Public", detail: "Anyone can discover it" }, { id: "private", label: "Private", detail: "Invite code required" }] as const).map(option => <button key={option.id} type="button" onClick={() => setVisibility(option.id)} style={{ ...secondary, minHeight: 68, flexDirection: "column", alignItems: "flex-start", borderColor: visibility === option.id ? "rgba(229,70,92,.75)" : "rgba(255,210,219,.16)", background: visibility === option.id ? "rgba(184,32,50,.13)" : "rgba(255,255,255,.03)" }}><span>{option.id === "public" ? <Compass size={15}/> : <LockKeyhole size={15}/>} {option.label}</span><span style={{ ...muted, fontSize: ".68rem", fontWeight: 500 }}>{option.detail}</span></button>)}</div><button type="submit" disabled={busy || name.trim().length < 2} style={{ ...primary, width: "100%", opacity: busy || name.trim().length < 2 ? .6 : 1 }}>{busy ? <LoadingDots/> : <><Plus size={16}/> Create group</>}</button></form> : <form onSubmit={event => { event.preventDefault(); void joinGroup(undefined, inviteCode); }} style={{ display: "grid", gap: 12 }}><p style={{ ...muted, margin: 0, fontSize: ".82rem", lineHeight: 1.55 }}>Enter the invite code shared by the group owner or an admin.</p><input required value={inviteCode} onChange={event => setInviteCode(event.target.value.trim())} placeholder="Invite code" style={field}/><button type="submit" disabled={busy || !inviteCode.trim()} style={{ ...primary, width: "100%" }}>{busy ? <LoadingDots/> : <><UserPlus size={16}/> Join group</>}</button></form>}
      </div>
    </div>}
    {confirmAction && <div role="dialog" aria-modal="true" aria-label="Confirm group action" onClick={event => { if (event.target === event.currentTarget) { setConfirmAction(null); setConfirmMessage(""); } }} style={{ position: "fixed", inset: 0, zIndex: 4500, display: "grid", placeItems: "center", padding: 18, background: "rgba(7,3,6,.78)", backdropFilter: "blur(8px)" }}><div style={{ ...panel, width: "100%", maxWidth: 380, padding: 18, boxShadow: "0 20px 70px rgba(0,0,0,.5)" }}><div style={{ width: 42, height: 42, borderRadius: 13, display: "grid", placeItems: "center", background: "rgba(184,32,50,.16)", color: "#ff9cab", marginBottom: 12 }}><AlertTriangle size={20}/></div><strong style={{ display: "block", fontSize: ".98rem" }}>Are you sure?</strong><p style={{ ...muted, fontSize: ".82rem", lineHeight: 1.55, margin: "7px 0 17px" }}>{confirmMessage}</p><div style={{ display: "flex", gap: 9 }}><button type="button" style={{ ...secondary, flex: 1 }} onClick={() => { setConfirmAction(null); setConfirmMessage(""); }}>Cancel</button><button type="button" style={{ ...primary, flex: 1 }} disabled={busy} onClick={() => { const action = confirmAction; setConfirmAction(null); setConfirmMessage(""); if (action) void action(); }}>Confirm</button></div></div></div>}
    {(error || notice) && <div role={error ? "alert" : "status"} style={{ position: "fixed", left: 14, right: 14, bottom: 90, zIndex: 5000, maxWidth: 520, margin: "0 auto", padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, borderRadius: 13, border: "1px solid " + (error ? "rgba(255,120,120,.3)" : "rgba(255,210,219,.16)"), background: "rgba(28,9,15,.97)", color: "#fff0f3", boxShadow: "0 12px 30px rgba(0,0,0,.35)", fontSize: ".8rem" }}><span style={{ flex: 1, overflowWrap: "anywhere" }}>{error || notice}</span><button type="button" aria-label="Dismiss" onClick={() => { setError(""); setNotice(""); }} style={{ ...secondary, minHeight: 28, padding: "3px 7px" }}><X size={15}/></button></div>}
    <NowBar />
  </main>;
}
