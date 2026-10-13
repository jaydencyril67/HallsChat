import { useEffect, useRef, useState } from "react";
import { ChevronDown, CircleHelp, ContactRound, Home, MessageCircle, Phone, Settings, UsersRound, UserRound } from "lucide-react";
import { navigate } from "./utils/navigate";
const getNowbarFeature = (key: string) => { try { return window.localStorage.getItem(key) !== "false"; } catch { return true; } };
const swipeRoutes = ["/home", "/chats", "/halls", "/profile", "/calls", "/groups", "/settings", "/help"];

type View = "title" | "actions";
type Mode = "compact" | "expanded";

const NOWBAR_ACTION_STORAGE_KEY = "hallschat-nowbar-action";

function readSavedNowBarAction() {
  try {
    return window.localStorage.getItem(NOWBAR_ACTION_STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveNowBarAction(label: string) {
  try {
    window.localStorage.setItem(NOWBAR_ACTION_STORAGE_KEY, label.trim().toUpperCase());
  } catch {
    // Keep the NowBar usable when storage is unavailable.
  }
}

const actions = [
  { label: "HOME", icon: Home },
  { label: "CHAT", icon: MessageCircle },
  { label: "HALLS", icon: UsersRound },
  { label: "PROFILE", icon: UserRound },
  { label: "CALLS", icon: Phone },
  { label: "GROUP", icon: UsersRound },
  { label: "SETTINGS", icon: Settings },
  { label: "HELP", icon: CircleHelp },
];

function getPageTitle() {
  const path = (window.location.pathname || "/").replace(/\/$/, "") || "/";
  if (path === "/home") return "HOME";
  if (path.startsWith("/profile")) return "PROFILE";
  if (path === "/signin" || path === "/sign-in") return "SIGN IN";
  if (path === "/signup") return "SIGN UP";
  if (path === "/confirm-email" || path === "/verify-email") return "CONFIRM EMAIL";
  if (path.startsWith("/chats")) return "CHAT";
  if (path.startsWith("/contacts")) return "PEOPLE";
  if (path.startsWith("/halls")) return "HALLS";
  if (path.startsWith("/calls")) return "CALLS";
  if (path.startsWith("/groups")) return "GROUP";
  if (path.startsWith("/notifications")) return "ALERT";
  if (path.startsWith("/settings")) return "SETTINGS";
  if (path.startsWith("/help")) return "HELP";
  return "HALLSCHAT";
}

export default function NowBar() {
  const [view, setView] = useState<View>("title");
  const [mode, setMode] = useState<Mode>("compact");
  const [pageTitle, setPageTitle] = useState(getPageTitle);
  const [swipeEnabled, setSwipeEnabled] = useState(() => getNowbarFeature("hallschat_nowbar_swipe_enabled"));
  const [expandEnabled, setExpandEnabled] = useState(() => getNowbarFeature("hallschat_nowbar_expand_enabled"));
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const swipeHandled = useRef(false);
  const [activeAction, setActiveAction] = useState(() => {
    const title = getPageTitle();
    return actions.find(action => action.label === title)?.label ?? "HOME";
  });
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTriggered = useRef(false);
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const syncFeatures = () => { setSwipeEnabled(getNowbarFeature("hallschat_nowbar_swipe_enabled")); setExpandEnabled(getNowbarFeature("hallschat_nowbar_expand_enabled")); };
    window.addEventListener("storage", syncFeatures); window.addEventListener("hallschat:nowbar-settings-changed", syncFeatures);
    return () => { window.removeEventListener("storage", syncFeatures); window.removeEventListener("hallschat:nowbar-settings-changed", syncFeatures); };
  }, []);

  useEffect(() => {
    const syncPath = () => {
      const title = getPageTitle();
      setPageTitle(title);
      setActiveAction(actions.find(action => action.label === title)?.label ?? "");
      setView("title");
      setMode("compact");
    };
    window.addEventListener("popstate", syncPath);
    window.addEventListener("hashchange", syncPath);
    window.addEventListener("hallschat:navigation-start", syncPath);
    return () => {
      window.removeEventListener("popstate", syncPath);
      window.removeEventListener("hashchange", syncPath);
      window.removeEventListener("hallschat:navigation-start", syncPath);
    };
  }, []);

  useEffect(() => () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (idleTimer.current) clearTimeout(idleTimer.current);
  }, []);

  // Match CryBots: remember the last compact NowBar action and center it when
  // the navigation buttons are opened again.
  useEffect(() => {
    if (mode === "expanded" || view !== "actions" || !barRef.current) return;
    const targetLabel = readSavedNowBarAction();
    if (!targetLabel) return;

    const target = Array.from(barRef.current.querySelectorAll<HTMLButtonElement>("button[aria-label]"))
      .find(button => button.getAttribute("aria-label") === targetLabel);
    if (!target) return;

    const centerTarget = () => {
      if (!barRef.current) return;
      const maxScrollLeft = barRef.current.scrollWidth - barRef.current.clientWidth;
      const nextScrollLeft = target.offsetLeft - (barRef.current.clientWidth - target.offsetWidth) / 2;
      barRef.current.scrollLeft = Math.max(0, Math.min(nextScrollLeft, maxScrollLeft));
    };

    centerTarget();
    const frame = window.requestAnimationFrame(centerTarget);
    return () => window.cancelAnimationFrame(frame);
  }, [pageTitle, mode, view]);

  const resetIdleTimer = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setView("title"), 10000);
  };

  const startHold = () => {
    holdTriggered.current = false;
    resetIdleTimer();
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      holdTriggered.current = true;
      setView("actions");
      if (expandEnabled) setMode(current => current === "compact" ? "expanded" : "compact");
    }, 700);
  };

  const stopHold = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const toggleView = () => {
    if (holdTriggered.current) {
      holdTriggered.current = false;
      return;
    }
    setView(current => current === "title" ? "actions" : "title");
    resetIdleTimer();
  };

  const handleSwipeStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (!swipeEnabled || view !== "title" || event.touches.length !== 1) return;
    swipeStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  };
  const handleSwipeEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const start = swipeStart.current; swipeStart.current = null;
    if (!swipeEnabled || view !== "title" || !start || event.changedTouches.length !== 1) return;
    const touch = event.changedTouches[0], dx = touch.clientX - start.x, dy = touch.clientY - start.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) <= Math.abs(dy)) return;
    const path = (window.location.pathname || "/").replace(/\/$/, "") || "/";
    const index = swipeRoutes.indexOf(path), next = swipeRoutes[index + (dx < 0 ? 1 : -1)];
    if (index < 0 || !next) return;
    swipeHandled.current = true; holdTriggered.current = true;
    if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; }
    if (idleTimer.current) { clearTimeout(idleTimer.current); idleTimer.current = null; }
    navigate(next);
  };

  const chooseAction = (label: string) => {
    if (mode !== "expanded") saveNowBarAction(label);
    if (mode === "expanded" && label === pageTitle) {
      setView("title");
      setMode("compact");
      if (idleTimer.current) clearTimeout(idleTimer.current);
      return;
    }
    const routeByAction: Record<string, string> = {
      HOME: "/home",
      CHAT: "/chats",
      PEOPLE: "/contacts",
      HALLS: "/halls",
      PROFILE: "/profile",
      CALLS: "/calls",
      GROUP: "/groups",
      SETTINGS: "/settings",
      HELP: "/help",
    };
    setActiveAction(label);
    setPageTitle(label);
    setView("title");
    setMode("compact");
    if (idleTimer.current) clearTimeout(idleTimer.current);
    const targetPath = routeByAction[label];
    if (targetPath) navigate(targetPath);
  };

  return (
    <div className={`nowbar-dock theme-fixed-dark ${view === "title" ? "nowbar-dock-title" : ""} ${mode === "expanded" && view === "actions" ? "nowbar-dock-expanded" : ""}`}>
      <div
        ref={barRef}
        className={`nowbar-shell ${view === "title" ? "nowbar-shell-title" : "nowbar-shell-actions"} ${mode === "expanded" && view === "actions" ? "nowbar-shell-expanded" : ""}`}
        role="button"
        tabIndex={0}
        aria-label={view === "title" ? `${pageTitle} page. Tap to show navigation buttons; hold to expand.` : "Navigation buttons. Tap to show current page."}
        onClick={() => { if (swipeHandled.current) { swipeHandled.current = false; return; } toggleView(); }}
        onMouseDown={startHold}
        onMouseUp={stopHold}
        onMouseLeave={stopHold}
        onTouchStart={event => { startHold(); handleSwipeStart(event); }}
        onTouchEnd={event => { stopHold(); handleSwipeEnd(event); }}
        onTouchCancel={() => { stopHold(); swipeStart.current = null; }}
        onKeyDown={event => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            toggleView();
          }
        }}
      >
        <div className="nowbar-rail" aria-hidden="true" />
        {view === "title" ? (
          <div className="nowbar-title" aria-hidden="true">
            <span className="nowbar-orb" />
            <span className={`nowbar-page-label ${pageTitle.length > 16 ? "nowbar-page-label-long" : pageTitle.length > 10 ? "nowbar-page-label-medium" : ""}`}>{pageTitle}</span>
            <ChevronDown size={16} />
          </div>
        ) : (
          <div className={`nowbar-actions ${mode === "expanded" ? "nowbar-actions-expanded" : ""}`}>
            {actions.map(({ label, icon: Icon }) => (
              <div className="nowbar-slot" key={label}>
                <button
                  type="button"
                  className={`nowbar-action ${activeAction === label ? "nowbar-action-active" : ""}`}
                  aria-label={label}
                  onClick={event => {
                    event.stopPropagation();
                    chooseAction(label);
                  }}
                  onKeyDown={event => {
                    event.stopPropagation();
                  }}
                >
                  <span className="nowbar-icon"><Icon size={18} /></span>
                  {mode === "expanded" ? (
                    label.length > 12 ? (
                      <span className="nowbar-label-expanded nowbar-marquee-viewport">
                        <span className="nowbar-marquee-track">{label}&nbsp;&nbsp;•&nbsp;&nbsp;{label}</span>
                      </span>
                    ) : (
                      <span className="nowbar-label-expanded">{label}</span>
                    )
                  ) : (
                    <span className="nowbar-label-compact">{label}</span>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
