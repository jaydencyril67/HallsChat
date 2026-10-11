import { useEffect, useMemo, useState } from "react";
import { Search, Phone, Video, ArrowUpRight, Users, PhoneCall } from "lucide-react";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import AppHeader from "./AppHeader";
import NowBar from "./NowBar";
import CallsPanel from "./components/CallsPanel";
import { navigate } from "./utils/navigate";

type CallPerson = {
  id: string;
  name: string;
  username: string;
  profilePicture?: string;
  isOnline?: boolean;
  canMessage: boolean;
  lastMessage?: string;
};

const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase() || "H";
}

export default function CallsPage() {
  const [people, setPeople] = useState<CallPerson[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [socket, setSocket] = useState<Socket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const savedToken = localStorage.getItem("hallschat_token");
    if (!savedToken) {
      navigate("/signin", { replace: true });
      return;
    }
    let cancelled = false;
    const connection = io(apiBase, {
      auth: { token: savedToken },
      transports: ["websocket", "polling"]
    });
    setSocket(connection);
    connection.on("connect_error", () => {
      if (!cancelled) setError("Can't connect to calling right now. Check your connection and retry.");
    });

    fetch(`${apiBase}/api/chat/people`, {
      headers: { Authorization: `Bearer ${savedToken}` }
    })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (response.status === 401) {
          localStorage.removeItem("hallschat_token");
          navigate("/signin", { replace: true });
          throw new Error("Your session expired. Sign in again.");
        }
        if (!response.ok) throw new Error(payload.message || "Couldn't load your people.");
        return Array.isArray(payload.people) ? payload.people as CallPerson[] : [];
      })
      .then(nextPeople => {
        if (cancelled) return;
        setPeople(nextPeople);
        const requested = new URLSearchParams(window.location.search).get("user");
        const requestedPerson = requested && nextPeople.find(person => person.id === requested && person.canMessage);
        const firstAvailable = nextPeople.find(person => person.canMessage);
        setSelectedId(requestedPerson?.id || firstAvailable?.id || "");
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load your people.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => {
      cancelled = true;
      connection.disconnect();
    };
  }, []);

  const filteredPeople = useMemo(() => {
    const term = query.trim().toLowerCase();
    return people.filter(person => !term || person.name.toLowerCase().includes(term) || person.username.toLowerCase().includes(term));
  }, [people, query]);
  const selectedPerson = people.find(person => person.id === selectedId && person.canMessage) || null;

  return <main className="home-page social-home halls-calls-page">
    <AppHeader homeHref="/home" />
    <section className="home-shell social-shell halls-calls-shell">
      <div className="halls-calls-heading">
        <div className="halls-calls-heading-icon"><PhoneCall size={21} /></div>
        <div><p className="halls-calls-kicker">STAY CONNECTED</p><h1>Calls</h1><p>Choose someone to start an audio or video call.</p></div>
      </div>

      <div className="halls-calls-layout">
        <section className="halls-calls-people">
          <label className="halls-calls-search">
            <Search size={17} />
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search people…" aria-label="Search people to call" />
          </label>
          {loading ? <div className="halls-calls-empty"><span className="halls-calls-spinner" />Loading your people…</div> :
            filteredPeople.length ? <div className="halls-calls-list">
              {filteredPeople.map(person => <button type="button" key={person.id} className={selectedId === person.id ? "halls-calls-person is-selected" : "halls-calls-person"} onClick={() => setSelectedId(person.id)} disabled={!person.canMessage}>
                <span className="halls-calls-person-avatar">{person.profilePicture ? <img src={person.profilePicture} alt="" /> : initials(person.name)}<i className={person.isOnline ? "is-online" : ""} /></span>
                <span className="halls-calls-person-copy"><strong>{person.name}</strong><small>@{person.username}</small><em>{person.canMessage ? (person.isOnline ? "Online now" : "Available to call") : "Messaging unavailable"}</em></span>
                <ArrowUpRight size={17} />
              </button>)}
            </div> : <div className="halls-calls-empty"><Users size={24} /><strong>{query ? "No matches" : "No people to call yet"}</strong><span>{query ? "Try another name or username." : "Start a conversation with someone first, and they'll appear here."}</span><button type="button" onClick={() => navigate("/chats")}>Open chats</button></div>}
        </section>

        <section className="halls-calls-detail">
          {selectedPerson ? <>
            <div className="halls-calls-selected-avatar">{selectedPerson.profilePicture ? <img src={selectedPerson.profilePicture} alt="" /> : initials(selectedPerson.name)}</div>
            <span className={selectedPerson.isOnline ? "halls-calls-status is-online" : "halls-calls-status"}><i />{selectedPerson.isOnline ? "ONLINE" : "READY TO CALL"}</span>
            <h2>{selectedPerson.name}</h2><p className="halls-calls-username">@{selectedPerson.username}</p>
            <p className="halls-calls-instruction">Choose how you want to reach them.</p>
            <div className="halls-calls-methods">
              <div className="halls-calls-method halls-calls-method-audio"><span><Phone size={20} /></span><div><strong>Audio call</strong><small>Talk with voice</small></div></div>
              <div className="halls-calls-method halls-calls-method-video"><span><Video size={20} /></span><div><strong>Video call</strong><small>Talk face to face</small></div></div>
            </div>
            <CallsPanel socket={socket} person={selectedPerson} />
            <button type="button" className="halls-calls-chat-link" onClick={() => navigate("/chats?user=" + encodeURIComponent(selectedPerson.id))}>Open conversation</button>
          </> : <div className="halls-calls-empty"><Phone size={25} /><strong>Select someone</strong><span>Pick a person from the list to see the calling options.</span></div>}
        </section>
      </div>
      {error && <p className="halls-calls-error" role="status">{error}</p>}
      <p className="halls-calls-note">For calls to connect, both people need a supported browser/app and microphone permission. Incoming calls while HallsChat is closed still require push-notification and Android integration.</p>
    </section>
    <NowBar />
  </main>;
}
