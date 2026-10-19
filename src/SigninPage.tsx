import { useEffect, useState, type FormEvent } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { ArrowRight, KeyRound, ShieldCheck, LoaderCircle, Fingerprint } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { authenticateWithPasskey } from "./utils/webauthn";
import { navigate } from "./utils/navigate";
import LoadingDots from "./components/LoadingDots";

const KH_SIGNIN = "https://kingshall.online/signin";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function getSavedBrowserAccounts(): string[] {
  const valid = (value: unknown): value is string => typeof value === "string" && EMAIL_PATTERN.test(value.trim().toLowerCase());
  let accounts: string[] = [];
  const cookie = document.cookie.split(";").map(value => value.trim()).find(value => value.startsWith("kh_saved_accounts="));
  if (cookie) {
    try {
      const parsed = JSON.parse(decodeURIComponent(cookie.slice("kh_saved_accounts=".length)));
      if (Array.isArray(parsed)) accounts = parsed.filter(valid).map(value => value.trim().toLowerCase());
    } catch {}
  }
  const hintCookie = document.cookie.split(";").map(value => value.trim()).find(value => value.startsWith("kh_account_hint="));
  if (hintCookie) {
    try { const hint = decodeURIComponent(hintCookie.slice("kh_account_hint=".length)).trim().toLowerCase(); if (EMAIL_PATTERN.test(hint)) accounts.push(hint); } catch {}
  }
  const localHint = (localStorage.getItem("kingshall_account_hint") || "").trim().toLowerCase();
  if (EMAIL_PATTERN.test(localHint)) accounts.push(localHint);
  return [...new Set(accounts)].slice(0, 10);
}
function setSelectedBrowserAccount(email: string) {
  const selected = email.trim().toLowerCase();
  localStorage.setItem("kingshall_account_hint", selected);
  document.cookie = "kh_account_hint=" + encodeURIComponent(selected) + "; Domain=.kingshall.online; Path=/; Max-Age=31536000; Secure; SameSite=Lax";
}
type SigninResult = { token?: string; user?: Record<string, unknown>; message?: string; error?: string; requiresExtraSecurity?: boolean; challengeToken?: string; methods?: Array<"2fa" | "biometric"> };
type ExternalLoginStart = { requestId: string; loginCode: string; qrToken: string; expiresAt: string; appName: "CryBots" | "HallsChat"; deviceLabel: string };
type ExternalLoginStatus = SigninResult & { status?: string };
type NativeKingsHallAccountPlugin = { chooseAccount(): Promise<{ email?: string; cancelled?: boolean }> };
const DeviceAccount = registerPlugin<NativeKingsHallAccountPlugin>("KingsHallAccount");

export default function SigninPage() {
  const [identity, setIdentity] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showNoAccountModal, setShowNoAccountModal] = useState(false);
  const [browserAccounts, setBrowserAccounts] = useState<string[]>([]);
  const [challengeToken, setChallengeToken] = useState("");
  const [extraMethods, setExtraMethods] = useState<Array<"2fa" | "biometric">>([]);
  const [extraMethod, setExtraMethod] = useState<"2fa" | "biometric" | "">("");
  const [extraCode, setExtraCode] = useState("");
  const [externalLogin, setExternalLogin] = useState<ExternalLoginStart | null>(null);
  const [externalLoginBusy, setExternalLoginBusy] = useState(false);

  function redirectToKingsHall() {
    const url = new URL(KH_SIGNIN);
    url.searchParams.set("app", "hallschat");
    const callback = new URL(window.location.origin + "/signin");
    callback.searchParams.set("app", "hallschat");
    const requestedReturn = new URLSearchParams(window.location.search).get("returnTo") || "";
    if (requestedReturn.startsWith("/") && !requestedReturn.startsWith("//")) callback.searchParams.set("returnTo", requestedReturn);
    url.searchParams.set("returnTo", callback.toString());
    window.location.assign(url.toString());
  }

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const email = (hash.get("kingshall_account") || new URLSearchParams(window.location.search).get("kingshall_account") || "").trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      localStorage.setItem("kingshall_account_hint", email);
      setNotice("KingsHall account saved on this browser. Press Continue with KingsHall to check the account."); 
      window.history.replaceState({}, "", window.location.pathname + window.location.search);
    }
  }, []);

  function finishSignin(result: SigninResult) {
    if (!result.token || !result.user) throw new Error("HallsChat did not receive a valid session.");
    localStorage.setItem("hallschat_token", result.token);
    localStorage.setItem("hallschat_user", JSON.stringify(result.user));
    localStorage.removeItem("hallschat_last_activity_at");
    const requestedReturn = new URLSearchParams(window.location.search).get("returnTo") || "";
    navigate(requestedReturn.startsWith("/") && !requestedReturn.startsWith("//") ? requestedReturn : "/home");
  }

  async function verifyExtraTwoFactor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !challengeToken || extraCode.length !== 6) return;
    setSubmitting(true); setError(""); setNotice("");
    const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");
    try {
      const response = await fetch(apiBase + "/api/auth/kingshall/extra-security/verify-2fa", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeToken, code: extraCode })
      });
      const result = await response.json().catch(() => ({})) as SigninResult;
      if (!response.ok) throw new Error(result.message || "The authenticator code could not be verified.");
      finishSignin(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The authenticator code could not be verified.");
    } finally {
      setSubmitting(false); setExtraCode("");
    }
  }

  async function verifyExtraBiometric() {
    if (submitting || !challengeToken) return;
    setSubmitting(true); setError(""); setNotice("");
    const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");
    try {
      const optionsResponse = await fetch(apiBase + "/api/auth/kingshall/extra-security/biometric/options", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeToken })
      });
      const options = await optionsResponse.json().catch(() => ({}));
      if (!optionsResponse.ok) throw new Error(options.message || "Unable to start biometric verification.");
      const credential = await authenticateWithPasskey(options);
      const verifyResponse = await fetch(apiBase + "/api/auth/kingshall/extra-security/biometric/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeToken, ...credential })
      });
      const result = await verifyResponse.json().catch(() => ({})) as SigninResult;
      if (!verifyResponse.ok) throw new Error(result.message || "Biometric verification failed.");
      finishSignin(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Biometric verification failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function continueWithKingsHall() {
    if (submitting) return;
    const loadingStartedAt = Date.now();
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      await new Promise(resolve => window.setTimeout(resolve, 250));
      if (Capacitor.isNativePlatform()) {
        if (!Capacitor.isPluginAvailable("KingsHallAccount")) throw new Error("This HallsChat app needs an update to use the KingsHall account manager.");
        const selected = await DeviceAccount.chooseAccount();
        const remainingLoadingTime = 5000 - (Date.now() - loadingStartedAt);
        if (remainingLoadingTime > 0) await new Promise(resolve => window.setTimeout(resolve, remainingLoadingTime));
        if (selected.cancelled) {
          setNotice("Account selection was cancelled.");
          return;
        }
        const email = (selected.email || "").trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          setShowNoAccountModal(true);
          return;
        }
        localStorage.setItem("kingshall_account_hint", email);
        setIdentity(email);
        setNotice("KingsHall account detected. Enter its bound Access Code to continue.");
        return;
      }
      const accounts = getSavedBrowserAccounts();
      const remainingLoadingTime = 5000 - (Date.now() - loadingStartedAt);
      if (remainingLoadingTime > 0) await new Promise(resolve => window.setTimeout(resolve, remainingLoadingTime));
      if (accounts.length) {
        setBrowserAccounts(accounts);
        return;
      }
      setShowNoAccountModal(true);
    } catch (e) {
      const remainingLoadingTime = 5000 - (Date.now() - loadingStartedAt);
      if (remainingLoadingTime > 0) await new Promise(resolve => window.setTimeout(resolve, remainingLoadingTime));
      setError(e instanceof Error ? e.message : "Unable to select a KingsHall account.");
    } finally {
      setSubmitting(false);
    }
  }

    async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !identity || accessCode.length !== 6) return;
    setSubmitting(true); setError(""); setNotice("");
    const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");
    try {
      const response = await fetch(apiBase + "/api/auth/kingshall/access-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identity, accessCode })
      });
      const result = await response.json().catch(() => ({})) as SigninResult;
      if (!response.ok) throw new Error(result.message || result.error || "KingsHall could not verify this Access Code.");
      if (result.requiresExtraSecurity && result.challengeToken && result.methods?.length) {
        setChallengeToken(result.challengeToken);
        setExtraMethods(result.methods);
        setExtraMethod(result.methods.length === 1 ? result.methods[0] : "");
        setExtraCode("");
        setNotice(result.methods.length > 1
          ? "Access Code verified. Choose an enabled extra-security method to finish signing in."
          : "Access Code verified. Complete the enabled extra-security check to finish signing in.");
        return;
      }
      finishSignin(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in. Please try again.");
    } finally {
      setSubmitting(false);
      setAccessCode("");
    }
  }

  async function startExternalLogin() {
    if (submitting || externalLoginBusy) return;
    setExternalLoginBusy(true); setError(""); setNotice("");
    const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");
    try {
      const agent = navigator.userAgent;
      const deviceLabel = /Windows/i.test(agent) ? "Windows browser" : /Macintosh|Mac OS/i.test(agent) ? "Mac browser" : /Android/i.test(agent) ? "Android browser" : /iPhone|iPad/i.test(agent) ? "Apple mobile browser" : "External browser";
      const response = await fetch(apiBase + "/api/auth/kingshall/external/request", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deviceLabel })
      });
      const data = await response.json().catch(() => ({})) as ExternalLoginStart & { message?: string; error?: string };
      if (!response.ok) throw new Error(data.message || data.error || "Unable to start external-device login.");
      setExternalLogin(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to start external-device login.");
    } finally {
      setExternalLoginBusy(false);
    }
  }

  async function cancelExternalLogin() {
    const request = externalLogin;
    if (!request) return;
    setExternalLogin(null); setExternalLoginBusy(true); setError("");
    const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");
    try {
      const response = await fetch(apiBase + "/api/auth/kingshall/external/cancel", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: request.requestId })
      });
      const data = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) throw new Error(data.message || "Unable to cancel external-device login.");
      setNotice("External-device login cancelled.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "The external login request could not be cancelled.");
    } finally {
      setExternalLoginBusy(false);
    }
  }

  useEffect(() => {
    if (!externalLogin?.requestId) return;
    let stopped = false;
    let timer: number | undefined;
    const requestId = externalLogin.requestId;
    const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");
    const poll = async () => {
      try {
        const response = await fetch(apiBase + "/api/auth/kingshall/external/status", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId })
        });
        const data = await response.json().catch(() => ({})) as ExternalLoginStatus;
        if (stopped) return;
        if (!response.ok) {
          if ([400, 401, 404, 409, 410, 423].includes(response.status)) {
            setExternalLogin(null);
            setError(data.message || "This external sign-in request is no longer valid.");
            return;
          }
        } else if (data.status === "authenticated") {
          setExternalLogin(null);
          if (data.requiresExtraSecurity && data.challengeToken && data.methods?.length) {
            setIdentity(String((data.user as Record<string, unknown> | undefined)?.email || ""));
            setChallengeToken(data.challengeToken);
            setExtraMethods(data.methods);
            setExtraMethod(data.methods.length === 1 ? data.methods[0] : "");
            setExtraCode("");
            setNotice(data.methods.length > 1
              ? "Device approved. Complete one enabled HallsChat security check to finish signing in."
              : "Device approved. Complete the enabled HallsChat security check to finish signing in.");
            return;
          }
          try { finishSignin(data); }
          catch (e) { setError(e instanceof Error ? e.message : "The approved session could not be completed."); }
          return;
        } else if (["denied", "expired", "consumed"].includes(String(data.status || ""))) {
          setExternalLogin(null);
          setError(data.status === "denied" ? "The external sign-in request was denied." : "The external sign-in request expired. Start again on this device.");
          return;
        }
      } catch {
        // Keep polling through temporary network errors; the request expires on the server.
      }
      if (!stopped) timer = window.setTimeout(() => { void poll(); }, 1800);
    };
    timer = window.setTimeout(() => { void poll(); }, 1500);
    return () => { stopped = true; if (timer !== undefined) window.clearTimeout(timer); };
  }, [externalLogin?.requestId]);

  const glass = { border: "1px solid var(--theme-line, rgba(255,255,255,.2))", background: "var(--theme-surface, rgba(25,20,24,.88))", boxShadow: "inset 0 1px 0 rgba(255,255,255,.06)" } as const;
  const glassButton = { minHeight: 46, border: "1px solid var(--theme-line, rgba(255,255,255,.2))", borderRadius: 999, padding: "12px 18px", fontWeight: 750, display: "inline-flex", justifyContent: "center", alignItems: "center", gap: 10, width: "100%", cursor: submitting ? "wait" : "pointer", background: "var(--theme-surface, rgba(25,20,24,.88))", color: "var(--theme-text, #fff)", boxSizing: "border-box" as const, boxShadow: "inset 0 1px rgba(255,255,255,.13), 0 4px 14px rgba(0,0,0,.22)", backdropFilter: "blur(12px) saturate(125%)", WebkitBackdropFilter: "blur(12px) saturate(125%)" } as const;
  const glassInput = { width: "100%", minHeight: 48, boxSizing: "border-box" as const, borderRadius: 13, border: "1px solid var(--theme-line, rgba(255,255,255,.2))", background: "var(--theme-background, rgba(0,0,0,.12))", color: "var(--theme-text, #fff)", padding: "12px 14px", fontSize: 15, outline: "none" } as const;

  return <main className="auth-page theme-token-scope" style={{ minHeight: "100vh", background: "var(--theme-bg, #4b1728)", color: "var(--theme-text, #fff)", padding: "clamp(14px, 3vw, 28px)", boxSizing: "border-box", display: "grid", placeItems: "center" }}>
    <style>{"@keyframes hallschat-signin-spin { to { transform: rotate(360deg); } }"}</style>
    <div style={{ width: "100%", maxWidth: 460 }}>
      <section style={{ ...glass, borderRadius: 24, padding: "clamp(22px, 6vw, 34px)", textAlign: "center", backdropFilter: "blur(18px) saturate(125%)", WebkitBackdropFilter: "blur(18px) saturate(125%)" }}>
        <div style={{ width: 54, height: 54, margin: "0 auto 14px", display: "grid", placeItems: "center", borderRadius: "50%", border: "1px solid var(--theme-line, rgba(255,255,255,.2))", background: "var(--theme-surface, rgba(255,255,255,.08))", color: "var(--theme-primary, var(--theme-accent, #f0b6c5))" }}><ShieldCheck size={25} /></div>
        <h1 style={{ margin: 0, fontSize: "clamp(1.4rem, 4vw, 1.8rem)", lineHeight: 1.2 }}>{identity ? "Confirm your KingsHall account" : "Sign in to HallsChat"}</h1>
        <p style={{ margin: "9px 0 22px", color: "var(--theme-text-muted, rgba(255,255,255,.72))", fontSize: 13, lineHeight: 1.6 }}>{identity || "Continue with the KingsHall account saved on this device or browser."}</p>

        {!identity && browserAccounts.length > 0 && <div style={{ display: "grid", gap: 9, margin: "0 0 16px", textAlign: "left" }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 800 }}>Saved KingsHall accounts</p>
          <p style={{ margin: 0, color: "var(--theme-text-muted, rgba(255,255,255,.72))", fontSize: 12, lineHeight: 1.5 }}>Choose which account to use for this sign-in request.</p>
          {browserAccounts.map(email => <button key={email} type="button" style={{ ...glassButton, justifyContent: "flex-start", overflowWrap: "anywhere", textAlign: "left" }} onClick={() => { setSelectedBrowserAccount(email); setIdentity(email); setError(""); setNotice("KingsHall account selected. Enter its bound Access Code to continue."); }}>{email} <KeyRound size={15} /></button>)}
        </div>}
        {!identity && browserAccounts.length === 0 && <button type="button" aria-label="Sign in with KingsHall" onClick={() => void continueWithKingsHall()} disabled={submitting} style={{ width: 88, height: 88, borderRadius: "50%", border: "1px solid var(--theme-line, rgba(255,255,255,.25))", background: "var(--theme-surface, rgba(255,255,255,.08))", color: "var(--theme-text, #fff)", display: "grid", placeItems: "center", margin: "0 auto", cursor: submitting ? "wait" : "pointer", backdropFilter: "blur(12px) saturate(125%)", WebkitBackdropFilter: "blur(12px) saturate(125%)", boxShadow: "inset 0 1px rgba(255,255,255,.18), 0 4px 14px rgba(0,0,0,.22)" }}>{submitting ? <LoadingDots /> : <KeyRound size={28} />}</button>}
        {!identity && browserAccounts.length === 0 && <p style={{ margin: "12px 0 0", color: "var(--theme-text, #fff)", fontWeight: 700, fontSize: 14 }}>Sign in with KingsHall</p>}

        {identity && !challengeToken && <form onSubmit={verify} style={{ display: "grid", gap: 14, textAlign: "left" }}>
          <label htmlFor="hallschat-signin-access-code" style={{ fontSize: 13, color: "var(--theme-text-muted, rgba(255,255,255,.72))", fontWeight: 650 }}>Bound six-digit Access Code</label>
          <input id="hallschat-signin-access-code" style={{ ...glassInput, textAlign: "center", letterSpacing: ".35em", fontSize: 20 }} type="password" inputMode="numeric" autoComplete="off" value={accessCode} onChange={event => setAccessCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="••••••" minLength={6} maxLength={6} pattern="[0-9]{6}" required />
          <button type="submit" style={glassButton} disabled={submitting || accessCode.length !== 6}>{submitting ? <LoadingDots /> : "Verify and continue"}</button>
          <button type="button" onClick={() => { setIdentity(""); setAccessCode(""); setError(""); setNotice(""); }} style={{ border: 0, background: "transparent", color: "var(--theme-primary, var(--theme-accent, #f0b6c5))", padding: 8, fontWeight: 700, cursor: "pointer" }}>Cancel request</button>
        </form>}

        {challengeToken && <section style={{ display: "grid", gap: 14, textAlign: "left" }}>
          <div style={{ ...glass, borderRadius: 16, padding: 14 }}>
            <p style={{ margin: 0, fontWeight: 800, fontSize: 14 }}>Extra security required</p>
            <p style={{ margin: "6px 0 0", color: "var(--theme-text-muted, rgba(255,255,255,.72))", fontSize: 13, lineHeight: 1.5 }}>KingsHall accepted your Access Code. Complete one enabled HallsChat security check to finish signing in.</p>
          </div>
          {extraMethods.length > 1 && <div style={{ display: "grid", gap: 8 }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--theme-text-muted, rgba(255,255,255,.72))" }}>Choose one method to continue</p>
            {extraMethods.includes("2fa") && <button type="button" style={glassButton} onClick={() => { setExtraMethod("2fa"); setError(""); }} disabled={submitting}>Authenticator app (2FA)</button>}
            {extraMethods.includes("biometric") && <button type="button" style={glassButton} onClick={() => { setExtraMethod("biometric"); setError(""); }} disabled={submitting}><Fingerprint size={17} /> Biometric / passkey</button>}
          </div>}
          {extraMethod === "2fa" && <form onSubmit={verifyExtraTwoFactor} style={{ display: "grid", gap: 12 }}>
            <label htmlFor="hallschat-extra-2fa" style={{ fontSize: 13, color: "var(--theme-text-muted, rgba(255,255,255,.72))", fontWeight: 650 }}>Six-digit authenticator code</label>
            <input id="hallschat-extra-2fa" style={{ ...glassInput, textAlign: "center", letterSpacing: ".3em", fontSize: 20 }} type="password" inputMode="numeric" autoComplete="one-time-code" value={extraCode} onChange={event => setExtraCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="••••••" minLength={6} maxLength={6} pattern="[0-9]{6}" required />
            <button type="submit" style={glassButton} disabled={submitting || extraCode.length !== 6}>{submitting ? <LoadingDots /> : "Verify 2FA and continue"}</button>
          </form>}
          {extraMethod === "biometric" && <div style={{ display: "grid", gap: 10 }}>
            <p style={{ margin: 0, color: "var(--theme-text-muted, rgba(255,255,255,.72))", fontSize: 13, lineHeight: 1.5 }}>Confirm with the passkey or device biometric method bound to this HallsChat account.</p>
            <button type="button" style={glassButton} onClick={() => void verifyExtraBiometric()} disabled={submitting}>{submitting ? <LoadingDots /> : <><Fingerprint size={17} /> Verify biometric and continue</>}</button>
          </div>}
          <button type="button" onClick={() => { setIdentity(""); setAccessCode(""); setChallengeToken(""); setExtraMethods([]); setExtraMethod(""); setExtraCode(""); setError(""); setNotice(""); }} style={{ border: 0, background: "transparent", color: "var(--theme-primary, var(--theme-accent, #f0b6c5))", padding: 8, fontWeight: 700, cursor: "pointer" }}>Cancel request</button>
        </section>}
        <div style={{ ...glass, borderRadius: 16, padding: 14, marginTop: 16, display: "grid", gap: 10, textAlign: "left" }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 800 }}>Signing in on a device without KingsHall?</p>
            <p style={{ margin: "5px 0 0", color: "var(--theme-text-muted, rgba(255,255,255,.72))", fontSize: 12, lineHeight: 1.55 }}>Approve this device from your signed-in KingsHall account. No saved KingsHall account or Access Code is needed on this device.</p>
          </div>
          {!externalLogin && <button type="button" style={glassButton} disabled={submitting || externalLoginBusy || !!challengeToken} onClick={() => void startExternalLogin()}>{externalLoginBusy ? <LoadingDots /> : "Use external-device login"}</button>}
          {externalLogin && <>
            <p style={{ margin: 0, color: "var(--theme-text-muted, rgba(255,255,255,.72))", fontSize: 12, lineHeight: 1.55 }}>In KingsHall, open External Login and scan this QR code, or enter the code below. This request expires in five minutes.</p>
            <div style={{ justifySelf: "center", background: "#fff", padding: 10, borderRadius: 14 }}>
              <QRCodeSVG value={JSON.stringify({ type: "kingshall-external-login-v1", requestId: externalLogin.requestId, qrToken: externalLogin.qrToken, appName: "HallsChat" })} size={196} level="M" includeMargin />
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ margin: "3px 0 6px", color: "var(--theme-text-muted, rgba(255,255,255,.72))", fontSize: 12 }}>ONE-TIME LOGIN CODE</p>
              <div aria-label={"One-time login code " + externalLogin.loginCode} style={{ fontSize: 27, letterSpacing: ".2em", fontWeight: 900, overflowWrap: "anywhere" }}>{externalLogin.loginCode}</div>
              <p style={{ margin: "6px 0 0", color: "var(--theme-text-muted, rgba(255,255,255,.72))", fontSize: 11 }}>Expires {new Date(externalLogin.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
            </div>
            <p role="status" style={{ margin: 0, color: "var(--theme-text-muted, rgba(255,255,255,.72))", fontSize: 12 }}>Waiting for approval from KingsHall…</p>
            <button type="button" style={{ ...glassButton, background: "transparent" }} disabled={externalLoginBusy} onClick={() => void cancelExternalLogin()}>Cancel external login</button>
          </>}
        </div>
        {notice && <p role="status" style={{ margin: "16px 0 0", color: "var(--theme-text-muted, rgba(255,255,255,.72))", fontSize: 13, lineHeight: 1.6 }}>{notice}</p>}
        {error && <p role="alert" style={{ margin: "16px 0 0", padding: "11px 13px", borderRadius: 12, background: "rgba(220,60,60,.10)", border: "1px solid rgba(220,80,80,.28)", color: "var(--theme-text, #fff)", fontSize: 13, lineHeight: 1.5 }}>{error}</p>}
        <p style={{ margin: "22px 0 0", paddingTop: 14, borderTop: "1px solid var(--theme-line, rgba(255,255,255,.2))", color: "var(--theme-text-muted, rgba(255,255,255,.72))", fontSize: 12, lineHeight: 1.6 }}>KingsHall verifies your Access Code. HallsChat never stores it.</p>
        <div style={{ marginTop: 14, color: "var(--theme-text-muted, rgba(255,255,255,.72))", fontSize: 12, lineHeight: 1.6 }}>Need an account? <a href={KH_SIGNIN} style={{ color: "var(--theme-primary, var(--theme-accent, #f0b6c5))", fontWeight: 700, textDecoration: "none" }}>Create or recover access in KingsHall</a></div>
      </section>
    </div>
    {showNoAccountModal && <div role="presentation" onClick={() => setShowNoAccountModal(false)} style={{ position: "fixed", inset: 0, zIndex: 10000, display: "grid", placeItems: "center", padding: 20, background: "rgba(0,0,0,.58)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
      <section role="alertdialog" aria-modal="true" aria-labelledby="hallschat-no-account-title" aria-describedby="hallschat-no-account-description" onClick={event => event.stopPropagation()} style={{ ...glass, width: "100%", maxWidth: 360, boxSizing: "border-box", borderRadius: 22, padding: 24, textAlign: "center", color: "var(--theme-text, #fff)", boxShadow: "0 18px 60px rgba(0,0,0,.28)" }}>
        <div style={{ width: 52, height: 52, margin: "0 auto 14px", display: "grid", placeItems: "center", borderRadius: "50%", border: "1px solid var(--theme-line, rgba(255,255,255,.2))", background: "var(--theme-surface, rgba(255,255,255,.08))", color: "var(--theme-primary, var(--theme-accent, #f0b6c5))" }}><KeyRound size={23} /></div>
        <h2 id="hallschat-no-account-title" style={{ margin: 0, fontSize: 19 }}>No KingsHall account found</h2>
        <p id="hallschat-no-account-description" style={{ margin: "10px 0 20px", color: "var(--theme-text-muted, rgba(255,255,255,.72))", fontSize: 14, lineHeight: 1.6 }}>Please sign in to KingsHall first, then return to HallsChat to continue.</p>
        <div style={{ display: "grid", gap: 9 }}>
          <button type="button" style={glassButton} onClick={redirectToKingsHall}>Sign in to KingsHall <ArrowRight size={17} /></button>
          <button type="button" style={{ ...glassButton, background: "transparent" }} onClick={() => setShowNoAccountModal(false)}>Cancel</button>
        </div>
      </section>
    </div>}
    {submitting && <div role="status" aria-live="polite" aria-busy="true" style={{ position: "fixed", inset: 0, zIndex: 9999, display: "grid", placeItems: "center", background: "rgba(0,0,0,.52)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)" }}>
      <div style={{ ...glass, borderRadius: 22, padding: 24, minWidth: 120, display: "grid", justifyItems: "center", gap: 12, color: "var(--theme-text, #fff)" }}>
        <LoaderCircle size={34} aria-hidden="true" style={{ animation: "hallschat-signin-spin 1s linear infinite" }} />
        <span style={{ fontSize: 13, fontWeight: 650 }}>Checking KingsHall…</span>
      </div>
    </div>}
  </main>;
}
