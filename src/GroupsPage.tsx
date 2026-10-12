import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { io } from "socket.io-client";
import { ArrowLeft, Check, Crown, Globe2, Image as ImageIcon, LockKeyhole, LogOut, MessageCircle, Pencil, Plus, Search, Send, ShieldCheck, Trash2, UserPlus, UsersRound, X } from "lucide-react";
import AppHeader from "./AppHeader";
import NowBar from "./NowBar";
import LoadingDots from "./components/LoadingDots";
import { navigate } from "./utils/navigate";

const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");
const MAX_GROUP_IMAGES = 4;
const MAX_GROUP_IMAGE_SIZE = 10 * 1024 * 1024;
const reactionChoices = ["❤️", "😂", "😮", "😢", "🙏", "👍"];

type GroupRole = "owner" | "admin" | "member" | "";
type GroupTab = "mine" | "discover";
type GroupPerson = { id: string; name: string; username: string; profilePicture?: string; isOnline?: boolean; role?: GroupRole };
type GroupSummary = {
  id: string; name: string; description: string; privacy: "public" | "private"; imageUrl?: string;
  ownerId: string; ownerName?: string; ownerPicture?: string; owner?: GroupPerson; memberCount: number;
  lastMessagePreview: string; lastMessageAt?: string | null; createdAt?: string; currentRole: GroupRole;
  members?: GroupPerson[];
};
type GroupReaction = { userId: string; emoji: string };
type GroupMessage = {
  id: string; groupId: string; senderId: string; sender?: GroupPerson; text: string; imageUrl?: string;
  images?: string[]; audioUrl?: string; reactions: GroupReaction[]; deletedForEveryone: boolean;
  editedAt?: string | null; deletedAt?: string | null; createdAt: string;
};
type HallPerson = { id: string; name: string; username: string; profilePicture?: string; following?: boolean };
type PendingAction =
  | { kind: "leave" }
  | { kind: "delete-group" }
  | { kind: "remove-member"; memberId: string; memberName: string }
  | { kind: "delete-message"; messageId: string };

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const savedToken = localStorage.getItem("hallschat_token");
  if (!savedToken) {
    navigate("/signin", { replace: true });
    throw new Error("Please sign in again.");
  }
  const headers: Record<string, string> = {
    Authorization: "Bearer " + savedToken,
    ...((options.headers || {}) as Record<string, string>)
  };
  if (typeof options.body === "string" && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  const response = await fetch(apiBase + path, { ...options, headers });
  const payload = await response.json().catch(() => ({})) as Record<string, any>;
  if (response.status === 401) {
    localStorage.removeItem("hallschat_token");
    navigate("/signin", { replace: true });
    throw new Error(payload.message || "Please sign in again.");
  }
  if (!response.ok) throw new Error(typeof payload.message === "string" ? payload.message : "That action couldn't be completed.");
  return payload as T;
}

function initials(value: string) {
  return value.trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase() || "H";
}

function formatTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function PersonAvatar({ person, size = 42 }: { person?: Partial<GroupPerson> | null; size?: number }) {
  const name = person?.name || person?.username || "HallsChat member";
  return <span className="groups-avatar" style={{ width: size, height: size, minWidth: size }} aria-hidden="true">
    {person?.profilePicture ? <img src={person.profilePicture} alt="" loading="lazy" /> : initials(name)}
  </span>;
}

export default function GroupsPage() {
  const initialGroupId = useMemo(() => {
    const match = (window.location.pathname || "").match(/^\/groups\/([^/]+)$/);
    return match ? decodeURIComponent(match[1]) : "";
  }, []);
  const [tab, setTab] = useState<GroupTab>("mine");
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeGroupId, setActiveGroupId] = useState(initialGroupId);
  const [activeGroup, setActiveGroup] = useState<GroupSummary | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState("");
  const [draft, setDraft] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [typingLabel, setTypingLabel] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createPrivacy, setCreatePrivacy] = useState<"public" | "private">("public");
  const [creating, setCreating] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPrivacy, setEditPrivacy] = useState<"public" | "private">("public");
  const [savingSettings, setSavingSettings] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteCandidates, setInviteCandidates] = useState<HallPerson[]>([]);
  const [inviteSelection, setInviteSelection] = useState<string[]>([]);
  const [inviteSearch, setInviteSearch] = useState("");
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [memberBusyId, setMemberBusyId] = useState("");
  const [editingMessageId, setEditingMessageId] = useState("");
  const [editMessageDraft, setEditMessageDraft] = useState("");
  const [savingMessageEdit, setSavingMessageEdit] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(Boolean(initialGroupId));
  const [viewingImageUrl, setViewingImageUrl] = useState("");
  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const activeGroupIdRef = useRef(activeGroupId);
  const tabRef = useRef(tab);
  const messageListRef = useRef<HTMLDivElement | null>(null);
  const draftInputRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const typingHideTimerRef = useRef<number | null>(null);
  const refreshDetailsRef = useRef<() => void>(() => undefined);

  activeGroupIdRef.current = activeGroupId;
  tabRef.current = tab;

  useEffect(() => {
    if (!error && !notice) return;
    const timer = window.setTimeout(() => { setError(""); setNotice(""); }, 5000);
    return () => window.clearTimeout(timer);
  }, [error, notice]);

  const loadGroups = useCallback(async (activeTab: GroupTab, showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const payload = await apiRequest<{ groups?: GroupSummary[] }>("/api/groups?view=" + activeTab);
      setGroups(Array.isArray(payload.groups) ? payload.groups : []);
      setError("");
    } catch (err) {
      if (showLoader) setError(err instanceof Error ? err.message : "Groups couldn't be loaded.");
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  const loadGroupDetails = useCallback(async (groupId: string, silent = false) => {
    try {
      const payload = await apiRequest<{ group?: GroupSummary }>("/api/groups/" + encodeURIComponent(groupId));
      if (activeGroupIdRef.current === groupId && payload.group) setActiveGroup(payload.group);
    } catch (err) {
      if (!silent && activeGroupIdRef.current === groupId) {
        setActiveGroup(null);
        setError(err instanceof Error ? err.message : "This group couldn't be opened.");
      }
    }
  }, []);

  refreshDetailsRef.current = () => {
    const id = activeGroupIdRef.current;
    if (id) void loadGroupDetails(id, true);
  };

  useEffect(() => {
    const savedToken = localStorage.getItem("hallschat_token");
    if (!savedToken) { navigate("/signin", { replace: true }); return; }
    let cancelled = false;
    void apiRequest<{ user?: { id?: string } }>("/api/auth/me")
      .then(payload => { if (!cancelled) setCurrentUserId(payload.user?.id || ""); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "Your account couldn't be loaded."); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    void loadGroups(tab);
    const timer = window.setInterval(() => { void loadGroups(tabRef.current, false); }, 25000);
    return () => window.clearInterval(timer);
  }, [tab, loadGroups]);

  useEffect(() => {
    if (!activeGroupId) {
      setActiveGroup(null);
      setMessages([]);
      setTypingLabel("");
      return;
    }
    let cancelled = false;
    setMessagesLoading(true);
    setActiveGroup(null);
    setMessages([]);
    setError("");
    Promise.all([
      apiRequest<{ group?: GroupSummary }>("/api/groups/" + encodeURIComponent(activeGroupId)),
      apiRequest<{ messages?: GroupMessage[] }>("/api/groups/" + encodeURIComponent(activeGroupId) + "/messages?limit=100")
    ]).then(([groupPayload, messagePayload]) => {
      if (cancelled) return;
      if (!groupPayload.group) throw new Error("That group could not be found.");
      setActiveGroup(groupPayload.group);
      setMessages(Array.isArray(messagePayload.messages) ? messagePayload.messages : []);
    }).catch(err => {
      if (cancelled) return;
      setActiveGroup(null);
      setMessages([]);
      setError(err instanceof Error ? err.message : "This group couldn't be opened.");
    }).finally(() => { if (!cancelled) setMessagesLoading(false); });
    return () => { cancelled = true; };
  }, [activeGroupId]);

  useEffect(() => {
    const savedToken = localStorage.getItem("hallschat_token");
    if (!savedToken) return;
    const socket = io(apiBase, { auth: { token: savedToken }, transports: ["websocket", "polling"] });
    socketRef.current = socket;
    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);
    const onMessage = (message: GroupMessage) => {
      setGroups(current => current.map(group => group.id === message.groupId ? {
        ...group, lastMessagePreview: message.text || (message.images?.length ? "📷 Photo" : message.audioUrl ? "🎤 Voice note" : ""),
        lastMessageAt: message.createdAt
      } : group));
      setActiveGroup(current => current && current.id === message.groupId ? {
        ...current, lastMessagePreview: message.text || (message.images?.length ? "📷 Photo" : message.audioUrl ? "🎤 Voice note" : ""),
        lastMessageAt: message.createdAt
      } : current);
      if (activeGroupIdRef.current === message.groupId) {
        setMessages(current => current.some(item => item.id === message.id) ? current : [...current, message]);
      }
    };
    const onEdited = (event: { id: string; groupId: string; text: string; editedAt?: string | null }) => {
      setMessages(current => current.map(message => message.id === event.id ? { ...message, text: event.text, editedAt: event.editedAt || new Date().toISOString() } : message));
    };
    const onDeleted = (event: { id: string; groupId: string; deletedAt?: string | null }) => {
      setMessages(current => current.map(message => message.id === event.id ? { ...message, text: "", images: [], imageUrl: "", audioUrl: "", deletedForEveryone: true, deletedAt: event.deletedAt || new Date().toISOString() } : message));
    };
    const onReaction = (event: { id: string; groupId: string; reactions: GroupReaction[] }) => {
      setMessages(current => current.map(message => message.id === event.id ? { ...message, reactions: event.reactions || [] } : message));
    };
    const onUpdated = (event: { groupId?: string }) => {
      void loadGroups(tabRef.current, false);
      if (event?.groupId && activeGroupIdRef.current === event.groupId) refreshDetailsRef.current();
    };
    const onMembersUpdated = (event: { groupId: string }) => {
      if (activeGroupIdRef.current === event.groupId) refreshDetailsRef.current();
      void loadGroups(tabRef.current, false);
    };
    const onGroupDeleted = (event: { groupId: string }) => {
      void loadGroups(tabRef.current, false);
      if (activeGroupIdRef.current === event.groupId) {
        setActiveGroupId("");
        setActiveGroup(null);
        setMessages([]);
        setMobileChatOpen(false);
        setNotice("This group is no longer available.");
        if (window.location.pathname !== "/groups") navigate("/groups");
      }
    };
    const onTyping = (event: { groupId: string; userId: string; name: string; isTyping: boolean }) => {
      if (event.groupId !== activeGroupIdRef.current || event.userId === currentUserId) return;
      if (typingHideTimerRef.current !== null) window.clearTimeout(typingHideTimerRef.current);
      setTypingLabel(event.isTyping ? (event.name || "A member") + " is typing…" : "");
      if (event.isTyping) typingHideTimerRef.current = window.setTimeout(() => setTypingLabel(""), 2400);
    };
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("groups:message", onMessage);
    socket.on("groups:message-edited", onEdited);
    socket.on("groups:message-deleted", onDeleted);
    socket.on("groups:reaction", onReaction);
    socket.on("groups:updated", onUpdated);
    socket.on("groups:members-updated", onMembersUpdated);
    socket.on("groups:deleted", onGroupDeleted);
    socket.on("groups:typing", onTyping);
    return () => {
      if (typingTimerRef.current !== null) window.clearTimeout(typingTimerRef.current);
      if (typingHideTimerRef.current !== null) window.clearTimeout(typingHideTimerRef.current);
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [currentUserId, loadGroups]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!activeGroupId || !socketConnected || !socket) return;
    socket.timeout(10000).emit("groups:join-room", { groupId: activeGroupId }, (timeoutError: Error | null, response: { ok?: boolean; message?: string }) => {
      if (timeoutError || !response?.ok) setError(response?.message || "The live group connection couldn't be opened.");
    });
    return () => {
      socket.emit("groups:typing", { groupId: activeGroupId, isTyping: false });
      socket.emit("groups:leave-room", { groupId: activeGroupId });
    };
  }, [activeGroupId, socketConnected]);

  useEffect(() => {
    const list = messageListRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, messagesLoading, activeGroupId]);

  async function uploadGroupImage(file: File, savedToken: string): Promise<string> {
    const authResponse = await fetch(apiBase + "/api/media/imagekit-auth", { headers: { Authorization: "Bearer " + savedToken } });
    const auth = await authResponse.json().catch(() => ({})) as Record<string, any>;
    if (authResponse.status === 401) {
      localStorage.removeItem("hallschat_token");
      navigate("/signin", { replace: true });
      throw new Error("Please sign in again.");
    }
    if (!authResponse.ok) throw new Error(auth.message || "Image uploads are not configured yet.");
    const form = new FormData();
    form.append("file", file);
    form.append("fileName", "hallschat-group-" + Date.now() + "-" + file.name.replace(/[^a-zA-Z0-9._-]/g, "_"));
    form.append("publicKey", auth.publicKey);
    form.append("token", auth.token);
    form.append("expire", String(auth.expire));
    form.append("signature", auth.signature);
    const uploadedResponse = await fetch("https://upload.imagekit.io/api/v1/files/upload", { method: "POST", body: form });
    const uploaded = await uploadedResponse.json().catch(() => ({})) as Record<string, any>;
    if (!uploadedResponse.ok || typeof uploaded.url !== "string") throw new Error(uploaded.message || "The image couldn't be uploaded. Please try again.");
    return uploaded.url;
  }

  function handleImageSelection(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files || []);
    event.target.value = "";
    if (!picked.length) return;
    if (imageFiles.length + picked.length > MAX_GROUP_IMAGES) { setError("You can attach up to 4 images per group message."); return; }
    if (picked.some(file => !file.type.startsWith("image/"))) { setError("Choose image files only."); return; }
    if (picked.some(file => file.size > MAX_GROUP_IMAGE_SIZE)) { setError("Each image must be 10 MB or smaller."); return; }
    setImagePreviews(current => [...current, ...picked.map(file => URL.createObjectURL(file))]);
    setImageFiles(current => [...current, ...picked]);
    setError("");
  }

  function removeDraftImage(index: number) {
    const preview = imagePreviews[index];
    if (preview) URL.revokeObjectURL(preview);
    setImagePreviews(current => current.filter((_url, i) => i !== index));
    setImageFiles(current => current.filter((_file, i) => i !== index));
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const groupId = activeGroupId;
    const text = draft.trim();
    if (!groupId || sending || (!text && !imageFiles.length) || !activeGroup || !activeGroup.currentRole) return;
    const socket = socketRef.current;
    if (!socket?.connected) { setError("Reconnecting to group chat. Please try sending again."); return; }
    const savedToken = localStorage.getItem("hallschat_token");
    if (!savedToken) { navigate("/signin", { replace: true }); return; }
    setSending(true);
    setError("");
    try {
      const uploadedImages = await Promise.all(imageFiles.map(file => uploadGroupImage(file, savedToken)));
      const saved = await new Promise<GroupMessage>((resolve, reject) => {
        socket.timeout(20000).emit("groups:send", { groupId, text, images: uploadedImages }, (timeoutError: Error | null, response: { ok?: boolean; message?: GroupMessage | string }) => {
          if (timeoutError) { reject(new Error("The message timed out. Check your connection and try again.")); return; }
          if (!response?.ok) { reject(new Error(typeof response?.message === "string" ? response.message : "The message couldn't be sent.")); return; }
          if (!response.message || typeof response.message !== "object") { reject(new Error("The server didn't confirm the message.")); return; }
          resolve(response.message);
        });
      });
      setMessages(current => current.some(message => message.id === saved.id) ? current : [...current, saved]);
      setDraft("");
      imagePreviews.forEach(url => URL.revokeObjectURL(url));
      setImageFiles([]);
      setImagePreviews([]);
      if (draftInputRef.current) draftInputRef.current.style.height = "auto";
    } catch (err) {
      setError(err instanceof Error ? err.message : "The message couldn't be sent.");
    } finally {
      setSending(false);
    }
  }

  function handleDraftChange(value: string) {
    setDraft(value);
    if (!activeGroupId || !socketRef.current?.connected) return;
    socketRef.current.emit("groups:typing", { groupId: activeGroupId, isTyping: Boolean(value.trim()) });
    if (typingTimerRef.current !== null) window.clearTimeout(typingTimerRef.current);
    if (value.trim()) typingTimerRef.current = window.setTimeout(() => {
      socketRef.current?.emit("groups:typing", { groupId: activeGroupIdRef.current, isTyping: false });
      typingTimerRef.current = null;
    }, 1500);
  }

  async function createGroup(event: FormEvent) {
    event.preventDefault();
    if (creating) return;
    const name = createName.trim();
    if (name.length < 2 || name.length > 60) { setError("Group names must contain 2 to 60 characters."); return; }
    setCreating(true);
    setError("");
    try {
      const payload = await apiRequest<{ group: GroupSummary }>("/api/groups", {
        method: "POST", body: JSON.stringify({ name, description: createDescription.trim(), privacy: createPrivacy })
      });
      setCreateOpen(false);
      setCreateName("");
      setCreateDescription("");
      setCreatePrivacy("public");
      setTab("mine");
      setActiveGroupId(payload.group.id);
      setMobileChatOpen(true);
      setNotice("Your group is ready.");
      void loadGroups("mine");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That group couldn't be created.");
    } finally { setCreating(false); }
  }

  async function joinGroup(groupId: string) {
    setError("");
    try {
      await apiRequest("/api/groups/" + encodeURIComponent(groupId) + "/join", { method: "POST", body: JSON.stringify({}) });
      setTab("mine");
      setActiveGroupId(groupId);
      setMobileChatOpen(true);
      setNotice("You joined the group.");
      void loadGroups("mine");
    } catch (err) {
      setError(err instanceof Error ? err.message : "You couldn't join that group.");
    }
  }

  function openGroup(groupId: string) {
    setActiveGroupId(groupId);
    setMobileChatOpen(true);
    setDetailsOpen(false);
    setInviteOpen(false);
    setError("");
    setTypingLabel("");
  }

  function backToGroups() {
    if (socketRef.current?.connected && activeGroupId) {
      socketRef.current.emit("groups:typing", { groupId: activeGroupId, isTyping: false });
      socketRef.current.emit("groups:leave-room", { groupId: activeGroupId });
    }
    setActiveGroupId("");
    setActiveGroup(null);
    setMessages([]);
    setMobileChatOpen(false);
    setTypingLabel("");
    setDraft("");
    if (window.location.pathname !== "/groups") navigate("/groups");
  }

  async function saveGroupSettings(event: FormEvent) {
    event.preventDefault();
    if (!activeGroup || savingSettings) return;
    setSavingSettings(true);
    setError("");
    try {
      const body: Record<string, string> = { name: editName.trim(), description: editDescription.trim() };
      if (activeGroup.currentRole === "owner") body.privacy = editPrivacy;
      const payload = await apiRequest<{ group: GroupSummary }>("/api/groups/" + encodeURIComponent(activeGroup.id), {
        method: "PATCH", body: JSON.stringify(body)
      });
      setActiveGroup(payload.group);
      setEditOpen(false);
      void loadGroups(tabRef.current, false);
      setNotice("Group details updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Group settings couldn't be saved.");
    } finally { setSavingSettings(false); }
  }

  async function openInvites() {
    if (!activeGroup || (activeGroup.currentRole !== "owner" && activeGroup.currentRole !== "admin")) return;
    setInviteOpen(true);
    setInviteSelection([]);
    setInviteSearch("");
    setLoadingCandidates(true);
    try {
      const payload = await apiRequest<{ users?: HallPerson[] }>("/api/social/halls?view=followers");
      const existing = new Set((activeGroup.members || []).map(person => person.id));
      setInviteCandidates((Array.isArray(payload.users) ? payload.users : []).filter(person => !existing.has(person.id)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "People couldn't be loaded for invitations.");
    } finally { setLoadingCandidates(false); }
  }

  async function inviteMembers() {
    if (!activeGroup || !inviteSelection.length || inviting) return;
    setInviting(true);
    setError("");
    try {
      const payload = await apiRequest<{ group?: GroupSummary; addedCount?: number }>("/api/groups/" + encodeURIComponent(activeGroup.id) + "/members", {
        method: "POST", body: JSON.stringify({ userIds: inviteSelection })
      });
      if (payload.group) setActiveGroup(payload.group);
      setInviteOpen(false);
      setInviteSelection([]);
      setNotice((payload.addedCount || inviteSelection.length) + " member(s) added.");
      void loadGroups(tabRef.current, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Those members couldn't be added.");
    } finally { setInviting(false); }
  }

  async function changeMemberRole(member: GroupPerson, role: "admin" | "member") {
    if (!activeGroup || activeGroup.currentRole !== "owner" || member.id === activeGroup.ownerId) return;
    setMemberBusyId(member.id);
    setError("");
    try {
      const payload = await apiRequest<{ group: GroupSummary }>("/api/groups/" + encodeURIComponent(activeGroup.id) + "/members/" + encodeURIComponent(member.id) + "/role", {
        method: "PATCH", body: JSON.stringify({ role })
      });
      setActiveGroup(payload.group);
      setNotice(role === "admin" ? member.name + " is now a group admin." : member.name + " is now a member.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That role couldn't be changed.");
    } finally { setMemberBusyId(""); }
  }

  async function runPendingAction() {
    if (!pendingAction || confirmBusy) return;
    const action = pendingAction;
    setConfirmBusy(true);
    setError("");
    try {
      if (action.kind === "leave") {
        await apiRequest("/api/groups/" + encodeURIComponent(activeGroupId) + "/leave", { method: "POST", body: JSON.stringify({}) });
        setActiveGroupId("");
        setActiveGroup(null);
        setMessages([]);
        setDetailsOpen(false);
        setMobileChatOpen(false);
        setNotice("You left the group.");
        void loadGroups("mine");
      } else if (action.kind === "delete-group") {
        await apiRequest("/api/groups/" + encodeURIComponent(activeGroupId), { method: "DELETE" });
        setActiveGroupId("");
        setActiveGroup(null);
        setMessages([]);
        setDetailsOpen(false);
        setMobileChatOpen(false);
        setNotice("Group deleted.");
        void loadGroups("mine");
      } else if (action.kind === "remove-member") {
        const payload = await apiRequest<{ group: GroupSummary }>("/api/groups/" + encodeURIComponent(activeGroupId) + "/members/" + encodeURIComponent(action.memberId), { method: "DELETE" });
        setActiveGroup(payload.group);
        setNotice(action.memberName + " was removed from the group.");
      } else if (action.kind === "delete-message") {
        await apiRequest("/api/groups/" + encodeURIComponent(activeGroupId) + "/messages/" + encodeURIComponent(action.messageId), { method: "DELETE" });
      }
      setPendingAction(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "That action couldn't be completed.");
    } finally { setConfirmBusy(false); }
  }

  function beginEditMessage(message: GroupMessage) {
    setEditingMessageId(message.id);
    setEditMessageDraft(message.text);
    setError("");
  }

  async function saveMessageEdit(event: FormEvent, message: GroupMessage) {
    event.preventDefault();
    const text = editMessageDraft.trim();
    if (!text) { setError("A message cannot be empty."); return; }
    if (savingMessageEdit) return;
    setSavingMessageEdit(true);
    try {
      await apiRequest("/api/groups/" + encodeURIComponent(activeGroupId) + "/messages/" + encodeURIComponent(message.id), {
        method: "PATCH", body: JSON.stringify({ text })
      });
      setMessages(current => current.map(item => item.id === message.id ? { ...item, text, editedAt: new Date().toISOString() } : item));
      setEditingMessageId("");
      setEditMessageDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That message couldn't be edited.");
    } finally { setSavingMessageEdit(false); }
  }

  function reactToMessage(message: GroupMessage, emoji: string) {
    const socket = socketRef.current;
    if (!socket?.connected || !activeGroupId) { setError("Reconnect to group chat before reacting."); return; }
    socket.timeout(10000).emit("groups:react", { groupId: activeGroupId, messageId: message.id, emoji }, (timeoutError: Error | null, response: { ok?: boolean; message?: string; reactions?: GroupReaction[] }) => {
      if (timeoutError || !response?.ok) { setError(response?.message || "That reaction couldn't be saved."); return; }
      if (Array.isArray(response.reactions)) setMessages(current => current.map(item => item.id === message.id ? { ...item, reactions: response.reactions || [] } : item));
    });
  }

  const visibleGroups = groups.filter(group => {
    const query = search.trim().toLowerCase();
    return !query || group.name.toLowerCase().includes(query) || group.description.toLowerCase().includes(query) || (group.ownerName || "").toLowerCase().includes(query);
  });
  const filteredInviteCandidates = inviteCandidates.filter(person => {
    const query = inviteSearch.trim().toLowerCase();
    return !query || person.name.toLowerCase().includes(query) || person.username.toLowerCase().includes(query);
  });
  const canManageGroup = activeGroup?.currentRole === "owner" || activeGroup?.currentRole === "admin";
  const confirmCopy = pendingAction?.kind === "leave"
    ? { title: "Leave this group?", body: "You won't receive new group messages unless you're added again.", action: "Leave group" }
    : pendingAction?.kind === "delete-group"
      ? { title: "Delete this group?", body: "This permanently removes the group and its message history for every member.", action: "Delete group" }
      : pendingAction?.kind === "remove-member"
        ? { title: "Remove this member?", body: "They will lose access to this group's messages until invited again.", action: "Remove member" }
        : pendingAction?.kind === "delete-message"
          ? { title: "Delete this message?", body: "The message will be replaced with a deleted-message notice for everyone in the group.", action: "Delete message" }
          : null;

  return <main className={"home-page social-home chat-page groups-page" + (mobileChatOpen && activeGroupId ? " groups-page-chat-open" : "")}>
    <AppHeader homeHref="/home" />
    <section className="home-shell social-shell groups-shell">
      <div className={"groups-layout" + (mobileChatOpen && activeGroupId ? " groups-layout-chat-open" : "")}>
        <aside className="groups-sidebar" aria-label="Groups">
          <div className="groups-sidebar-top">
            <div className="groups-title-row"><div><span className="groups-eyebrow">YOUR CIRCLES</span><h1>Groups</h1></div><button type="button" className="groups-primary-icon" onClick={() => { setCreateOpen(true); setCreateName(""); setCreateDescription(""); setCreatePrivacy("public"); }} aria-label="Create a group" title="Create a group"><Plus size={19} /></button></div>
            <p className="groups-intro">Bring your people together in one shared conversation.</p>
            <div className="groups-tabs" role="tablist" aria-label="Group lists">
              <button type="button" role="tab" aria-selected={tab === "mine"} className={tab === "mine" ? "is-active" : ""} onClick={() => setTab("mine")}>My groups</button>
              <button type="button" role="tab" aria-selected={tab === "discover"} className={tab === "discover" ? "is-active" : ""} onClick={() => setTab("discover")}>Discover</button>
            </div>
            <label className="groups-search"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search groups" aria-label="Search groups" />{search && <button type="button" onClick={() => setSearch("")} aria-label="Clear group search"><X size={15} /></button>}</label>
          </div>
          <div className="groups-list" aria-live="polite">
            {loading ? <div className="groups-list-state"><LoadingDots /></div> : visibleGroups.length ? visibleGroups.map(group => <article key={group.id} className={"groups-card" + (activeGroupId === group.id ? " is-selected" : "")}>
              <button type="button" className="groups-card-main" onClick={() => tab === "discover" ? setNotice("Join this group to start chatting.") : openGroup(group.id)} aria-label={(tab === "discover" ? "View " : "Open ") + group.name}>
                <span className="groups-card-avatar">{group.imageUrl ? <img src={group.imageUrl} alt="" loading="lazy" /> : <UsersRound size={21} />}</span>
                <span className="groups-card-copy"><strong>{group.name}</strong><small>{group.memberCount} {group.memberCount === 1 ? "member" : "members"} · {group.privacy === "private" ? "Private" : "Public"}</small><span>{group.lastMessagePreview || group.description || (group.currentRole === "owner" ? "You created this group" : "Start the conversation")}</span></span>
                <span className="groups-card-time">{formatTime(group.lastMessageAt)}</span>
              </button>
              {tab === "discover" && <button type="button" className="groups-join-button" onClick={() => void joinGroup(group.id)}><Plus size={14} /> Join</button>}
            </article>) : <div className="groups-list-empty"><span><UsersRound size={25} /></span><strong>{search ? "No matching groups" : tab === "mine" ? "Your groups start here" : "Nothing to discover yet"}</strong><p>{search ? "Try another name or a shorter search." : tab === "mine" ? "Create a group for your people, or explore public groups to join the conversation." : "Public groups will appear here when the community creates them."}</p>{!search && tab === "mine" && <button type="button" className="groups-secondary-button" onClick={() => setCreateOpen(true)}><Plus size={15} /> Create group</button>}</div>}
          </div>
          <div className="groups-sidebar-footer"><span className={socketConnected ? "groups-online-dot" : "groups-offline-dot"} />{socketConnected ? "Live connection ready" : "Connecting to live chat"}</div>
        </aside>

        <section className="groups-conversation" aria-label="Group conversation">
          {activeGroupId && activeGroup ? <>
            <header className="groups-conversation-header">
              <button className="groups-back-button" type="button" onClick={backToGroups} aria-label="Back to groups"><ArrowLeft size={19} /></button>
              <button type="button" className="groups-conversation-identity" onClick={() => setDetailsOpen(true)} aria-label="View group details">
                <span className="groups-header-avatar">{activeGroup.imageUrl ? <img src={activeGroup.imageUrl} alt="" /> : <UsersRound size={20} />}</span>
                <span><strong>{activeGroup.name}</strong><small>{activeGroup.memberCount} members · {activeGroup.privacy === "private" ? "Private group" : "Public group"}</small></span>
              </button>
              <button type="button" className="groups-header-action" onClick={() => setDetailsOpen(true)} aria-label="Group members and settings" title="Members and settings"><UsersRound size={18} /></button>
              {canManageGroup && <button type="button" className="groups-header-action" onClick={() => { setEditName(activeGroup.name); setEditDescription(activeGroup.description); setEditPrivacy(activeGroup.privacy); setEditOpen(true); }} aria-label="Edit group settings" title="Edit group settings"><Pencil size={17} /></button>}
            </header>
            {activeGroup.description && <div className="groups-description-strip">{activeGroup.description}</div>}
            <div className="groups-message-list" ref={messageListRef}>
              {messagesLoading ? <div className="groups-message-loading"><LoadingDots /></div> : messages.length ? messages.map(message => {
                const mine = message.senderId === currentUserId;
                const canDelete = mine || activeGroup.currentRole === "owner" || activeGroup.currentRole === "admin";
                return <article key={message.id} className={"groups-message-row" + (mine ? " is-mine" : "")} id={"group-message-" + message.id}>
                  {!mine && <PersonAvatar person={message.sender} size={29} />}
                  <div className="groups-message-stack">
                    {!mine && <span className="groups-message-sender">{message.sender?.name || message.sender?.username || "Group member"}</span>}
                    <div className={"groups-message-bubble" + (mine ? " is-mine" : "")}>
                      {message.deletedForEveryone ? <p className="groups-deleted-message"><Trash2 size={13} /> This message was deleted</p> : <>
                        {!!(message.images?.length || message.imageUrl) && <div className={"groups-message-images" + ((message.images?.length || 1) === 1 ? " is-single" : "")}>{(message.images?.length ? message.images : message.imageUrl ? [message.imageUrl] : []).map((url, index) => <button key={url + index} type="button" onClick={() => setViewingImageUrl(url)} aria-label="View shared image"><img src={url} alt="Shared in group" loading="lazy" /></button>)}</div>}
                        {message.text && (editingMessageId === message.id ? <form className="groups-edit-message-form" onSubmit={event => void saveMessageEdit(event, message)}><textarea value={editMessageDraft} onChange={event => setEditMessageDraft(event.target.value)} rows={2} maxLength={4000} autoFocus aria-label="Edit group message" /><div><button type="button" onClick={() => { setEditingMessageId(""); setEditMessageDraft(""); }}>Cancel</button><button type="submit" disabled={savingMessageEdit || !editMessageDraft.trim()}>{savingMessageEdit ? <LoadingDots /> : "Save"}</button></div></form> : <p>{message.text}</p>)}
                        {message.audioUrl && <audio controls preload="metadata" src={message.audioUrl} className="groups-audio-message" />}
                      </>}
                      <div className="groups-message-footer"><time>{formatTime(message.createdAt)}{message.editedAt && !message.deletedForEveryone ? " · Edited" : ""}</time>{!message.deletedForEveryone && <span className="groups-message-tools">{mine && message.text && !message.images?.length && !message.audioUrl && <button type="button" onClick={() => beginEditMessage(message)} aria-label="Edit message" title="Edit message"><Pencil size={12} /></button>}{canDelete && <button type="button" onClick={() => setPendingAction({ kind: "delete-message", messageId: message.id })} aria-label="Delete message" title="Delete message"><Trash2 size={12} /></button>}</span>}</div>
                    </div>
                    {!message.deletedForEveryone && <div className="groups-reactions">{reactionChoices.map(emoji => {
                      const count = (message.reactions || []).filter(reaction => reaction.emoji === emoji).length;
                      const selected = (message.reactions || []).some(reaction => reaction.userId === currentUserId && reaction.emoji === emoji);
                      return <button key={emoji} type="button" className={selected ? "is-selected" : ""} onClick={() => reactToMessage(message, emoji)} aria-label={"React " + emoji + (count ? " " + count : "")}>{emoji}{count ? <small>{count}</small> : null}</button>;
                    })}</div>}
                  </div>
                </article>;
              }) : <div className="groups-empty-conversation"><span><MessageCircle size={25} /></span><strong>Say hello to the group</strong><p>Your group chat starts with one message. Share an update, ask a question, or send a photo.</p></div>}
              {typingLabel && <div className="groups-typing-indicator"><span /><span /><span /> {typingLabel}</div>}
            </div>
            {activeGroup.currentRole ? <><input ref={imageInputRef} type="file" accept="image/*" multiple hidden onChange={handleImageSelection} />
              {imagePreviews.length > 0 && <div className="groups-pending-images">{imagePreviews.map((url, index) => <div key={url} className="groups-pending-image"><img src={url} alt="Ready to send" /><button type="button" onClick={() => removeDraftImage(index)} aria-label="Remove attachment"><X size={13} /></button></div>)}</div>}
              <form className="groups-composer" onSubmit={event => void sendMessage(event)}>
                <button type="button" className="groups-attach-button" onClick={() => imageInputRef.current?.click()} disabled={sending || imageFiles.length >= MAX_GROUP_IMAGES} aria-label="Attach photos" title="Attach photos"><ImageIcon size={20} /></button>
                <textarea ref={draftInputRef} value={draft} onChange={event => handleDraftChange(event.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); if (!sending && (draft.trim() || imageFiles.length)) void sendMessage(event as unknown as FormEvent); } }} placeholder={"Message " + activeGroup.name} rows={1} maxLength={4000} aria-label="Write a group message" />
                <button type="submit" className="groups-send-button" disabled={sending || (!draft.trim() && !imageFiles.length)} aria-label="Send group message" title="Send message">{sending ? <LoadingDots /> : <Send size={17} />}</button>
              </form>
            </> : <div className="groups-join-notice">You need to be a member to send messages.</div>}
          </> : <div className="groups-welcome"><span><UsersRound size={29} /></span><h2>Better conversations happen together.</h2><p>Choose one of your groups to open its chat, or discover a public group and join in.</p><button type="button" onClick={() => setCreateOpen(true)}><Plus size={16} /> Create a group</button></div>}
        </section>
      </div>
    </section>
    <NowBar />

    {(error || notice) && <div className={"groups-toast" + (error ? " is-error" : "")} role={error ? "alert" : "status"}><span>{error || notice}</span>{error && <button type="button" onClick={() => { setError(""); if (activeGroupId) { void loadGroupDetails(activeGroupId); } else { void loadGroups(tab); } }} aria-label="Retry">↻</button>}<button type="button" onClick={() => { setError(""); setNotice(""); }} aria-label="Dismiss notification"><X size={15} /></button></div>}

    {createOpen && <div className="groups-modal-backdrop" onClick={() => setCreateOpen(false)}><section className="groups-modal" role="dialog" aria-modal="true" aria-labelledby="groups-create-title" onClick={event => event.stopPropagation()}>
      <header><span className="groups-modal-icon"><UsersRound size={20} /></span><div><h2 id="groups-create-title">Create a group</h2><p>Start a shared space for your people.</p></div><button type="button" onClick={() => setCreateOpen(false)} aria-label="Close create group"><X size={18} /></button></header>
      <form onSubmit={event => void createGroup(event)} className="groups-form">
        <label>Group name<input value={createName} onChange={event => setCreateName(event.target.value)} maxLength={60} minLength={2} placeholder="e.g. The Weekend Crew" required autoFocus /></label>
        <label>Description <small>Optional</small><textarea value={createDescription} onChange={event => setCreateDescription(event.target.value)} maxLength={500} rows={3} placeholder="What brings this group together?" /></label>
        <div className="groups-privacy-picker"><button type="button" className={createPrivacy === "public" ? "is-active" : ""} onClick={() => setCreatePrivacy("public")}><Globe2 size={17} /><span><strong>Public</strong><small>Anyone can discover and join.</small></span>{createPrivacy === "public" && <Check size={16} />}</button><button type="button" className={createPrivacy === "private" ? "is-active" : ""} onClick={() => setCreatePrivacy("private")}><LockKeyhole size={17} /><span><strong>Private</strong><small>Only invited members can join.</small></span>{createPrivacy === "private" && <Check size={16} />}</button></div>
        <div className="groups-modal-actions"><button type="button" className="groups-cancel-button" onClick={() => setCreateOpen(false)}>Cancel</button><button type="submit" className="groups-confirm-button" disabled={creating || createName.trim().length < 2}>{creating ? <LoadingDots /> : <><Plus size={16} /> Create group</>}</button></div>
      </form>
    </section></div>}

    {detailsOpen && activeGroup && <div className="groups-modal-backdrop" onClick={() => setDetailsOpen(false)}><section className="groups-modal groups-members-modal" role="dialog" aria-modal="true" aria-labelledby="groups-members-title" onClick={event => event.stopPropagation()}>
      <header><span className="groups-modal-icon">{activeGroup.privacy === "private" ? <LockKeyhole size={20} /> : <UsersRound size={20} />}</span><div><h2 id="groups-members-title">{activeGroup.name}</h2><p>{activeGroup.memberCount} members · {activeGroup.privacy === "private" ? "Private group" : "Public group"}</p></div><button type="button" onClick={() => setDetailsOpen(false)} aria-label="Close group details"><X size={18} /></button></header>
      {activeGroup.description && <p className="groups-modal-description">{activeGroup.description}</p>}
      <div className="groups-members-heading"><strong>Members</strong><span>{(activeGroup.members || []).length}</span></div>
      <div className="groups-members-list">{(activeGroup.members || []).map(member => <div className="groups-member-row" key={member.id}>
        <PersonAvatar person={member} size={38} /><div className="groups-member-copy"><strong>{member.name}</strong><small>@{member.username || "member"} · {member.isOnline ? "Online" : "Offline"}</small></div>
        <span className={"groups-role-badge role-" + (member.role || "member")}>{member.role === "owner" ? <><Crown size={11} /> Owner</> : member.role === "admin" ? <><ShieldCheck size={11} /> Admin</> : "Member"}</span>
        {activeGroup.currentRole === "owner" && member.id !== activeGroup.ownerId && <select aria-label={"Change role for " + member.name} value={member.role === "admin" ? "admin" : "member"} disabled={memberBusyId === member.id} onChange={event => void changeMemberRole(member, event.target.value === "admin" ? "admin" : "member")}><option value="member">Member</option><option value="admin">Admin</option></select>}
        {canManageGroup && member.id !== currentUserId && member.id !== activeGroup.ownerId && (activeGroup.currentRole === "owner" || member.role !== "admin") && <button className="groups-remove-member" type="button" disabled={memberBusyId === member.id} onClick={() => setPendingAction({ kind: "remove-member", memberId: member.id, memberName: member.name })} aria-label={"Remove " + member.name} title="Remove member"><X size={15} /></button>}
      </div>)}</div>
      <div className="groups-modal-actions groups-member-actions">
        {canManageGroup && <button type="button" className="groups-cancel-button" onClick={() => void openInvites()}><UserPlus size={15} /> Add people</button>}
        {activeGroup.currentRole === "owner" ? <button type="button" className="groups-danger-button" onClick={() => setPendingAction({ kind: "delete-group" })}><Trash2 size={15} /> Delete group</button> : activeGroup.currentRole && <button type="button" className="groups-danger-button" onClick={() => setPendingAction({ kind: "leave" })}><LogOut size={15} /> Leave group</button>}
      </div>
    </section></div>}

    {editOpen && activeGroup && <div className="groups-modal-backdrop" onClick={() => setEditOpen(false)}><section className="groups-modal" role="dialog" aria-modal="true" aria-labelledby="groups-edit-title" onClick={event => event.stopPropagation()}>
      <header><span className="groups-modal-icon"><Pencil size={19} /></span><div><h2 id="groups-edit-title">Group settings</h2><p>Keep your group details up to date.</p></div><button type="button" onClick={() => setEditOpen(false)} aria-label="Close group settings"><X size={18} /></button></header>
      <form className="groups-form" onSubmit={event => void saveGroupSettings(event)}>
        <label>Group name<input value={editName} onChange={event => setEditName(event.target.value)} maxLength={60} minLength={2} required /></label>
        <label>Description<textarea value={editDescription} onChange={event => setEditDescription(event.target.value)} maxLength={500} rows={3} /></label>
        {activeGroup.currentRole === "owner" && <div className="groups-privacy-picker"><button type="button" className={editPrivacy === "public" ? "is-active" : ""} onClick={() => setEditPrivacy("public")}><Globe2 size={17} /><span><strong>Public</strong><small>Discoverable by other members.</small></span>{editPrivacy === "public" && <Check size={16} />}</button><button type="button" className={editPrivacy === "private" ? "is-active" : ""} onClick={() => setEditPrivacy("private")}><LockKeyhole size={17} /><span><strong>Private</strong><small>Invite-only access.</small></span>{editPrivacy === "private" && <Check size={16} />}</button></div>}
        <div className="groups-modal-actions"><button type="button" className="groups-cancel-button" onClick={() => setEditOpen(false)}>Cancel</button><button type="submit" className="groups-confirm-button" disabled={savingSettings || editName.trim().length < 2}>{savingSettings ? <LoadingDots /> : <><Check size={16} /> Save changes</>}</button></div>
      </form>
    </section></div>}

    {inviteOpen && activeGroup && <div className="groups-modal-backdrop" onClick={() => setInviteOpen(false)}><section className="groups-modal groups-invite-modal" role="dialog" aria-modal="true" aria-labelledby="groups-invite-title" onClick={event => event.stopPropagation()}>
      <header><span className="groups-modal-icon"><UserPlus size={20} /></span><div><h2 id="groups-invite-title">Add people</h2><p>Invite followers to {activeGroup.name}.</p></div><button type="button" onClick={() => setInviteOpen(false)} aria-label="Close add people"><X size={18} /></button></header>
      <label className="groups-search groups-invite-search"><Search size={16} /><input value={inviteSearch} onChange={event => setInviteSearch(event.target.value)} placeholder="Find a follower" aria-label="Search followers" /></label>
      <div className="groups-invite-list">{loadingCandidates ? <div className="groups-list-state"><LoadingDots /></div> : filteredInviteCandidates.length ? filteredInviteCandidates.map(person => {
        const checked = inviteSelection.includes(person.id);
        return <button type="button" className={"groups-invite-person" + (checked ? " is-selected" : "")} key={person.id} onClick={() => setInviteSelection(current => checked ? current.filter(id => id !== person.id) : current.length >= 50 ? current : [...current, person.id])}><PersonAvatar person={person} size={37} /><span><strong>{person.name}</strong><small>@{person.username}</small></span><span className="groups-checkbox">{checked && <Check size={14} />}</span></button>;
      }) : <p className="groups-invite-empty">No new followers to add right now.</p>}</div>
      <div className="groups-modal-actions"><button type="button" className="groups-cancel-button" onClick={() => setInviteOpen(false)}>Cancel</button><button type="button" className="groups-confirm-button" disabled={!inviteSelection.length || inviting} onClick={() => void inviteMembers()}>{inviting ? <LoadingDots /> : <><UserPlus size={15} /> Add {inviteSelection.length || ""} {inviteSelection.length === 1 ? "person" : "people"}</>}</button></div>
    </section></div>}

    {pendingAction && confirmCopy && <div className="groups-modal-backdrop" onClick={() => !confirmBusy && setPendingAction(null)}><section className="groups-modal groups-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="groups-confirm-title" onClick={event => event.stopPropagation()}>
      <span className="groups-danger-icon"><ShieldCheck size={22} /></span><h2 id="groups-confirm-title">{confirmCopy.title}</h2><p>{confirmCopy.body}</p>
      <div className="groups-modal-actions"><button type="button" className="groups-cancel-button" disabled={confirmBusy} onClick={() => setPendingAction(null)}>Cancel</button><button type="button" className="groups-danger-button" disabled={confirmBusy} onClick={() => void runPendingAction()}>{confirmBusy ? <LoadingDots /> : confirmCopy.action}</button></div>
    </section></div>}

    {viewingImageUrl && <div className="groups-image-viewer" role="dialog" aria-modal="true" aria-label="Shared image preview" onClick={() => setViewingImageUrl("")}><button type="button" onClick={() => setViewingImageUrl("")} aria-label="Close image preview"><X size={22} /></button><a href={viewingImageUrl} download target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()} aria-label="Open or download image"><img src={viewingImageUrl} alt="Shared in group" onClick={event => event.stopPropagation()} /></a></div>}
  </main>;
}
