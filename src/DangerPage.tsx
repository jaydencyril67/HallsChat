import { useEffect, useState } from "react";
import { ArrowLeft, ShieldAlert, ShieldCheck } from "lucide-react";
import AppHeader from "./AppHeader";
import NowBar from "./NowBar";
import LoadingDots from "./components/LoadingDots";
import { navigate } from "./utils/navigate";

const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");

type ActionState = { accessCode: string; confirmation: string; reason: string; durationDays: string };
const blankState = (): ActionState => ({ accessCode: "", confirmation: "", reason: "", durationDays: "" });

async function dangerRequest(path: string, body?: unknown) {
  const token = localStorage.getItem("hallschat_token");
  if (!token) throw new Error("Sign in again to manage account safety.");
  const response = await fetch(apiBase + path, {
    method: body === undefined ? "GET" : "PATCH",
    headers: { Authorization: "Bearer " + token, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const data = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) throw new Error(data.message || "Unable to complete the account action.");
  return data;
}

export default function DangerPage() {
  const [disable, setDisable] = useState<ActionState>(blankState);
  const [exclude, setExclude] = useState<ActionState>(blankState);
  const [busy, setBusy] = useState<"disable" | "exclude" | null>(null);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(""), 4500);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const submit = async (action: "disable" | "exclude") => {
    if (busy) return;
    const state = action === "disable" ? disable : exclude;
    setBusy(action); setMessage(""); setIsError(false);
    try {
      await dangerRequest(action === "disable" ? "/api/settings/danger/disable" : "/api/settings/danger/self-exclude", {
        securityCode: state.accessCode,
        confirmation: state.confirmation,
        reason: state.reason,
        ...(action === "exclude" ? { durationDays: Number(state.durationDays) } : {})
      });
      localStorage.removeItem("hallschat_token");
      window.dispatchEvent(new Event("hallschat:account-safety-logout"));
      navigate("/signin", { replace: true });
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "Unable to complete the account action.");
    } finally {
      setBusy(null);
    }
  };

  const inputStyle: React.CSSProperties = { width: "100%", minHeight: 43, boxSizing: "border-box", padding: "10px 12px", borderRadius: 11, border: "1px solid var(--theme-line)", background: "var(--theme-surface)", color: "var(--theme-text)", font: "inherit", fontSize: 13 };
  const labelStyle: React.CSSProperties = { display: "grid", gap: 6, marginTop: 12, color: "var(--theme-muted)", fontSize: 10, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" };
  const buttonStyle: React.CSSProperties = { width: "100%", minHeight: 42, marginTop: 12, border: "1px solid var(--theme-accent-border)", borderRadius: 999, padding: "10px 14px", background: "var(--theme-primary)", color: "var(--theme-primary-contrast)", fontSize: 12, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 };
  const cardStyle: React.CSSProperties = { minWidth: 0, padding: 16, border: "1px solid var(--theme-line)", borderRadius: 16, background: "var(--theme-surface)", display: "grid", gap: 5 };

  return <main className="home-page social-home settings-page theme-token-scope">
    <AppHeader homeHref="/home" />
    <section className="home-shell social-shell settings-shell" style={{ paddingBottom: 112 }}>
      <button type="button" onClick={() => navigate("/settings")} style={{ display: "inline-flex", alignItems: "center", gap: 7, minHeight: 34, padding: "6px 10px", marginBottom: 8, border: "1px solid var(--theme-line)", borderRadius: 9, background: "var(--theme-surface)", color: "var(--theme-text)", fontSize: 12, fontWeight: 750 }}><ArrowLeft size={15} /> Settings</button>
      <section style={{ ...cardStyle, marginBottom: 8 }}>
        <h1 style={{ margin: 0, fontSize: 17, fontWeight: 850 }}>Account safety</h1>
        <p style={{ margin: "4px 0 0", color: "var(--theme-muted)", fontSize: 12, lineHeight: 1.55 }}>These actions immediately end your HallsChat sessions. Use your six-digit KingsHall Access Code to confirm that you own the account.</p>
      </section>
      <section style={{ ...cardStyle, marginBottom: 8 }}>
        <ShieldAlert size={20} color="var(--theme-danger)" />
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 850 }}>Disable account</h2>
        <p style={{ margin: 0, color: "var(--theme-muted)", fontSize: 12, lineHeight: 1.55 }}>Suspend access until support restores your account. This does not delete your account.</p>
        <label style={labelStyle}>KingsHall Access Code<input style={inputStyle} type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={disable.accessCode} onChange={e => setDisable(v => ({ ...v, accessCode: e.target.value.replace(/\D/g, "").slice(0, 6) }))} /></label>
        <label style={labelStyle}>Confirmation<input style={inputStyle} value={disable.confirmation} onChange={e => setDisable(v => ({ ...v, confirmation: e.target.value }))} placeholder="DISABLE" autoComplete="off" /></label>
        <label style={labelStyle}>Reason (optional)<input style={inputStyle} value={disable.reason} onChange={e => setDisable(v => ({ ...v, reason: e.target.value }))} placeholder="Reason for disabling" maxLength={500} /></label>
        <button type="button" style={buttonStyle} disabled={busy !== null || disable.accessCode.length !== 6 || disable.confirmation.trim().toUpperCase() !== "DISABLE"} onClick={() => void submit("disable")}>{busy === "disable" ? <LoadingDots /> : "Disable account"}</button>
      </section>
      <section style={cardStyle}>
        <ShieldCheck size={20} color="var(--theme-danger)" />
        <h2 style={{ margin: 0, fontSize: 14, fontWeight: 850 }}>Self-exclude</h2>
        <p style={{ margin: 0, color: "var(--theme-muted)", fontSize: 12, lineHeight: 1.55 }}>Block access for the period you choose. Access can resume after the exclusion expires; support cannot shorten the selected period through this screen.</p>
        <label style={labelStyle}>KingsHall Access Code<input style={inputStyle} type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={exclude.accessCode} onChange={e => setExclude(v => ({ ...v, accessCode: e.target.value.replace(/\D/g, "").slice(0, 6) }))} /></label>
        <label style={labelStyle}>Confirmation<input style={inputStyle} value={exclude.confirmation} onChange={e => setExclude(v => ({ ...v, confirmation: e.target.value }))} placeholder="SELF EXCLUDE" autoComplete="off" /></label>
        <label style={labelStyle}>Exclusion duration (days)<input style={inputStyle} type="number" min={1} max={3650} step={1} value={exclude.durationDays} onChange={e => setExclude(v => ({ ...v, durationDays: e.target.value.replace(/\D/g, "").slice(0, 4) }))} placeholder="1–3650 days" /></label>
        <label style={labelStyle}>Reason (optional)<input style={inputStyle} value={exclude.reason} onChange={e => setExclude(v => ({ ...v, reason: e.target.value }))} placeholder="Reason for self-exclusion" maxLength={500} /></label>
        <button type="button" style={buttonStyle} disabled={busy !== null || exclude.accessCode.length !== 6 || exclude.confirmation.trim().toUpperCase() !== "SELF EXCLUDE" || !Number.isInteger(Number(exclude.durationDays)) || Number(exclude.durationDays) < 1 || Number(exclude.durationDays) > 3650} onClick={() => void submit("exclude")}>{busy === "exclude" ? <LoadingDots /> : "Self-exclude account"}</button>
      </section>
      {message && <div role={isError ? "alert" : "status"} className={"halls-toast " + (isError ? "halls-toast-error" : "halls-toast-success")}>{message}<button type="button" aria-label="Dismiss" onClick={() => setMessage("")}>×</button></div>}
    </section>
    <NowBar />
  </main>;
}
