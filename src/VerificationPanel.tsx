import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, ShieldCheck, Clock3, Send, Check, X, Mail } from "lucide-react";
import LoadingDots from "./components/LoadingDots";
import VerificationBadge from "./VerificationBadge";

const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");
type RequestItem = { id: string; name: string; username: string; email: string; requestedAt: string | null };
type StatusPayload = { status: "none" | "pending" | "verified" | "rejected"; requestedAt?: string | null; verifiedAt?: string | null; reviewNote?: string; canReview?: boolean; requests?: RequestItem[]; eligible?: boolean; eligibilityMessage?: string };

export default function VerificationPanel() {
  const [data, setData] = useState<StatusPayload>({ status: "none" });
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const token = localStorage.getItem("hallschat_token");
    if (!token) return;
    try {
      const response = await fetch(apiBase + "/api/verification/me", { headers: { Authorization: "Bearer " + token } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Verification status could not be loaded.");
      setData(payload as StatusPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification status could not be loaded.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function sendCode() {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const token = localStorage.getItem("hallschat_token");
      if (!token) throw new Error("Please sign in again.");
      const response = await fetch(apiBase + "/api/verification/send-code", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({})
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "The email code could not be sent.");
      setCodeSent(true);
      setCode("");
      setMessage(payload.message || "A code has been sent to your email.");
    } catch (err) { setError(err instanceof Error ? err.message : "The email code could not be sent."); }
    finally { setBusy(false); }
  }

  async function submitRequest() {
    if (busy || !/^\d{6}$/.test(code.trim())) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const token = localStorage.getItem("hallschat_token");
      if (!token) throw new Error("Please sign in again.");
      const response = await fetch(apiBase + "/api/verification/request", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ code: code.trim() })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Your request could not be submitted.");
      setMessage(payload.message || "Your account has been submitted for review.");
      setCode(""); setCodeSent(false);
      setData(current => ({ ...current, status: "pending", requestedAt: new Date().toISOString() }));
    } catch (err) { setError(err instanceof Error ? err.message : "Your request could not be submitted."); }
    finally { setBusy(false); }
  }

  async function reviewRequest(item: RequestItem, decision: "approve" | "reject") {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const token = localStorage.getItem("hallschat_token");
      if (!token) throw new Error("Please sign in again.");
      const response = await fetch(apiBase + "/api/verification/requests/" + encodeURIComponent(item.id), {
        method: "PATCH", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ decision, note })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "This request could not be reviewed.");
      setMessage(payload.message || "Verification decision saved.");
      setData(current => ({ ...current, requests: (current.requests || []).filter(request => request.id !== item.id) }));
      if (decision === "approve" && item.id === localStorage.getItem("hallschat_user_id")) {
        setData(current => ({ ...current, status: "verified", verifiedAt: new Date().toISOString() }));
      }
    } catch (err) { setError(err instanceof Error ? err.message : "This request could not be reviewed."); }
    finally { setBusy(false); }
  }

  const panelStyle: React.CSSProperties = { border: "1px solid var(--theme-border)", borderRadius: 16, background: "var(--theme-surface)", padding: 16, color: "var(--theme-text-primary)" };
  const fieldStyle: React.CSSProperties = { display: "block", width: "100%", boxSizing: "border-box", padding: "11px 12px", border: "1px solid var(--theme-border-strong)", borderRadius: 10, background: "var(--theme-surface)", color: "var(--theme-text-primary)", font: "inherit", fontSize: ".9rem", letterSpacing: ".12em" };
  const buttonStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 40, padding: "10px 12px", border: "1px solid var(--theme-border)", borderRadius: 10, background: "var(--theme-action-secondary-bg)", color: "var(--theme-action-secondary-text)", font: "inherit", fontSize: ".8rem", fontWeight: 750, cursor: busy ? "wait" : "pointer" };

  return <section style={{ ...panelStyle, marginBottom: 17, display: "grid", gap: 12 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 38, height: 38, borderRadius: 12, display: "grid", placeItems: "center", background: "var(--theme-accent-soft)", color: "var(--theme-primary-hover)" }}><ShieldCheck size={20} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ display: "block", fontSize: ".92rem" }}>Account verification</strong>
        <span style={{ color: "var(--theme-muted)", fontSize: ".75rem" }}>Confirm your account by email</span>
      </div>
      {data.status === "verified" && <VerificationBadge size={22} />}
    </div>

    {data.status === "verified" ? <p style={{ margin: 0, color: "var(--theme-success)", fontSize: ".84rem", display: "flex", alignItems: "center", gap: 7 }}><BadgeCheck size={17} /> Your account is verified. Your full name and username are permanently locked.</p> :
      data.status === "pending" ? <p style={{ margin: 0, color: "var(--theme-primary-hover)", fontSize: ".84rem", display: "flex", alignItems: "center", gap: 7 }}><Clock3 size={17} /> Your verification request is waiting for review.</p> :
      <>
        <div style={{ padding: 12, border: "1px solid var(--theme-border)", borderRadius: 12, background: "var(--theme-card-raised)", fontSize: ".82rem", lineHeight: 1.55 }}>
          If your request is approved, your full name and username will become permanent and can never be changed. You must have had your account for at least 30 days, at least 100 followers, and at least 1,000 likes across your posts.
        </div>
        {data.eligible === false && data.eligibilityMessage && <p style={{ margin: 0, color: "var(--theme-muted)", fontSize: ".8rem", lineHeight: 1.5 }}>{data.eligibilityMessage}</p>}
        {data.status === "rejected" && data.reviewNote && <p style={{ margin: 0, color: "var(--theme-danger)", fontSize: ".8rem" }}>Review note: {data.reviewNote}</p>}
        {!codeSent ? <button type="button" onClick={() => void sendCode()} disabled={busy || data.eligible === false} style={{ ...buttonStyle, width: "100%", background: "var(--theme-primary)", color: "var(--theme-primary-contrast)", borderColor: "var(--theme-primary)", opacity: busy || data.eligible === false ? .6 : 1 }}>{busy ? <LoadingDots /> : <><Mail size={16} /> Confirm this account belongs to you</>}</button> :
          <form onSubmit={event => { event.preventDefault(); void submitRequest(); }} style={{ display: "grid", gap: 10 }}>
            <input aria-label="Email verification code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit email code" style={fieldStyle} />
            <button type="submit" disabled={busy || !/^\d{6}$/.test(code)} style={{ ...buttonStyle, width: "100%", background: "var(--theme-primary)", color: "var(--theme-primary-contrast)", borderColor: "var(--theme-primary)", opacity: busy || !/^\d{6}$/.test(code) ? .6 : 1 }}>{busy ? <LoadingDots /> : <><Send size={15} /> Submit verification request</>}</button>
            <button type="button" onClick={() => { setCodeSent(false); setCode(""); setMessage(""); }} disabled={busy} style={{ ...buttonStyle, width: "100%" }}>Cancel</button>
          </form>}
      </>}
    {message && <p role="status" style={{ margin: 0, color: "var(--theme-success)", fontSize: ".8rem" }}>{message}</p>}
    {error && <p role="alert" style={{ margin: 0, color: "var(--theme-danger)", fontSize: ".8rem" }}>{error}</p>}
    {data.canReview && <div style={{ display: "grid", gap: 10, borderTop: "1px solid var(--theme-border)", paddingTop: 13 }}>
      <strong style={{ fontSize: ".86rem" }}>Verification requests ({data.requests?.length || 0})</strong>
      <textarea aria-label="Optional reviewer note" value={note} onChange={event => setNote(event.target.value)} maxLength={500} rows={2} placeholder="Optional review note" style={{ ...fieldStyle, letterSpacing: "normal", resize: "vertical" }} />
      {(data.requests || []).length === 0 ? <p style={{ margin: 0, color: "var(--theme-muted)", fontSize: ".8rem" }}>No requests waiting for review.</p> : (data.requests || []).map(item => <article key={item.id} style={{ display: "grid", gap: 8, padding: 12, border: "1px solid var(--theme-border)", borderRadius: 12, background: "var(--theme-card-raised)" }}>
        <div><strong style={{ fontSize: ".85rem" }}>{item.name}</strong><span style={{ marginLeft: 6, color: "var(--theme-primary-hover)", fontSize: ".78rem" }}>@{item.username}</span><div style={{ color: "var(--theme-muted)", fontSize: ".72rem", overflowWrap: "anywhere" }}>{item.email}</div></div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" disabled={busy} onClick={() => void reviewRequest(item, "approve")} style={{ ...buttonStyle, flex: 1, background: "var(--theme-primary)", borderColor: "var(--theme-primary)", color: "var(--theme-primary-contrast)" }}>{busy ? <LoadingDots /> : <><Check size={15} /> Approve</>}</button>
          <button type="button" disabled={busy} onClick={() => void reviewRequest(item, "reject")} style={{ ...buttonStyle, flex: 1, color: "var(--theme-danger)" }}>{busy ? <LoadingDots /> : <><X size={15} /> Decline</>}</button>
        </div>
      </article>)}
      <button type="button" onClick={() => void load()} disabled={busy} style={buttonStyle}>Refresh requests</button>
    </div>}
  </section>;
}
