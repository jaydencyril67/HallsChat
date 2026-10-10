import { useEffect, useState } from "react";
import { ArrowUpRight, LogOut, MessageCircle, ShieldCheck, UserRound } from "lucide-react";
import AppHeader from "./AppHeader";

type Account = { id: string; name: string; username: string; email: string; createdAt?: string };

export default function DashboardPage() {
  const [user, setUser] = useState<Account | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("hallschat_token");
    if (!token) { window.location.replace("/signin"); return; }
    const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");
    fetch(`${apiBase}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || "Please sign in again.");
        if (!payload.user || typeof payload.user.name !== "string" || typeof payload.user.email !== "string") {
          throw new Error("We couldn't read your account details. Please sign in again.");
        }
        return payload.user as Account;
      })
      .then(account => { if (!cancelled) setUser(account); })
      .catch(err => {
        if (cancelled) return;
        localStorage.removeItem("hallschat_token");
        setError(err instanceof Error ? err.message : "Unable to load your account.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function signOut() {
    localStorage.removeItem("hallschat_token");
    window.location.replace("/signin");
  }

  return <main className="dashboard-page">
    <div className="signup-glow signup-glow-top" aria-hidden="true" />
    <AppHeader homeHref="/dashboard" />
    <section className="dashboard-shell">
      <div className="dashboard-topline"><span className="signup-form-kicker">YOUR HALLSCHAT SPACE</span><button className="dashboard-signout" type="button" onClick={signOut}><LogOut size={15} /> Sign out</button></div>
      {loading ? <div className="dashboard-state" role="status">Getting your space ready…</div> : error ? <div className="dashboard-state dashboard-error"><p>{error}</p><a className="button button-primary" href="/signin">Back to sign in <ArrowUpRight size={16} /></a></div> : user && <>
        <div className="dashboard-welcome"><div className="dashboard-avatar"><UserRound size={25} /></div><div><h1>Welcome, {user.name.trim().split(/\s+/)[0] || "there"}.</h1><p>You're signed in. This is the start of your HallsChat space.</p></div></div>
        <div className="dashboard-grid">
          <article className="dashboard-card dashboard-card-feature"><span className="dashboard-card-icon"><MessageCircle size={20} /></span><span className="signup-form-kicker">YOUR SPACE</span><h2>Conversations start here.</h2><p>Your account is ready. Chat features will appear here as they become available.</p><span className="dashboard-status"><i /> Account active</span></article>
          <article className="dashboard-card"><span className="dashboard-card-icon"><UserRound size={19} /></span><span className="signup-form-kicker">PROFILE</span><h2>{user.username}</h2><p>{user.email}</p><div className="dashboard-detail"><span>Full name</span><strong>{user.name}</strong></div></article>
          <article className="dashboard-card dashboard-card-security"><span className="dashboard-card-icon"><ShieldCheck size={19} /></span><span className="signup-form-kicker">ACCOUNT SECURITY</span><h2>Email verified</h2><p>Your email has been confirmed, and sign-in is enabled for this account.</p></article>
        </div>
        <p className="dashboard-footnote">HallsChat is just getting started. Your dashboard will grow as new features are added.</p>
      </>}
    </section>
  </main>;
}
