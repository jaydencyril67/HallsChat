import { useState, type FormEvent } from "react";
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";

type SignupPageProps = { onBack: () => void };

export default function SignupPage({ onBack }: SignupPageProps) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Your passwords do not match yet.");
      return;
    }
    if (!acceptedTerms) {
      setError("Please agree to the Terms and Privacy Policy to continue.");
      return;
    }

    const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
    setSubmitting(true);
    try {
      const response = await fetch(`${apiBase}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: name.trim(), username: username.trim(), email: email.trim().toLowerCase(), password })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "We couldn't create your account. Please try again.");
      setSuccess(payload.message || "Your HallsChat account has been created.");
      setName("");
      setUsername("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setAcceptedTerms(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to connect right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="signup-page">
    <div className="signup-glow signup-glow-top" aria-hidden="true" />
    <div className="signup-glow signup-glow-bottom" aria-hidden="true" />
    <div className="signup-shell">
      <section className="signup-story">
        <div className="signup-story-content">
          <h1>Make room for<br /><em>closer connections.</em></h1>
          <p>Start with your own HallsChat space. The conversations that matter deserve a place of their own.</p>
          <div className="signup-benefit-list">
            <div><span><Check size={14} /></span><div><strong>Your people, in one place</strong><small>A space designed around meaningful conversations.</small></div></div>
            <div><span><ShieldCheck size={14} /></span><div><strong>Your account, your control</strong><small>Choose your details and keep your credentials private.</small></div></div>
          </div>
        </div>
        <div className="signup-story-footer"><span className="signup-footer-mark"><LockKeyhole size={13} /></span><span>Built for the people who matter.</span></div>
      </section>

      <section className="signup-form-panel" aria-labelledby="signup-heading">
        <div className="signup-form-heading">
          <span className="signup-form-kicker">YOUR NEXT CHAPTER STARTS HERE</span>
          <h2 id="signup-heading">Create your account</h2>
          <p>Enter your details to get started with HallsChat.</p>
        </div>
        <form className="signup-form" onSubmit={handleSubmit} noValidate>
          <label className="signup-field"><span>Full name</span><input autoComplete="name" name="name" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" required maxLength={80} /></label>
          <label className="signup-field"><span>Username</span><input autoComplete="username" name="username" value={username} onChange={e => setUsername(e.target.value.replace(/\s/g, ""))} placeholder="Choose a username" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_.]+" title="Use 3–24 letters, numbers, underscores or periods." /><small>3–24 letters, numbers, underscores or periods.</small></label>
          <label className="signup-field"><span>Email address</span><input autoComplete="email" name="email" type="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required maxLength={254} /></label>
          <div className="signup-field-row">
            <label className="signup-field"><span>Password</span><span className="signup-password-wrap"><input autoComplete="new-password" name="password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" required minLength={8} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(v => !v)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
            <label className="signup-field"><span>Confirm password</span><span className="signup-password-wrap"><input autoComplete="new-password" name="confirmPassword" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter password" required minLength={8} /><button type="button" aria-label={showConfirmPassword ? "Hide password confirmation" : "Show password confirmation"} onClick={() => setShowConfirmPassword(v => !v)}>{showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
          </div>
          <label className="signup-terms"><input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} /><span>I agree to HallsChat’s Terms and Privacy Policy.</span></label>
          {error && <div className="signup-feedback signup-feedback-error" role="alert">{error}</div>}
          {success && <div className="signup-feedback signup-feedback-success" role="status">{success}</div>}
          <button className="button button-primary signup-submit" type="submit" disabled={submitting}>{submitting ? "Creating your account…" : "Create account"} {!submitting && <ArrowRight size={17} />}</button>
          <p className="signup-form-note"><LockKeyhole size={13} /> Your password is protected with one-way password hashing.</p>
        </form>
        <div className="signup-bottom-note">Already have an account? <span>Sign-in will be added with the authentication flow.</span></div>
      </section>
    </div>
    <footer className="signup-page-footer"><span>© {new Date().getFullYear()} HallsChat</span><span>Closer conversations. Stronger connections.</span></footer>
  </main>;
}
