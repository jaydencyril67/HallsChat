import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, KeyRound, Mail, UserRound } from "lucide-react";
import AppHeader from "./AppHeader";
import LoadingDots from "./components/LoadingDots";
import { navigate } from "./utils/navigate";

export default function ForgotPasswordPage() {
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [resetComplete, setResetComplete] = useState(false);
  const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");

  async function handleRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice(""); setSubmitting(true);
    try {
      const response = await fetch(`${apiBase}/api/auth/forgot-password`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim().toLowerCase(), email: email.trim().toLowerCase() })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "We couldn't process your request. Please try again.");
      setNotice(payload.message || "If the details match an eligible account, reset instructions will be emailed to you.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to connect right now. Please try again.");
    } finally { setSubmitting(false); }
  }

  async function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice("");
    if (password !== confirmPassword) { setError("Your passwords do not match."); return; }
    setSubmitting(true);
    try {
      const response = await fetch(`${apiBase}/api/auth/reset-password`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "We couldn't reset your password. Please try again.");
      setNotice(payload.message || "Your password has been reset.");
      setResetComplete(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to connect right now. Please try again.");
    } finally { setSubmitting(false); }
  }

  return <main className="signup-page auth-page forgot-password-page">
    <div className="signup-glow signup-glow-top" aria-hidden="true" />
    <div className="signup-glow signup-glow-bottom" aria-hidden="true" />
    <AppHeader homeHref="/" />
    <div className="auth-shell">
      <section className="auth-story">
        <span className="signup-form-kicker">{token ? "ACCOUNT SECURITY" : "ACCOUNT RECOVERY"}</span>
        <h1>{token ? <>A new key.<br /><em>A fresh start.</em></> : <>Your account.<br /><em>Back in your hands.</em></>}</h1>
        <p>{token ? "Choose a strong new password to secure your HallsChat account again." : "Forgot your password? Confirm your username and email address and we'll send you a secure reset link."}</p>
      </section>
      <section className="auth-form-panel" aria-labelledby="recovery-heading">
        <div className="signup-form-heading">
          <span className="signup-form-kicker">HALLSCHAT ACCOUNT</span>
          <h2 id="recovery-heading">{token ? "Reset password" : "Forgot password"}</h2>
          <p>{token ? "Use a new password you haven't used here before." : "Enter the username and email address linked to your account."}</p>
        </div>
        {resetComplete ? <div className="signup-form">
          {notice && <div className="signup-feedback signup-feedback-success" role="status">{notice}</div>}
          <button className="button button-primary signup-submit" type="button" onClick={() => navigate("/signin")}>Go to sign in <ArrowRight size={17} /></button>
        </div> : <form className="signup-form" onSubmit={token ? handleReset : handleRequest}>
          {!token ? <>
            <label className="signup-field"><span>Username</span><span className="signup-password-wrap"><UserRound size={16} /><input type="text" name="username" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} placeholder="Your HallsChat username" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_.]+" /></span></label>
            <label className="signup-field"><span>Email address</span><span className="signup-password-wrap"><Mail size={16} /><input type="email" name="email" autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required maxLength={254} /></span></label>
          </> : <>
            <label className="signup-field"><span>New password</span><input type="password" name="new-password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Create a strong password" required minLength={8} maxLength={128} /></label>
            <label className="signup-field"><span>Confirm new password</span><input type="password" name="confirm-password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Enter the password again" required minLength={8} maxLength={128} /></label>
            <p className="signup-form-note"><KeyRound size={13} /> Use at least 8 characters with uppercase, lowercase, a number and a symbol.</p>
          </>}
          {error && <div className="signup-feedback signup-feedback-error" role="alert">{error}</div>}
          {notice && <div className="signup-feedback signup-feedback-success" role="status">{notice}</div>}
          <button className="button button-primary signup-submit" type="submit" disabled={submitting}>{submitting ? <LoadingDots /> : <>{token ? "Save new password" : "Email me a reset link"} <ArrowRight size={17} /></>}</button>
        </form>}
        <div className="signup-bottom-note"><a href="/signin"><ArrowLeft size={14} /> Back to sign in</a></div>
      </section>
    </div>
    <footer className="signup-page-footer"><span>© {new Date().getFullYear()} HallsChat</span><span>Closer conversations. Stronger connections.</span></footer>
  </main>;
}
