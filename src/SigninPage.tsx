import { useEffect, useState, type FormEvent } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { ArrowRight, KeyRound, ShieldCheck } from "lucide-react";
import AppHeader from "./AppHeader";
import { navigate } from "./utils/navigate";
import LoadingDots from "./components/LoadingDots";

const KH_SIGNIN = "https://kingshall.online/signin";
type SigninResult = { token?: string; user?: Record<string, unknown>; message?: string; error?: string };
type NativeKingsHallAccountPlugin = { chooseAccount(): Promise<{ email?: string; cancelled?: boolean }> };
const DeviceAccount = registerPlugin<NativeKingsHallAccountPlugin>("KingsHallAccount");

export default function SigninPage() {
  const [identity, setIdentity] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const email = (hash.get("kingshall_account") || new URLSearchParams(window.location.search).get("kingshall_account") || "").trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setIdentity(email);
      localStorage.setItem("kingshall_account_hint", email);
      setNotice("KingsHall account detected. Enter its bound Access Code to continue.");
      window.history.replaceState({}, "", window.location.pathname + window.location.search);
    }
  }, []);

  async function continueWithKingsHall() {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      if (Capacitor.isNativePlatform()) {
        if (!Capacitor.isPluginAvailable("KingsHallAccount")) {
          throw new Error("This HallsChat APK needs an update to use the KingsHall account picker. Update HallsChat, then try again.");
        }
        const selected = await DeviceAccount.chooseAccount();
        if (selected.cancelled) {
          setNotice("Account selection was cancelled.");
          return;
        }
        const email = (selected.email || "").trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          setNotice("No KingsHall account was selected. Sign in to KingsHall on this device first.");
          return;
        }
        localStorage.setItem("kingshall_account_hint", email);
        setIdentity(email);
        setNotice("KingsHall account detected. Enter its bound Access Code to continue.");
        return;
      }
      const cookie = document.cookie.split(";").map(v => v.trim()).find(v => v.startsWith("kh_account_hint="));
      let hint = "";
      if (cookie) {
        try { hint = decodeURIComponent(cookie.slice("kh_account_hint=".length)).trim().toLowerCase(); } catch {}
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(hint)) {
        hint = (localStorage.getItem("kingshall_account_hint") || "").trim().toLowerCase();
      }
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(hint)) {
        setIdentity(hint);
        setNotice("KingsHall account detected. Enter its bound Access Code to continue.");
        return;
      }
      const url = new URL(KH_SIGNIN);
      url.searchParams.set("app", "hallschat");
      url.searchParams.set("returnTo", window.location.origin + "/signin");
      window.location.assign(url.toString());
    } catch (e) {
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
      if (!result.token || !result.user) throw new Error("HallsChat did not receive a valid session.");
      localStorage.setItem("hallschat_token", result.token);
      localStorage.setItem("hallschat_user", JSON.stringify(result.user));
      localStorage.removeItem("hallschat_last_activity_at");
      navigate("/home");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to sign in. Please try again.");
    } finally {
      setSubmitting(false);
      setAccessCode("");
    }
  }

  return <main className="signup-page auth-page theme-token-scope">
    <div className="signup-glow signup-glow-top" aria-hidden="true" />
    <div className="signup-glow signup-glow-bottom" aria-hidden="true" />
    <AppHeader homeHref="/" />
    <div className="auth-shell">
      <section className="auth-story">
        <span className="signup-form-kicker">ONE ACCOUNT. CONNECTED APPS.</span>
        <h1>Your people.<br /><em>Your conversations.</em></h1>
        <p>Use your KingsHall identity to enter HallsChat and keep your account connected.</p>
      </section>
      <section className="auth-form-panel" aria-labelledby="signin-heading">
        <div className="signup-form-heading">
          <span className="signup-form-kicker">SECURE ACCESS</span>
          <h2 id="signin-heading">{identity ? "Confirm your KingsHall account" : "Sign in with KingsHall"}</h2>
          <p>{identity || "Choose the KingsHall account you use across your connected apps."}</p>
        </div>
        {!identity && <div className="signup-form" style={{ display: "grid", gap: 12 }}>
          <button className="button button-primary signup-submit" type="button" onClick={() => void continueWithKingsHall()} disabled={submitting}>
            {submitting ? <LoadingDots /> : <>Continue with KingsHall <ArrowRight size={17} /></>}
          </button>
          <p className="signup-form-note"><ShieldCheck size={14} /> KingsHall verifies your Access Code. HallsChat never stores it.</p>
        </div>}
        {identity && <form className="signup-form" onSubmit={verify}>
          <label className="signup-field"><span>Bound six-digit Access Code</span>
            <input type="password" name="accessCode" inputMode="numeric" autoComplete="off" value={accessCode}
              onChange={e => setAccessCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="••••••" minLength={6} maxLength={6} pattern="[0-9]{6}" required />
          </label>
          {error && <div className="signup-feedback signup-feedback-error" role="alert">{error}</div>}
          {notice && <div className="signup-feedback signup-feedback-success" role="status">{notice}</div>}
          <button className="button button-primary signup-submit" type="submit" disabled={submitting || accessCode.length !== 6}>
            {submitting ? <LoadingDots /> : <>Verify and continue <KeyRound size={17} /></>}
          </button>
          <button className="button button-secondary" type="button" onClick={() => { setIdentity(""); setAccessCode(""); setError(""); setNotice(""); }}>Cancel request</button>
          <p className="signup-form-note"><ShieldCheck size={14} /> Your Access Code is sent only to HallsChat's server for KingsHall verification.</p>
        </form>}
        {!identity && error && <div className="signup-feedback signup-feedback-error" role="alert">{error}</div>}
        {!identity && notice && <div className="signup-feedback signup-feedback-success" role="status">{notice}</div>}
        <div className="signup-bottom-note">Need an account? <a href={KH_SIGNIN}>Create or recover access in KingsHall</a></div>
      </section>
    </div>
    <footer className="signup-page-footer"><span>© {new Date().getFullYear()} HallsChat</span><span>Closer conversations. Stronger connections.</span></footer>
  </main>;
}
