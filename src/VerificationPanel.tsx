import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, ExternalLink, ShieldCheck, Clock3, Send, Check, X } from "lucide-react";
import LoadingDots from "./components/LoadingDots";
import VerificationBadge from "./VerificationBadge";

const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");
type RequestItem = { id: string; name: string; username: string; email: string; reason: string; evidenceUrl: string; requestedAt: string | null };
type StatusPayload = { status: "none" | "pending" | "verified" | "rejected"; reason?: string; evidenceUrl?: string; requestedAt?: string | null; verifiedAt?: string | null; reviewNote?: string; canReview?: boolean; requests?: RequestItem[] };

export default function VerificationPanel() {
  const [data, setData] = useState<StatusPayload>({ status: "none" });
  const [reason, setReason] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
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
      if (payload.status === "rejected") {
        setReason(payload.reason || "");
        setEvidenceUrl(payload.evidenceUrl || "");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification status could not be loaded.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function submitRequest() {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const token = localStorage.getItem("hallschat_token");
      if (!token) throw new Error("Please sign in again.");
      const response = await fetch(apiBase + "/api/verification/request", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({ reason, evidenceUrl })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Your request could not be submitted.");
      setMessage(payload.message || "Verification request submitted.");
      setData(current => ({ ...current, status: "pending", reason, evidenceUrl, requestedAt: new Date().toISOString() }));
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
    } catch (err) { setError(err instanceof Error ? err.message : "This request could not be reviewed."); }
    finally { setBusy(false); }
  }

  const panelStyle: React.CSSProperties = { border: "1px solid var(--theme-border)", borderRadius: 16, background: "var(--theme-surface)", padding: 16, color: "var(--theme-text-primary)" };
  const fieldStyle: React.CSSProperties = { display: "block", width: "100%", boxSizing: "border-box", padding: "10px 11px", border: "1px solid var(--theme-border-strong)", borderRadius: 10, background: "var(--theme-surface)", color: "var(--theme-text-primary)", font: "inherit", fontSize: ".84rem" };
  const buttonStyle: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, minHeight: 38, padding: "9px 12px", border: "1px solid var(--theme-border)", borderRadius: 10, background: "var(--theme-action-secondary-bg)", color: "var(--theme-action-secondary-text)", font: "inherit", fontSize: ".78rem", fontWeight: 750, cursor: busy ? "wait" : "pointer" };

  return <section style={{ ...panelStyle, marginBottom: 17, display: "grid", gap: 12 }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ width: 38, height: 38, borderRadius: 12, display: "grid", placeItems: "center", background: "var(--theme-accent-soft)", color: "var(--theme-primary-hover)" }}><ShieldCheck size={20} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ display: "block", fontSize: ".92rem" }}>HallsChat verification</strong>
        <span style={{ color: "var(--theme-muted)", fontSize: ".75rem" }}>Authenticity review — separate from Premium</span>
      </div>
      {data.status === "verified" && <VerificationBadge size={22} />}
    </div>
    {data.status === "verified" ? <p style={{ margin: 0, color: "var(--theme-success)", fontSize: ".82rem", display: "flex", alignItems: "center", gap: 7 }}><BadgeCheck size={16} /> Your account is verified on HallsChat.</p> :
      data.status === "pending" ? <p style={{ margin: 0, color: "var(--theme-primary-hover)", fontSize: ".82rem", display: "flex", alignItems: "center", gap: 7 }}><Clock3 size={16} /> Your request is waiting for review.</p> :
      <div style={{ display: "grid", gap: 10 }}>
        {data.status === "rejected" && <p style={{ margin: 0, color: "var(--theme-danger)", fontSize: ".8rem" }}>Your previous request wasn't approved. You can revise it and apply again.{data.reviewNote ? " Reviewer note: " + data.reviewNote : ""}</p>}
        <p style={{ margin: 0, color: "var(--theme-muted)", fontSize: ".8rem", lineHeight: 1.55 }}>Tell us why people should be able to trust that this profile represents you or your organization. Verification is reviewed by HallsChat and cannot be purchased.</p>
        <textarea aria-label="Reason for verification" value={reason} onChange={event => setReason(event.target.value)} maxLength={1000} rows={3} placeholder="Explain why your account should be verified (20–1,000 characters)" style={{ ...fieldStyle, resize: "vertical" }} />
        <input aria-label="Evidence link" value={evidenceUrl} onChange={event => setEvidenceUrl(event.target.value)} maxLength={500} placeholder="Optional public evidence link (https://…)" style={fieldStyle} />
        <button type="button" onClick={() => void submitRequest()} disabled={busy || reason.trim().length < 20} style={{ ...buttonStyle, width: "100%", background: "var(--theme-primary)", color: "var(--theme-primary-contrast)", borderColor: "var(--theme-primary)", opacity: busy || reason.trim().length < 20 ? .6 : 1 }}>{busy ? <LoadingDots /> : <><Send size={15} /> Request verification</>}</button>
      </div>}
    {message && <p role="status" style={{ margin: 0, color: "var(--theme-success)", fontSize: ".8rem" }}>{message}</p>}
    {error && <p role="alert" style={{ margin: 0, color: "var(--theme-danger)", fontSize: ".8rem" }}>{error}</p>}
    {data.canReview && <div style={{ display: "grid", gap: 10, borderTop: "1px solid var(--theme-border)", paddingTop: 13 }}>
      <strong style={{ fontSize: ".86rem" }}>Pending verification requests ({data.requests?.length || 0})</strong>
      <textarea aria-label="Optional reviewer note" value={note} onChange={event => setNote(event.target.value)} maxLength={500} rows={2} placeholder="Optional note for the applicant" style={{ ...fieldStyle, resize: "vertical" }} />
      {(data.requests || []).length === 0 ? <p style={{ margin: 0, color: "var(--theme-muted)", fontSize: ".8rem" }}>No requests waiting for review.</p> : (data.requests || []).map(item => <article key={item.id} style={{ display: "grid", gap: 8, padding: 12, border: "1px solid var(--theme-border)", borderRadius: 12, background: "var(--theme-card-raised)" }}>
        <div><strong style={{ fontSize: ".85rem" }}>{item.name}</strong><span style={{ marginLeft: 6, color: "var(--theme-primary-hover)", fontSize: ".78rem" }}>@{item.username}</span><div style={{ color: "var(--theme-muted)", fontSize: ".72rem", overflowWrap: "anywhere" }}>{item.email}</div></div>
        <p style={{ margin: 0, fontSize: ".8rem", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{item.reason}</p>
        {item.evidenceUrl && <a href={item.evidenceUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--theme-primary-hover)", fontSize: ".78rem", overflowWrap: "anywhere" }}>Open evidence <ExternalLink size={13} /></a>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" disabled={busy} onClick={() => void reviewRequest(item, "approve")} style={{ ...buttonStyle, flex: 1, background: "var(--theme-primary)", borderColor: "var(--theme-primary)", color: "var(--theme-primary-contrast)" }}>{busy ? <LoadingDots /> : <><Check size={15} /> Approve</>}</button>
          <button type="button" disabled={busy} onClick={() => void reviewRequest(item, "reject")} style={{ ...buttonStyle, flex: 1, color: "var(--theme-danger)" }}>{busy ? <LoadingDots /> : <><X size={15} /> Decline</>}</button>
        </div>
      </article>)}
      <button type="button" onClick={() => void load()} disabled={busy} style={buttonStyle}>Refresh requests</button>
    </div>}
  </section>;
}
