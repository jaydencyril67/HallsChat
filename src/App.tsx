import { useEffect, useState } from "react";
import LandingPage from "./LandingPage";
import SignupPage from "./SignupPage";
import SigninPage from "./SigninPage";
import HomePage from "./HomePage";
import HallsPage from "./HallsPage";
import ChatPage from "./ChatPage";
import ProfilePage from "./ProfilePage";
import EmailVerificationPage from "./EmailVerificationPage";
import ForgotPasswordPage from "./ForgotPasswordPage";
import AppHeader from "./AppHeader";
import NowBar from "./NowBar";
import { navigate } from "./utils/navigate";

const navigationSections: Record<string, { title: string; description: string }> = {
  "/chats": { title: "Chat", description: "Your conversations will live here." },
  "/contacts": { title: "People", description: "Your contacts and connections will live here." },
  "/calls": { title: "Calls", description: "Your calls will live here." },
  "/groups": { title: "Groups", description: "Your group conversations will live here." },
  "/notifications": { title: "Alerts", description: "Your notifications will live here." },
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
  if (normalizedPath === "/forgot-password") return <ForgotPasswordPage />;
  if (normalizedPath === "/verify-email") return <EmailVerificationPage />;
  if (normalizedPath === "/signup") return <SignupPage />;
  if (normalizedPath === "/signin" || normalizedPath === "/sign-in") return <SigninPage />;
  if (normalizedPath === "/home") return <HomePage />;
  if (normalizedPath === "/halls") return <HallsPage />;
  if (normalizedPath === "/chats") return <ChatPage />;
  if (normalizedPath === "/profile") return <ProfilePage />;
  if (navigationSections[normalizedPath]) {
    const section = navigationSections[normalizedPath];
    return <NavigationSectionPage title={section.title} description={section.description} />;
  }
  return <LandingPage onSignup={() => navigate("/signup")} />;
}
