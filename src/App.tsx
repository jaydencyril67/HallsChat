import { useEffect, useState, type ReactNode } from "react";
import LandingPage from "./LandingPage";
import SignupPage from "./SignupPage";
import SigninPage from "./SigninPage";
import HomePage from "./HomePage";
import HallsPage from "./HallsPage";
import ChatPage from "./ChatPage";
import CallsPage from "./CallsPage";
import ProfilePage from "./ProfilePage";
import AlertsPage from "./AlertsPage";
import PublicProfilePage from "./PublicProfilePage";
import EmailVerificationPage from "./EmailVerificationPage";
import ForgotPasswordPage from "./ForgotPasswordPage";
import AppHeader from "./AppHeader";
import NowBar from "./NowBar";
import { navigate } from "./utils/navigate";
import LoadingDots from "./components/LoadingDots";
import { dismissSocialPostPublishStatus, getSocialPostPublishState, subscribeSocialPostPublishing, type SocialPostPublishState } from "./utils/socialPostPublisher";
import { dismissBackgroundTaskResult, getBackgroundTaskState, subscribeBackgroundTasks, type BackgroundTaskSnapshot } from "./utils/backgroundTasks";

const navigationSections: Record<string, { title: string; description: string }> = {
  "/chats": { title: "Chat", description: "Your conversations will live here." },
  "/contacts": { title: "People", description: "Your contacts and connections will live here." },
  "/calls": { title: "Calls", description: "Your calls will live here." },
  "/groups": { title: "Groups", description: "Your group conversations will live here." },
  "/settings": { title: "Settings", description: "Your HallsChat preferences will live here." },
  "/help": { title: "Help", description: "Help and support will live here." },
};

function NavigationSectionPage({ title, description }: { title: string; description: string }) {
  return <main className="home-page social-home">
    <AppHeader homeHref="/home" />
    <section className="home-shell social-shell">
      <div className="home-state">
        <h1>{title}</h1>
        <p>{description}</p>
        <p>This section is not connected yet, but navigation is working without a full-page reload.</p>
      </div>
    </section>
    <NowBar />
  </main>;
}


function GlobalPostPublishingStatus() {
  const [publishState, setPublishState] = useState<SocialPostPublishState>(() => getSocialPostPublishState());

  useEffect(() => subscribeSocialPostPublishing(setPublishState), []);

  useEffect(() => {
    if (publishState.phase !== "success" && publishState.phase !== "error") return;
    const timer = window.setTimeout(() => dismissSocialPostPublishStatus(), 6000);
    return () => window.clearTimeout(timer);
  }, [publishState.phase, publishState.revision, publishState.message]);

  if (publishState.phase === "idle") return null;
  const uploading = publishState.phase === "uploading";
  const failed = publishState.phase === "error";
  return <>
    {uploading && <style>{`@keyframes hallschat-global-post-progress { from { transform: translateX(-110%); } to { transform: translateX(280%); } }`}</style>}
    <div role={failed ? "alert" : "status"} aria-live="polite" style={{ position: "fixed", left: 14, right: 14, bottom: "calc(76px + env(safe-area-inset-bottom, 0px))", zIndex: 9999, maxWidth: 440, margin: "0 auto", boxSizing: "border-box", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: `1px solid ${failed ? "rgba(255,120,120,.28)" : "rgba(255,210,219,.2)"}`, borderRadius: 14, background: failed ? "linear-gradient(145deg,rgba(54,18,22,.98),rgba(22,12,15,.98))" : "linear-gradient(145deg,rgba(38,18,27,.98),rgba(18,12,20,.98))", boxShadow: "0 12px 34px rgba(0,0,0,.38)", color: "#fff0f3", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
      <span style={{ display: "grid", placeItems: "center", width: 34, height: 34, flexShrink: 0, borderRadius: 10, background: "rgba(255,129,146,.12)", color: "#ff9bab" }}>{uploading ? <LoadingDots/> : failed ? "!" : "✓"}</span>
      <span style={{ display: "grid", gap: 3, minWidth: 0, flex: 1 }}>
        <strong style={{ fontSize: ".88rem", fontWeight: 650 }}>{uploading ? "Posting in the background" : failed ? "Post couldn't be published" : "Post published"}</strong>
        <span style={{ fontSize: ".78rem", color: "#e5cbd2", overflowWrap: "anywhere" }}>{publishState.status || publishState.message}</span>
        {uploading && <span style={{ display: "block", height: 3, marginTop: 3, overflow: "hidden", borderRadius: 99, background: "rgba(255,255,255,.12)" }}><span style={{ display: "block", width: "36%", height: "100%", borderRadius: 99, background: "#ff8192", animation: "hallschat-global-post-progress 1.2s ease-in-out infinite alternate" }}/></span>}
      </span>
      {!uploading && <button type="button" onClick={dismissSocialPostPublishStatus} aria-label="Dismiss post status" style={{ border: 0, background: "transparent", color: "#fff0f3", fontSize: 22, padding: "2px 4px", lineHeight: 1 }}>×</button>}
    </div>
  </>;
}


function GlobalBackgroundTaskStatus() {
  const [taskState, setTaskState] = useState<BackgroundTaskSnapshot>(() => getBackgroundTaskState());
  useEffect(() => subscribeBackgroundTasks(setTaskState), []);
  useEffect(() => {
    if (taskState.tasks.length || !taskState.lastResult) return;
    const timer = window.setTimeout(() => dismissBackgroundTaskResult(), 5500);
    return () => window.clearTimeout(timer);
  }, [taskState.tasks.length, taskState.revision]);

  const active = taskState.tasks[taskState.tasks.length - 1];
  const result = !active ? taskState.lastResult : null;
  if (!active && !result) return null;
  const failed = Boolean(result?.error);
  const title = active
    ? (taskState.tasks.length > 1 ? `${taskState.tasks.length} tasks running` : active.label)
    : failed ? `${result!.label} failed` : `${result!.label} complete`;
  const status = active
    ? (taskState.tasks.length > 1 ? `${active.status} · ${taskState.tasks.length} operations in progress` : active.status)
    : result!.status;
  return <>
    {active && <style>{`@keyframes hallschat-global-task-progress { from { transform: translateX(-110%); } to { transform: translateX(280%); } }`}</style>}
    <div role={failed ? "alert" : "status"} aria-live="polite" style={{ position: "fixed", left: 14, right: 14, bottom: "calc(148px + env(safe-area-inset-bottom, 0px))", zIndex: 9998, maxWidth: 440, margin: "0 auto", boxSizing: "border-box", display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: `1px solid ${failed ? "rgba(255,120,120,.28)" : "rgba(255,210,219,.2)"}`, borderRadius: 14, background: failed ? "linear-gradient(145deg,rgba(54,18,22,.98),rgba(22,12,15,.98))" : "linear-gradient(145deg,rgba(38,18,27,.98),rgba(18,12,20,.98))", boxShadow: "0 12px 34px rgba(0,0,0,.38)", color: "#fff0f3", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
      <span style={{ display: "grid", placeItems: "center", width: 34, height: 34, flexShrink: 0, borderRadius: 10, background: "rgba(255,129,146,.12)", color: "#ff9bab" }}>{active ? <LoadingDots/> : failed ? "!" : "✓"}</span>
      <span style={{ display: "grid", gap: 3, minWidth: 0, flex: 1 }}>
        <strong style={{ fontSize: ".88rem", fontWeight: 650 }}>{title}</strong>
        <span style={{ fontSize: ".78rem", color: "#e5cbd2", overflowWrap: "anywhere" }}>{status}</span>
        {active && <span style={{ display: "block", height: 3, marginTop: 3, overflow: "hidden", borderRadius: 99, background: "rgba(255,255,255,.12)" }}><span style={{ display: "block", width: "36%", height: "100%", borderRadius: 99, background: "#ff8192", animation: "hallschat-global-task-progress 1.2s ease-in-out infinite alternate" }}/></span>}
      </span>
    </div>
  </>;
}

export default function App() {
  const [path, setPath] = useState(() => window.location.pathname);


  useEffect(() => {
    let stopped = false;
    const sendHeartbeat = async () => {
      const savedToken = localStorage.getItem("hallschat_token");
      if (!savedToken || document.visibilityState !== "visible" || stopped) return;
      try {
        const configuredApi = import.meta.env.VITE_API_URL || "https://hallschats.onrender.com";
        const apiBase = configuredApi.endsWith("/") ? configuredApi.slice(0, -1) : configuredApi;
        await fetch(`${apiBase}/api/presence/heartbeat`, {
          method: "POST",
          headers: { Authorization: `Bearer ${savedToken}` }
        });
      } catch {
        // Presence naturally expires when heartbeats stop; do not interrupt the app.
      }
    };
    void sendHeartbeat();
    const timer = window.setInterval(() => { void sendHeartbeat(); }, 25000);
    const onVisibility = () => { if (document.visibilityState === "visible") void sendHeartbeat(); };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      document.getElementById("initial-splash")?.remove();
    }, 3000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const syncPath = () => setPath(window.location.pathname);
    const handleInternalLinks = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname.startsWith("/api/")) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        if (url.hash && url.hash !== window.location.hash) return;
        event.preventDefault();
        return;
      }
      event.preventDefault();
      navigate(`${url.pathname}${url.search}${url.hash}`);
    };

    window.addEventListener("popstate", syncPath);
    window.addEventListener("hallschat:navigation-start", syncPath);
    document.addEventListener("click", handleInternalLinks);
    return () => {
      window.removeEventListener("popstate", syncPath);
      window.removeEventListener("hallschat:navigation-start", syncPath);
      document.removeEventListener("click", handleInternalLinks);
    };
  }, []);


  const normalizedPath = path.split(/[?#]/)[0].replace(/\/$/, "") || "/";
  const publicProfileMatch = normalizedPath.match(/^\/users\/([^/]+)$/);
  let page: ReactNode;
  if (normalizedPath === "/forgot-password") page = <ForgotPasswordPage />;
  else if (normalizedPath === "/verify-email") page = <EmailVerificationPage />;
  else if (normalizedPath === "/signup") page = <SignupPage />;
  else if (normalizedPath === "/signin" || normalizedPath === "/sign-in") page = <SigninPage />;
  else if (normalizedPath === "/home") page = <HomePage />;
  else if (normalizedPath === "/halls") page = <HallsPage />;
  else if (normalizedPath === "/chats") page = <ChatPage />;
  else if (normalizedPath === "/calls") page = <CallsPage />;
  else if (normalizedPath === "/profile") page = <ProfilePage />;
  else if (normalizedPath === "/notifications" || normalizedPath === "/alerts") page = <AlertsPage />;
  else if (publicProfileMatch) page = <PublicProfilePage userId={decodeURIComponent(publicProfileMatch[1])} />;
  else if (navigationSections[normalizedPath]) {
    const section = navigationSections[normalizedPath];
    page = <NavigationSectionPage title={section.title} description={section.description} />;
  } else page = <LandingPage onSignup={() => navigate("/signup")} />;

  return <>{page}<GlobalPostPublishingStatus /><GlobalBackgroundTaskStatus /></>;
}