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
    <div className={`nowbar-dock theme-fixed-dark ${view === "title" ? "nowbar-dock-title" : ""} ${mode === "expanded" && view === "actions" ? "nowbar-dock-expanded" : ""}`}>
      <div
        ref={barRef}
        className={`nowbar-shell ${view === "title" ? "nowbar-shell-title" : "nowbar-shell-actions"} ${mode === "expanded" && view === "actions" ? "nowbar-shell-expanded" : ""} ${edgeColorSettings.enabled ? "nowbar-edge-enabled nowbar-edge-" + edgeColorSettings.mode : ""}`}
        style={edgeColorSettings.enabled ? ({ "--nowbar-edge-color": edgeColorSettings.color } as React.CSSProperties) : undefined}
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
  );
}
