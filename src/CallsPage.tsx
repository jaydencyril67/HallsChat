import { useEffect, useMemo, useState } from "react";
import { Search, Phone, Video, ArrowDownLeft, ArrowUpRight, Clock3, PhoneCall, CalendarDays } from "lucide-react";
import AppHeader from "./AppHeader";
import VerificationBadge from "./VerificationBadge";
import NowBar from "./NowBar";
import LoadingDots from "./components/LoadingDots";
import { navigate } from "./utils/navigate";

type CallRecord = {
  id: string;
  person: { id: string; name: string; username: string; profilePicture?: string };
  direction: "incoming" | "outgoing";
  kind: "audio" | "video";
  status: "ringing" | "missed" | "declined" | "cancelled" | "completed" | "failed";
  durationSeconds: number;
  createdAt: string;
};

const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase() || "H";
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const clock = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (sameDay(date, today)) return `Today, ${clock}`;
  if (sameDay(date, yesterday)) return `Yesterday, ${clock}`;
  return `${date.toLocaleDateString([], { day: "numeric", month: "short" })}, ${clock}`;
}

function formatDuration(value: number) {
  const seconds = Math.max(0, Math.floor(value || 0));
  const minutes = Math.floor(seconds / 60);
  return minutes ? `${minutes} min ${seconds % 60} sec` : `${seconds} sec`;
}

function callSummary(call: CallRecord) {
  if (call.status === "missed") return call.direction === "incoming" ? "Missed" : "No answer";
  if (call.status === "declined") return "Rejected";
  if (call.status === "failed") return "Failed";
  if (call.status === "cancelled") return call.direction === "outgoing" ? "Dialed" : "Cancelled";
  if (call.status === "completed") return formatDuration(call.durationSeconds);
  if (call.status === "ringing") return "Ringing";
  return "No answer";
}

export default function CallsPage() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [filter, setFilter] = useState<"all" | "received" | "dialed" | "missed" | "rejected" | "failed">("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("hallschat_token");
    if (!token) {
      navigate("/signin", { replace: true });
      return;
    }
    let cancelled = false;
    fetch(`${apiBase}/api/calls/history`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (response.status === 401) {
          localStorage.removeItem("hallschat_token");
          navigate("/signin", { replace: true });
          throw new Error("Your session expired. Sign in again.");
        }
        if (!response.ok) throw new Error(payload.message || "Couldn't load your call history.");
        return Array.isArray(payload.calls) ? payload.calls as CallRecord[] : [];
      })
      .then(records => { if (!cancelled) setCalls(records); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load your call history."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const visibleCalls = useMemo(() => {
    const term = query.trim().toLowerCase();
    return calls.filter(call => {
      const isMissed = call.direction === "incoming" && call.status === "missed";
      const isRejected = call.status === "declined";
      const isFailed = call.status === "failed";
      const matchesFilter = filter === "all" || (filter === "received" && call.direction === "incoming") || (filter === "dialed" && call.direction === "outgoing") || (filter === "missed" && isMissed) || (filter === "rejected" && isRejected) || (filter === "failed" && isFailed);
      const matchesQuery = !term || call.person.name.toLowerCase().includes(term) || call.person.username.toLowerCase().includes(term);
      return matchesFilter && matchesQuery;
    });
  }, [calls, filter, query]);

  const missedCount = calls.filter(call => call.direction === "incoming" && call.status === "missed").length;
  const rejectedCount = calls.filter(call => call.status === "declined").length;
  const failedCount = calls.filter(call => call.status === "failed").length;
  const dialedCount = calls.filter(call => call.direction === "outgoing").length;
  const receivedCount = calls.filter(call => call.direction === "incoming").length;

  return <main className="home-page social-home halls-calls-page">
    <AppHeader homeHref="/home" />
    <section className="home-shell social-shell halls-calls-shell halls-call-history-shell theme-token-scope">
      <div className="halls-call-history-toolbar">
        <div className="halls-call-history-tabs" role="tablist" aria-label="Filter call history">
          <button type="button" role="tab" aria-selected={filter === "all"} className={filter === "all" ? "is-active" : ""} onClick={() => setFilter("all")}>All{calls.length > 0 && <span>{calls.length}</span>}</button>
          <button type="button" role="tab" aria-selected={filter === "received"} className={filter === "received" ? "is-active" : ""} onClick={() => setFilter("received")}>Received{receivedCount > 0 && <span>{receivedCount}</span>}</button>
          <button type="button" role="tab" aria-selected={filter === "dialed"} className={filter === "dialed" ? "is-active" : ""} onClick={() => setFilter("dialed")}>Dialed{dialedCount > 0 && <span>{dialedCount}</span>}</button>
          <button type="button" role="tab" aria-selected={filter === "missed"} className={filter === "missed" ? "is-active" : ""} onClick={() => setFilter("missed")}>Missed{missedCount > 0 && <span>{missedCount}</span>}</button>
          <button type="button" role="tab" aria-selected={filter === "rejected"} className={filter === "rejected" ? "is-active" : ""} onClick={() => setFilter("rejected")}>Rejected{rejectedCount > 0 && <span>{rejectedCount}</span>}</button>
          <button type="button" role="tab" aria-selected={filter === "failed"} className={filter === "failed" ? "is-active" : ""} onClick={() => setFilter("failed")}>Failed{failedCount > 0 && <span>{failedCount}</span>}</button>
        </div>
        <label className="halls-call-history-search"><Search size={16} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search call history" aria-label="Search call history" /></label>
      </div>

      <div className="halls-call-history-scroll">
        {loading ? <div className="halls-call-history-state"><LoadingDots /></div> :
          error ? <div className="halls-call-history-state halls-call-history-error"><Phone size={23} /><strong>Call history unavailable</strong><span>{error}</span><button type="button" onClick={() => window.location.reload()}>Try again</button></div> :
          visibleCalls.length ? <div className="halls-call-history-list">
            {visibleCalls.map(call => {
              const missed = call.direction === "incoming" && call.status === "missed";
              const rejected = call.status === "declined";
              const failed = call.status === "failed";
              const DirectionIcon = call.direction === "incoming" ? ArrowDownLeft : ArrowUpRight;
              const TypeIcon = call.kind === "video" ? Video : Phone;
              return <button type="button" className="halls-call-history-row" key={call.id} onClick={() => call.person.id && navigate("/rooms?user=" + encodeURIComponent(call.person.id))} disabled={!call.person.id}>
                <span className="halls-call-history-avatar">{call.person.profilePicture ? <img src={call.person.profilePicture} alt="" /> : initials(call.person.name)}</span>
                <span className="halls-call-history-copy">
                  <strong className={missed || rejected || failed ? "is-missed" : ""} style={{ display: "inline-flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>{call.person.name}{call.person.isVerified && call.person.verifiedAt && <VerificationBadge size={13} />}</strong>
                  <span className="halls-call-history-meta"><DirectionIcon size={15} className={missed || rejected || failed ? "is-missed" : call.direction === "incoming" ? "is-incoming" : "is-outgoing"} /><span>{call.direction === "incoming" ? "Incoming" : "Outgoing"} {call.kind} call</span><i>·</i><span className={missed || rejected || failed ? "is-missed" : ""}>{callSummary(call)}</span></span>
                </span>
                <span className="halls-call-history-time"><small>{formatTime(call.createdAt)}</small><TypeIcon size={17} /></span>
              </button>;
            })}
          </div> :
          <div className="halls-call-history-state">
            {filter === "missed" || filter === "rejected" || filter === "failed" ? <Phone size={24} /> : <CalendarDays size={24} />}
            <strong>{query ? "No matching calls"  : filter === "all" ? "No calls yet" : filter === "received" ? "No received calls" : filter === "dialed" ? "No dialed calls" : filter === "missed" ? "No missed calls" : filter === "rejected" ? "No rejected calls" : filter === "failed" ? "No failed calls" : "No calls yet"}</strong>
            <span>{query ? "Try another name or username." : filter === "missed" ? "You're all caught up. Missed calls will appear here." : filter === "all" ? "Your call history will appear here when you make or receive calls." : filter === "received" ? "Incoming calls you receive will appear here." : filter === "dialed" ? "Outgoing calls you place will appear here." : filter === "rejected" ? "Calls that are declined will appear here." : filter === "failed" ? "Calls that fail to connect will appear here." : "Your call history will appear here when you make or receive calls."}</span>
            {query && <button type="button" onClick={() => setQuery("")}>Clear search</button>}
          </div>}
        <p className="halls-call-history-note"><Clock3 size={13} /> Your call history is saved to your HallsChat account.</p>
      </div>
    </section>
    <NowBar />
  </main>;
}
