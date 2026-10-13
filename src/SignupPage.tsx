import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, MailCheck, ShieldCheck } from "lucide-react";
import AppHeader from "./AppHeader";
import LoadingDots from "./components/LoadingDots";
import { navigate } from "./utils/navigate";

function formatNameInput(value: string) {
  return value.toLocaleLowerCase().replace(/(^|\s)(\S)/g, (_match, space: string, character: string) => space + character.toLocaleUpperCase());
}

export default function SignupPage() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid" | "error">("idle");
  const [usernameMessage, setUsernameMessage] = useState("");
  const [email, setEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "checking" | "accepted" | "rejected" | "invalid" | "error">("idle");
  const [emailMessage, setEmailMessage] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showCheckEmail, setShowCheckEmail] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resendError, setResendError] = useState(false);

  useEffect(() => {
    if (!showCheckEmail) return;
    const timer = window.setTimeout(() => navigate("/signin", { replace: true }), 10000);
    return () => window.clearTimeout(timer);
  }, [showCheckEmail]);

  useEffect(() => {
    const value = username.trim().toLowerCase();
    if (!value) { setUsernameStatus("idle"); setUsernameMessage(""); return; }
    if (!/^[a-z0-9_.]{3,24}$/.test(value)) { setUsernameStatus("invalid"); setUsernameMessage("Use 3–24 letters, numbers, underscores or periods."); return; }
    const controller = new AbortController();
    setUsernameStatus("checking"); setUsernameMessage("Checking username…");
    const timer = window.setTimeout(async () => {
      const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");
      try {
        const response = await fetch(apiBase + "/api/auth/username-availability?username=" + encodeURIComponent(value), { signal: controller.signal });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || "Username availability could not be checked.");
        if (controller.signal.aborted) return;
        if (payload.valid === false) { setUsernameStatus("invalid"); setUsernameMessage(payload.message || "Choose a valid username."); }
        else if (payload.available) { setUsernameStatus("available"); setUsernameMessage("Username is available."); }
        else { setUsernameStatus("taken"); setUsernameMessage(payload.message || "That username is already taken."); }
      } catch (err) {
        if (controller.signal.aborted) return;
        setUsernameStatus("error"); setUsernameMessage(err instanceof Error ? err.message : "Couldn’t check username availability.");
      }
    }, 450);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [username]);

  useEffect(() => {
    const value = email.trim().toLowerCase();
    if (!value) { setEmailStatus("idle"); setEmailMessage(""); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setEmailStatus("invalid");
      setEmailMessage("Enter a valid email address.");
      return;
    }
    const controller = new AbortController();
    setEmailStatus("checking");
    setEmailMessage("Checking accepted email providers…");
    const timer = window.setTimeout(async () => {
      const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");
      try {
        const response = await fetch(apiBase + "/api/auth/signup/check-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: value }),
          signal: controller.signal
        });
        const payload = await response.json().catch(() => ({}));
        if (controller.signal.aborted) return;
        if (response.ok) {
          setEmailStatus("accepted");
          setEmailMessage(payload.message || "Email provider accepted.");
        } else {
          setEmailStatus("rejected");
          setEmailMessage(payload.message || "Please use an email address from an accepted email provider.");
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setEmailStatus("error");
        setEmailMessage("We couldn't verify this email right now. Please try again.");
      }
    }, 500);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [email]);

  const passwordHasMinLength = password.length >= 8;
  const passwordHasUppercase = /[A-Z]/.test(password);
  const passwordHasLowercase = /[a-z]/.test(password);
  const passwordHasNumber = /\d/.test(password);
  const passwordHasSymbol = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  const passwordMeetsRequirement = passwordHasMinLength && passwordHasUppercase && passwordHasLowercase && passwordHasNumber && passwordHasSymbol;
  const passwordChecklist = [
    { label: "At least 8 characters", met: passwordHasMinLength },
    { label: "One uppercase letter", met: passwordHasUppercase },
    { label: "One lowercase letter", met: passwordHasLowercase },
    { label: "One number", met: passwordHasNumber },
    { label: "One symbol", met: passwordHasSymbol }
  ];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (emailStatus !== "accepted") {
      setError(emailStatus === "checking" ? "Please wait while we check whether this email provider is accepted." : emailStatus === "rejected" || emailStatus === "invalid" ? emailMessage || "Please use an email address from an accepted email provider." : "Please verify your email address before continuing.");
      return;
    }
    if (!passwordMeetsRequirement) {
      setError("Password must be at least 8 characters long and include uppercase, lowercase, number, and symbol.");
      return;
    }
    if (usernameStatus !== "available") {
      setError(usernameStatus === "checking" ? "Please wait while we check your username." : usernameStatus === "taken" ? "That username is already taken. Choose another one." : usernameStatus === "error" ? "We couldn’t check username availability. Please try again." : "Please enter a valid, available username.");
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

    const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");
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
      setConfirmationEmail(payload.email || email.trim().toLowerCase());
      setShowCheckEmail(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to connect right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendConfirmation() {
    setResending(true);
    setResendMessage("");
    setResendError(false);
    const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");
    try {
      const response = await fetch(`${apiBase}/api/auth/resend-confirmation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: confirmationEmail })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Unable to resend the confirmation email.");
      setResendMessage(payload.message || "If your account is awaiting confirmation, a new link will be sent when eligible.");
    } catch (err) {
      setResendError(true);
      setResendMessage(err instanceof Error ? err.message : "Unable to resend right now. Please try again.");
    } finally {
      setResending(false);
    }
  }

  return <main className="signup-page theme-token-scope">
    <div className="signup-glow signup-glow-top" aria-hidden="true" />
    <div className="signup-glow signup-glow-bottom" aria-hidden="true" />
    <AppHeader homeHref="/" />
    {showCheckEmail ? <section className="signup-confirmation-panel" aria-labelledby="confirmation-heading">
      <div className="signup-confirmation-icon"><MailCheck size={30} /></div>
      <span className="signup-form-kicker">ONE QUICK STEP</span>
      <h1 id="confirmation-heading">Check your email</h1>
      <p>We've sent a confirmation link to <strong>{confirmationEmail}</strong>. Open the email and tap <strong>Confirm email address</strong> to finish creating your HallsChat account.</p>
      <div className="signup-confirmation-tip">The link expires in 15 minutes. If you don't see the email, check your spam or promotions folder.</div>
      {resendMessage && <div className={resendError ? "signup-feedback signup-feedback-error" : "signup-feedback signup-feedback-success"} role="status">{resendMessage}</div>}
      <button className="button button-primary signup-submit" type="button" onClick={handleResendConfirmation} disabled={resending}>{resending ? <LoadingDots /> : <>Resend confirmation email <ArrowRight size={17} /></>}</button>
      <button className="signup-confirmation-back" type="button" onClick={() => { setShowCheckEmail(false); setResendMessage(""); setResendError(false); }}>Back to signup</button>
    </section> : <>
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
          <label className="signup-field"><span>Full name</span><input autoComplete="name" name="name" value={name} onChange={e => setName(formatNameInput(e.target.value))} placeholder="Your name" required maxLength={80} /></label>
          <label className="signup-field"><span>Username</span><span className="signup-username-wrap"><input autoComplete="username" name="username" value={username} onChange={e => { setUsername(e.target.value.toLowerCase().replace(/\s/g, "")); setError(""); }} placeholder="Choose a username" required minLength={3} maxLength={24} pattern="[a-z0-9_.]+" title="Use 3–24 lowercase letters, numbers, underscores or periods." aria-describedby="username-availability" aria-invalid={usernameStatus === "taken" || usernameStatus === "invalid"} />{usernameStatus === "checking" ? <span className="signup-username-loader" aria-label="Checking username"><LoadingDots /></span> : usernameStatus === "available" ? <Check size={16} className="signup-username-ok" aria-label="Username available" /> : null}</span><small id="username-availability" className={"signup-username-status signup-username-status-" + usernameStatus} aria-live="polite">{usernameMessage || "3–24 lowercase letters, numbers, underscores or periods."}</small></label>
          <label className="signup-field"><span>Email address</span><span className="signup-email-wrap"><input autoComplete="email" name="email" type="email" inputMode="email" value={email} onChange={e => { setEmail(e.target.value); setError(""); }} placeholder="you@example.com" required maxLength={254} aria-describedby="email-allowance-status" aria-invalid={emailStatus === "rejected" || emailStatus === "invalid"} />{emailStatus === "checking" ? <span className="signup-username-loader" aria-label="Checking email provider"><LoadingDots /></span> : emailStatus === "accepted" ? <Check size={16} className="signup-username-ok" aria-label="Email provider accepted" /> : null}</span><small id="email-allowance-status" className={"signup-email-status signup-email-status-" + emailStatus} aria-live="polite">{emailMessage || "Use an email address from an accepted provider."}</small></label>
          <div className="signup-field-row">
            <label className="signup-field"><span>Password</span><span className="signup-password-wrap"><input autoComplete="new-password" name="password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Create a password" required minLength={8} maxLength={128} aria-describedby="signup-password-rules" /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(v => !v)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
            <label className="signup-field"><span>Confirm password</span><span className="signup-password-wrap"><input autoComplete="new-password" name="confirmPassword" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter password" required minLength={8} /><button type="button" aria-label={showConfirmPassword ? "Hide password confirmation" : "Show password confirmation"} onClick={() => setShowConfirmPassword(v => !v)}>{showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button></span></label>
          </div>
          <ul id="signup-password-rules" className="signup-password-rules" aria-label="Password requirements">{passwordChecklist.map(rule => <li key={rule.label} className={rule.met ? "signup-password-rule-met" : ""}><Check size={13} />{rule.label}</li>)}</ul>
          <label className="signup-terms"><input type="checkbox" checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} /><span>I agree to HallsChat’s Terms and Privacy Policy.</span></label>
          {error && <div className="signup-feedback signup-feedback-error" role="alert">{error}</div>}
          {success && <div className="signup-feedback signup-feedback-success" role="status">{success}</div>}
          <button className="button button-primary signup-submit" type="submit" disabled={submitting}>{submitting ? <LoadingDots /> : <>Create account <ArrowRight size={17} /></>}</button>
          <p className="signup-form-note"><LockKeyhole size={13} /> Your password is protected with one-way password hashing.</p>
        </form>
        <div className="signup-bottom-note">Already have an account? <a href="/signin">Sign in</a></div>
      </section>
    </div>
    <footer className="signup-page-footer"><span>© {new Date().getFullYear()} HallsChat</span><span>Closer conversations. Stronger connections.</span></footer>
    </>}
  </main>;
}
