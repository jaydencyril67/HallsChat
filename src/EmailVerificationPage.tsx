import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, CircleAlert, MailCheck } from "lucide-react";
import AppHeader from "./AppHeader";

type VerificationState = "loading" | "success" | "error";

export default function EmailVerificationPage() {
  const [state, setState] = useState<VerificationState>("loading");
  const [message, setMessage] = useState("Checking your confirmation link…");

  useEffect(() => {
    let cancelled = false;
    const token = new URLSearchParams(window.location.search).get("token") || "";
    if (!token) {
      setState("error");
      setMessage("This confirmation link is missing its token. Open the latest link from your HallsChat email.");
      return () => { cancelled = true; };
    }

    const apiBase = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
    fetch(`${apiBase}/api/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || "We couldn't confirm this email address.");
        return payload;
      })
      .then(payload => {
        if (cancelled) return;
        setState("success");
        setMessage(payload.message || "Your HallsChat email has been confirmed successfully.");
      })
      .catch(error => {
        if (cancelled) return;
        setState("error");
        setMessage(error instanceof Error ? error.message : "We couldn't confirm this email right now.");
      });

    return () => { cancelled = true; };
  }, []);

  return <main className="signup-page">
    <div className="signup-glow signup-glow-top" aria-hidden="true" />
    <div className="signup-glow signup-glow-bottom" aria-hidden="true" />
    <AppHeader homeHref="/" />
    <section className="signup-confirmation-panel" aria-live="polite">
      <div className={`signup-confirmation-icon ${state === "error" ? "signup-confirmation-icon-error" : ""}`}>
        {state === "loading" ? <MailCheck size={30} /> : state === "success" ? <CheckCircle2 size={30} /> : <CircleAlert size={30} />}
      </div>
      <span className="signup-form-kicker">{state === "loading" ? "SECURE EMAIL CONFIRMATION" : state === "success" ? "CONFIRMATION COMPLETE" : "CONFIRMATION NEEDS ATTENTION"}</span>
      <h1>{state === "loading" ? "Confirming your email" : state === "success" ? "You're confirmed" : "We couldn't confirm that link"}</h1>
      <p>{message}</p>
      {state === "success" && <div className="signup-confirmation-tip">Your email address is now confirmed. Keep an eye out for the next HallsChat account steps.</div>}
      {state === "error" && <div className="signup-confirmation-tip">Confirmation links expire after 15 minutes and can only be used once. Return to signup to request a fresh link if needed.</div>}
      {state !== "loading" && <a className="button button-primary signup-submit signup-confirmation-continue" href={state === "success" ? "/" : "/signup"}>{state === "success" ? "Continue to HallsChat" : "Return to signup"} <ArrowRight size={17} /></a>}
    </section>
  </main>;
}
