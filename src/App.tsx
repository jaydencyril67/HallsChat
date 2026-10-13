import { useEffect, useState, type ReactNode } from "react";
import LandingPage from "./LandingPage";
import SignupPage from "./SignupPage";
import SigninPage from "./SigninPage";
import HomePage from "./HomePage";
import HallsPage from "./HallsPage";
import DevPage from "./DevPage";
import GroupPage from "./GroupPage";
import ChatPage from "./ChatPage";
import CallsPage from "./CallsPage";
import ProfilePage from "./ProfilePage";
import AlertsPage from "./AlertsPage";
import ThemeSettingsPage from "./ThemeSettingsPage";
import PublicProfilePage from "./PublicProfilePage";
import EmailVerificationPage from "./EmailVerificationPage";
import ForgotPasswordPage from "./ForgotPasswordPage";
import AppHeader from "./AppHeader";
import NowBar from "./NowBar";
import { navigate } from "./utils/navigate";
import LoadingDots from "./components/LoadingDots";
import AppThemeProvider from "./components/AppTheme";
import SharedPostPage from "./SharedPostPage";

const navigationSections: Record<string, { title: string; description: string }> = {
  "/chats": { title: "Rooms", description: "Your conversations will live here." },
  "/contacts": { title: "People", description: "Your contacts and connections will live here." },
  "/calls": { title: "Calls", description: "Your calls will live here." },
  "/groups": { title: "Halls", description: "Your Halls conversations will live here." },
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


function GlobalModalScrollLock() {
  useEffect(() => {
    let locked = false;
    let savedScrollY = 0;
    let previousBody: { position: string; top: string; left: string; right: string; width: string; overflow: string } | null = null;
    let previousHtmlOverflow = "";

    const syncLock = () => {
      // The comments sheet already has its own position-preserving scroll lock.
      const commentsOpen = document.querySelector(".social-comments-sheet[aria-modal=\"true\"]");
      const modalOpen = Boolean(document.querySelector('[role="dialog"][aria-modal="true"]'));
      const shouldLock = modalOpen && !commentsOpen;

      if (shouldLock && !locked) {
        savedScrollY = window.scrollY || window.pageYOffset || 0;
        const body = document.body;
        const html = document.documentElement;
        previousBody = {
          position: body.style.position,
          top: body.style.top,
          left: body.style.left,
          right: body.style.right,
          width: body.style.width,
          overflow: body.style.overflow,
        };
        previousHtmlOverflow = html.style.overflow;
        body.style.position = "fixed";
        body.style.top = `-${savedScrollY}px`;
        body.style.left = "0";
        body.style.right = "0";
        body.style.width = "100%";
        body.style.overflow = "hidden";
        html.style.overflow = "hidden";
        locked = true;
      } else if (!shouldLock && locked) {
        const body = document.body;
        const html = document.documentElement;
        if (previousBody) {
          body.style.position = previousBody.position;
          body.style.top = previousBody.top;
          body.style.left = previousBody.left;
          body.style.right = previousBody.right;
          body.style.width = previousBody.width;
          body.style.overflow = previousBody.overflow;
        }
        html.style.overflow = previousHtmlOverflow;
        locked = false;
        previousBody = null;
        window.scrollTo(0, savedScrollY);
      }
    };

    const observer = new MutationObserver(syncLock);
    observer.observe(document.body, { childList: true, subtree: true });
    syncLock();
    return () => {
      observer.disconnect();
      if (locked) {
        const body = document.body;
        const html = document.documentElement;
        if (previousBody) {
          body.style.position = previousBody.position;
          body.style.top = previousBody.top;
          body.style.left = previousBody.left;
          body.style.right = previousBody.right;
          body.style.width = previousBody.width;
          body.style.overflow = previousBody.overflow;
        }
        html.style.overflow = previousHtmlOverflow;
        window.scrollTo(0, savedScrollY);
      }
    };
  }, []);

  return null;
}

export default function App() {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    if (window.location.pathname !== "/home" || !window.location.hash.startsWith("#post-")) return;
    try {
      const postId = decodeURIComponent(window.location.hash.slice("#post-".length));
      if (postId) navigate("/post/" + encodeURIComponent(postId));
    } catch {
      // Ignore malformed legacy post links and leave the normal home route intact.
    }
  }, []);


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
    const readTimeout = () => {
      const value = Number(localStorage.getItem("hallschat_idle_logout_minutes") || 0);
      return value === 5 || value === 10 || value === 30 ? value * 60_000 : 0;
    };
    const lastActivityKey = "hallschat_last_activity_at";
    let hasLoggedOut = false;
    const logoutIfExpired = () => {
      if (hasLoggedOut || !localStorage.getItem("hallschat_token")) return;
      const timeout = readTimeout();
      if (!timeout) return;
      const lastActivity = Number(localStorage.getItem(lastActivityKey) || 0);
      if (!lastActivity) {
        localStorage.setItem(lastActivityKey, String(Date.now()));
        return;
      }
      if (Date.now() - lastActivity >= timeout) {
        hasLoggedOut = true;
        localStorage.removeItem("hallschat_token");
        localStorage.removeItem(lastActivityKey);
        navigate("/signin", { replace: true });
      }
    };
    const recordActivity = () => {
      if (hasLoggedOut || document.visibilityState !== "visible" || !localStorage.getItem("hallschat_token")) return;
      if (readTimeout()) localStorage.setItem(lastActivityKey, String(Date.now()));
    };
    logoutIfExpired();
    const timer = window.setInterval(logoutIfExpired, 1000);
    const activityEvents: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart", "scroll", "input", "click"];
    activityEvents.forEach(eventName => window.addEventListener(eventName, recordActivity, { passive: true }));
    const onVisibilityChange = () => { if (document.visibilityState === "visible") logoutIfExpired(); };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", logoutIfExpired);
    return () => {
      window.clearInterval(timer);
      activityEvents.forEach(eventName => window.removeEventListener(eventName, recordActivity));
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", logoutIfExpired);
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
  const sharedPostMatch = normalizedPath.match(/^\/post\/([^/]+)$/);
  let page: ReactNode;
  if (sharedPostMatch) page = <SharedPostPage postId={decodeURIComponent(sharedPostMatch[1])} />;
  else if (normalizedPath === "/forgot-password") page = <ForgotPasswordPage />;
  else if (normalizedPath === "/verify-email") page = <EmailVerificationPage />;
  else if (normalizedPath === "/signup") page = <SignupPage />;
  else if (normalizedPath === "/signin" || normalizedPath === "/sign-in") page = <SigninPage />;
  else if (normalizedPath === "/home") page = <HomePage />;
  else if (normalizedPath === "/halls") page = <HallsPage />;
  else if (normalizedPath === "/groups") page = <GroupPage />;
  else if (normalizedPath === "/chats") page = <ChatPage />;
  else if (normalizedPath === "/calls") page = <CallsPage />;
  else if (normalizedPath === "/profile") page = <ProfilePage />;
  else if (normalizedPath === "/settings") page = <ThemeSettingsPage />;
  else if (normalizedPath === "/dev") page = <DevPage />;
  else if (normalizedPath === "/notifications" || normalizedPath === "/alerts") page = <AlertsPage />;
  else if (publicProfileMatch) page = <PublicProfilePage userId={decodeURIComponent(publicProfileMatch[1])} />;
  else if (navigationSections[normalizedPath]) {
    const section = navigationSections[normalizedPath];
    page = <NavigationSectionPage title={section.title} description={section.description} />;
  } else page = <LandingPage onSignup={() => navigate("/signup")} />;

  return <AppThemeProvider><>{page}<GlobalModalScrollLock /></></AppThemeProvider>;
}