import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, LockKeyhole, MailCheck } from "lucide-react";
import AppHeader from "./AppHeader";
import { navigate } from "./utils/navigate";
import LoadingDots from "./components/LoadingDots";

export default function SigninPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [needsVerification, setNeedsVerification] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setNotice(""); setNeedsVerification(false); setSubmitting(true);
    const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");
    try {
      const response = await fetch(`${apiBase}/api/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim().toLowerCase(), password })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (payload.code === "EMAIL_NOT_VERIFIED") setNeedsVerification(true);
        throw new Error(payload.message || "We couldn't sign you in. Please try again.");
      }
      if (typeof payload.token !== "string" || !payload.token) throw new Error("The server did not return a valid session. Please try again.");
      localStorage.setItem("hallschat_token", payload.token);
      const returnTo = new URLSearchParams(window.location.search).get("returnTo");\n      navigate(returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/home");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to connect right now. Please try again.");
    } finally { setSubmitting(false); }
  }

  async function resendConfirmation() {
    setResending(true); setError(""); setNotice("");
    const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");
    try {
      const response = await fetch(`${apiBase}/api/auth/resend-confirmation`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: identifier.trim().toLowerCase() })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Unable to resend the confirmation email.");
      setNotice(payload.message || "If your account is awaiting confirmation, a new link will be sent when eligible.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to resend right now.");
    } finally { setResending(false); }
  }

  return <main className="signup-page auth-page theme-token-scope">
    <div className="signup-glow signup-glow-top" aria-hidden="true" />
    <div className="signup-glow signup-glow-bottom" aria-hidden="true" />
    <AppHeader homeHref="/" />
    <div className="auth-shell">
      <section className="auth-story">
        <span className="signup-form-kicker">WELCOME BACK</span>
        <h1>Your people.<br /><em>Your conversations.</em></h1>
        <p>Sign in to return to your HallsChat space and pick up where your conversations left off.</p>
      </section>
      <section className="auth-form-panel" aria-labelledby="signin-heading">
        <div className="signup-form-heading">
          <span className="signup-form-kicker">YOUR SPACE IS WAITING</span>
          <h2 id="signin-heading">Sign in</h2>
          <p>Enter your account details to continue.</p>
        </div>
        <form className="signup-form" onSubmit={handleSubmit}>
          <label className="signup-field"><span>Email address or username</span><input type="text" name="identifier" autoComplete="username" value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="you@example.com or username" required maxLength={254} /></label>
          <label className="signup-field"><span>Password</span><span className="signup-password-wrap"><input type={showPassword ? "text" : "password"} name="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" required maxLength={128} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(v => !v)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
          {error && <div className="signup-feedback signup-feedback-error" role="alert">{error}</div>}
          {notice && <div className="signup-feedback signup-feedback-success" role="status">{notice}</div>}
          {needsVerification && <div className="auth-verify-help"><MailCheck size={18} /><span>Your email needs confirmation first. Check your inbox or request a fresh confirmation link below.</span></div>}
          {needsVerification && <button className="button button-secondary auth-resend" type="button" onClick={resendConfirmation} disabled={resending}>{resending ? <LoadingDots /> : "Resend confirmation email"}</button>}
          <div className="auth-forgot-link"><a href="/forgot-password">Forgot password?</a></div>
          <button className="button button-primary signup-submit" type="submit" disabled={submitting}>{submitting ? <LoadingDots /> : <>Sign in <ArrowRight size={17} /></>}</button>
          <p className="signup-form-note"><LockKeyhole size={13} /> Your account is checked securely before access is granted.</p>
        </form>
        <div className="signup-bottom-note">New to HallsChat? <a href="/signup">Create an account</a></div>
      </section>
    </div>
    <footer className="signup-page-footer"><span>© {new Date().getFullYear()} HallsChat</span><span>Closer conversations. Stronger connections.</span></footer>
  </main>;
}
