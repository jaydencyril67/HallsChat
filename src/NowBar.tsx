import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, CircleHelp, Code2, ContactRound, Globe, Home, MessagesSquare, Phone, Settings, UsersRound, UserRound } from "lucide-react";
import { navigate } from "./utils/navigate";
const getNowbarFeature = (key: string) => { try { return window.localStorage.getItem(key) !== "false"; } catch { return true; } };
const swipeRoutes = ["/home", "/rooms", "/halls", "/profile", "/calls", "/groups", "/settings", "/help", "/dev"];

type View = "title" | "actions";
type Mode = "compact" | "expanded";

const NOWBAR_ACTION_STORAGE_KEY = "hallschat-nowbar-action";
const NOWBAR_GLOBE_MIGRATION_KEY = "hallschat-nowbar-globe-migration-v1";

function readSavedNowBarAction() {
  try {
    const saved = window.localStorage.getItem(NOWBAR_ACTION_STORAGE_KEY);
    if (window.localStorage.getItem(NOWBAR_GLOBE_MIGRATION_KEY) !== "true") {
      window.localStorage.setItem(NOWBAR_GLOBE_MIGRATION_KEY, "true");
      if (saved === "HALLS") {
        window.localStorage.setItem(NOWBAR_ACTION_STORAGE_KEY, "GLOBE");
        return "GLOBE";
      }
    }
    return saved === "CHAT" ? "ROOMS" : saved === "GROUP" ? "HALLS" : saved;
  } catch {
    return null;
  }
}

function saveNowBarAction(label: string) {
  try {
    window.localStorage.setItem(NOWBAR_GLOBE_MIGRATION_KEY, "true");
    window.localStorage.setItem(NOWBAR_ACTION_STORAGE_KEY, label.trim().toUpperCase());
  } catch {
    // Keep the NowBar usable when storage is unavailable.
  }
}

const actions = [
  { label: "HOME", icon: Home },
  { label: "ROOMS", icon: MessagesSquare },
  { label: "GLOBE", icon: Globe },
  { label: "PROFILE", icon: UserRound },
  { label: "CALLS", icon: Phone },
  { label: "HALLS", icon: UsersRound },
  { label: "SETTINGS", icon: Settings },
  { label: "HELP", icon: CircleHelp },
  { label: "DEV", icon: Code2 },
];

function getPageTitle() {
  const path = (window.location.pathname || "/").replace(/\/$/, "") || "/";
  if (path === "/home") return "HOME";
  if (path.startsWith("/profile")) return "PROFILE";
  if (path === "/signin" || path === "/sign-in") return "SIGN IN";
  if (path === "/signup") return "SIGN UP";
  if (path === "/confirm-email" || path === "/verify-email") return "CONFIRM EMAIL";
  if (path.startsWith("/rooms")) return "ROOMS";
  if (path.startsWith("/contacts")) return "PEOPLE";
  if (path.startsWith("/halls")) return "GLOBE";
  if (path.startsWith("/calls")) return "CALLS";
  if (path.startsWith("/groups")) return "HALLS";
  if (path.startsWith("/notifications")) return "ALERT";
  if (path.startsWith("/settings")) return "SETTINGS";
  if (path.startsWith("/help")) return "HELP";
  if (path === "/dev/api-keys") return "API KEYS";
  if (path === "/dev/webhooks") return "WEBHOOKS";
  if (path.startsWith("/dev")) return "DEV";
  return "HALLSCHAT";
}

export default function NowBar() {
  const [view, setView] = useState<View>("title");
  const [mode, setMode] = useState<Mode>("compact");
  const [pageTitle, setPageTitle] = useState(getPageTitle);
  const [swipeEnabled, setSwipeEnabled] = useState(() => getNowbarFeature("hallschat_nowbar_swipe_enabled"));
  const [expandEnabled, setExpandEnabled] = useState(() => getNowbarFeature("hallschat_nowbar_expand_enabled"));
  const [edgeColorVersion, setEdgeColorVersion] = useState(0);
  const [buttonColorVersion, setButtonColorVersion] = useState(0);
  const buttonColorSettings = useMemo(() => {
    try {
      const color = localStorage.getItem("hallschat_nowbar_button_color");
      return {
        enabled: localStorage.getItem("hallschat_nowbar_button_color_enabled") === "true",
        color: color && /^#[0-9a-f]{6}$/i.test(color) ? color : "#38bdf8"
      };
    } catch {
      return { enabled: false, color: "#38bdf8" };
    }
  }, [buttonColorVersion]);
  const edgeColorSettings = useMemo(() => {
    try {
      const color = localStorage.getItem("hallschat_nowbar_color");
      const mode = localStorage.getItem("hallschat_nowbar_light_style");
      return {
        enabled: localStorage.getItem("hallschat_nowbar_color_enabled") === "true",
        color: color && /^#[0-9a-f]{6}$/i.test(color) ? color : "#38bdf8",
        mode: ["stable-light", "stable", "blink-light", "blink", "pulse-light", "pulse", "color-light", "color"].includes(mode || "") ? mode! : "stable"
      };
    } catch {
      return { enabled: false, color: "#38bdf8", mode: "stable" };
    }
  }, [edgeColorVersion]);
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
  const actionsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const syncFeatures = () => { setSwipeEnabled(getNowbarFeature("hallschat_nowbar_swipe_enabled")); setExpandEnabled(getNowbarFeature("hallschat_nowbar_expand_enabled")); };
    window.addEventListener("storage", syncFeatures); window.addEventListener("hallschat:nowbar-settings-changed", syncFeatures);
    return () => { window.removeEventListener("storage", syncFeatures); window.removeEventListener("hallschat:nowbar-settings-changed", syncFeatures); };
  }, []);

  useEffect(() => {
    const syncEdgeColor = () => setEdgeColorVersion(version => version + 1);
    window.addEventListener("storage", syncEdgeColor);
    window.addEventListener("hallschat:nowbar-color-changed", syncEdgeColor);
    return () => { window.removeEventListener("storage", syncEdgeColor); window.removeEventListener("hallschat:nowbar-color-changed", syncEdgeColor); };
  }, []);

  useEffect(() => {
    const syncButtonColor = () => setButtonColorVersion(version => version + 1);
    window.addEventListener("storage", syncButtonColor);
    window.addEventListener("hallschat:nowbar-button-color-changed", syncButtonColor);
    return () => { window.removeEventListener("storage", syncButtonColor); window.removeEventListener("hallschat:nowbar-button-color-changed", syncButtonColor); };
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
    const scrollContainer = actionsRef.current;
    if (mode === "expanded" || view !== "actions" || !scrollContainer) return;
    const targetLabel = readSavedNowBarAction();
    if (!targetLabel) return;

    const target = Array.from(scrollContainer.querySelectorAll<HTMLButtonElement>("button[aria-label]"))
      .find(button => button.getAttribute("aria-label") === targetLabel);
    if (!target) return;

    const centerTarget = () => {
      const container = actionsRef.current;
      if (!container || !target.isConnected) return;
      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const maxScrollLeft = container.scrollWidth - container.clientWidth;
      const centeredScrollLeft = container.scrollLeft + targetRect.left - containerRect.left - (container.clientWidth - targetRect.width) / 2;
      container.scrollLeft = Math.max(0, Math.min(centeredScrollLeft, maxScrollLeft));
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
      ROOMS: "/rooms",
      PEOPLE: "/contacts",
      GLOBE: "/halls",
      PROFILE: "/profile",
      CALLS: "/calls",
      HALLS: "/groups",
      SETTINGS: "/settings",
      HELP: "/help",
      DEV: "/dev",
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
    <>
      <style>{`@keyframes nowbar-edge-blink-light { 0%, 42%, 100% { border-color: var(--edge-light); box-shadow: 0 18px 50px rgba(0,0,0,.82); } 48%, 94% { border-color: rgba(255,255,255,.88); box-shadow: 0 18px 50px rgba(0,0,0,.82); } }

@keyframes nowbar-edge-blink-light { 0%, 42%, 100% { border-color: var(--edge-light); box-shadow: 0 18px 50px rgba(0,0,0,.82); } 48%, 94% { border-color: rgba(255,255,255,.88); box-shadow: 0 18px 50px rgba(0,0,0,.82); } }

@keyframes nowbar-edge-pulse-light { 0%, 100% { border-color: var(--edge-light); filter: saturate(1); box-shadow: 0 0 0 1px var(--edge-light), 0 0 7px var(--edge-light), 0 18px 50px rgba(0,0,0,.82); } 50% { border-color: var(--edge-light); filter: saturate(1.25); box-shadow: 0 0 0 2px var(--edge-light), 0 0 16px var(--edge-light), 0 18px 50px rgba(0,0,0,.82); } }

@keyframes nowbar-edge-pulse-light { 0%, 100% { border-color: var(--edge-light); filter: saturate(1); box-shadow: 0 0 0 1px var(--edge-light), 0 0 7px var(--edge-light), 0 18px 50px rgba(0,0,0,.82); } 50% { border-color: var(--edge-light); filter: saturate(1.25); box-shadow: 0 0 0 2px var(--edge-light), 0 0 16px var(--edge-light), 0 18px 50px rgba(0,0,0,.82); } }

@keyframes nowbar-edge-color-light { 0% { border-color: #38bdf8; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 4% { border-color: #22d3ee; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 8% { border-color: #14b8a6; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 12% { border-color: #10b981; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 16% { border-color: #84cc16; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 20% { border-color: #eab308; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 24% { border-color: #facc15; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 28% { border-color: #f97316; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 32% { border-color: #ef4444; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 36% { border-color: #e11d48; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 40% { border-color: #db2777; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 44% { border-color: #ec4899; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 48% { border-color: #d946ef; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 52% { border-color: #a855f7; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 56% { border-color: #8b5cf6; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 60% { border-color: #6366f1; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 64% { border-color: #4f46e5; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 68% { border-color: #2563eb; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 72% { border-color: #0ea5e9; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 76% { border-color: #06b6d4; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 80% { border-color: #2dd4bf; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 84% { border-color: #34d399; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 88% { border-color: #a3e635; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 92% { border-color: #fbbf24; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 96% { border-color: #fb923c; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 100% { border-color: #38bdf8; box-shadow: 0 18px 50px rgba(0,0,0,.82); } }

@keyframes nowbar-edge-color-light { 0% { border-color: #38bdf8; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 4% { border-color: #22d3ee; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 8% { border-color: #14b8a6; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 12% { border-color: #10b981; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 16% { border-color: #84cc16; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 20% { border-color: #eab308; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 24% { border-color: #facc15; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 28% { border-color: #f97316; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 32% { border-color: #ef4444; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 36% { border-color: #e11d48; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 40% { border-color: #db2777; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 44% { border-color: #ec4899; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 48% { border-color: #d946ef; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 52% { border-color: #a855f7; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 56% { border-color: #8b5cf6; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 60% { border-color: #6366f1; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 64% { border-color: #4f46e5; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 68% { border-color: #2563eb; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 72% { border-color: #0ea5e9; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 76% { border-color: #06b6d4; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 80% { border-color: #2dd4bf; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 84% { border-color: #34d399; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 88% { border-color: #a3e635; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 92% { border-color: #fbbf24; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 96% { border-color: #fb923c; box-shadow: 0 18px 50px rgba(0,0,0,.82); } 100% { border-color: #38bdf8; box-shadow: 0 18px 50px rgba(0,0,0,.82); } }`}</style>
      <div className={`nowbar-dock theme-fixed-dark ${view === "title" ? "nowbar-dock-title" : ""} ${mode === "expanded" && view === "actions" ? "nowbar-dock-expanded" : ""}`}>
      <div
        ref={barRef}
        className={`nowbar-shell ${view === "title" ? "nowbar-shell-title" : "nowbar-shell-actions"} ${mode === "expanded" && view === "actions" ? "nowbar-shell-expanded" : ""} ${edgeColorSettings.enabled ? "nowbar-edge-enabled nowbar-edge-" + edgeColorSettings.mode : ""}`}
        style={edgeColorSettings.enabled ? ({
          "--edge-light": edgeColorSettings.color,
          "--edge-light-mode": edgeColorSettings.mode,
          borderColor: edgeColorSettings.color,
          ...(edgeColorSettings.mode === "stable-light" ? { boxShadow: "0 18px 50px rgba(0,0,0,.82)" } : {}),
          ...(edgeColorSettings.mode === "stable" ? { boxShadow: `0 0 0 1px rgba(255,255,255,.12), 0 0 24px ${edgeColorSettings.color}, 0 18px 50px rgba(0,0,0,.82), inset 0 1px 0 rgba(255,255,255,.12)` } : {}),
          animation: edgeColorSettings.mode === "stable" || edgeColorSettings.mode === "stable-light" ? undefined : `nowbar-edge-${edgeColorSettings.mode} ${["blink", "blink-light", "pulse", "pulse-light"].includes(edgeColorSettings.mode) ? "3.2s" : ["color", "color-light"].includes(edgeColorSettings.mode) ? "6s" : "2.8s"} ease-in-out infinite`,
          animationFillMode: "both",
          willChange: "border-color, box-shadow, filter"
        } as React.CSSProperties) : undefined}
        data-nowbar-edge-style={edgeColorSettings.enabled ? edgeColorSettings.mode : undefined}
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
          <div ref={actionsRef} className={`nowbar-actions ${mode === "expanded" ? "nowbar-actions-expanded" : ""}`}>
            {actions.map(({ label, icon: Icon }) => (
              <div className="nowbar-slot" key={label}>
                <button
                  type="button"
                  className={`nowbar-action ${activeAction === label ? "nowbar-action-active" : ""}`}
                  style={buttonColorSettings.enabled ? { borderColor: buttonColorSettings.color } : undefined}
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
    </>
  );
}
