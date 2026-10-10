import { useEffect, useRef, useState } from "react";
import { Bell, ChevronDown, CircleHelp, ContactRound, Home, MessageCircle, Phone, Settings, UsersRound } from "lucide-react";

type View = "title" | "actions";
type Mode = "compact" | "expanded";

const actions = [
  { label: "HOME", icon: Home },
  { label: "CHATS", icon: MessageCircle },
  { label: "CONTACTS", icon: ContactRound },
  { label: "CALLS", icon: Phone },
  { label: "GROUPS", icon: UsersRound },
  { label: "NOTIFICATIONS", icon: Bell },
  { label: "SETTINGS", icon: Settings },
  { label: "HELP", icon: CircleHelp },
];

function getPageTitle() {
  const path = (window.location.pathname || "/").replace(/\/$/, "") || "/";
  if (path === "/dashboard" || path === "/home") return "HOME";
  if (path === "/signin" || path === "/sign-in") return "SIGN IN";
  if (path === "/signup") return "SIGN UP";
  if (path === "/confirm-email") return "CONFIRM EMAIL";
  if (path.startsWith("/chats")) return "CHATS";
  if (path.startsWith("/contacts")) return "CONTACTS";
  if (path.startsWith("/calls")) return "CALLS";
  if (path.startsWith("/groups")) return "GROUPS";
  if (path.startsWith("/notifications")) return "NOTIFICATIONS";
  if (path.startsWith("/settings")) return "SETTINGS";
  if (path.startsWith("/help")) return "HELP";
  return "HALLSCHAT";
}

export default function NowBar() {
  const [view, setView] = useState<View>("title");
  const [mode, setMode] = useState<Mode>("compact");
  const [pageTitle, setPageTitle] = useState(getPageTitle);
  const [activeAction, setActiveAction] = useState("HOME");
  const [pressing, setPressing] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTriggered = useRef(false);
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const syncPath = () => {
      setPageTitle(getPageTitle());
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

  const resetIdleTimer = () => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setView("title"), 10000);
  };

  const startHold = () => {
    holdTriggered.current = false;
    setPressing(true);
    resetIdleTimer();
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => {
      holdTriggered.current = true;
      setView("actions");
      setMode(current => current === "compact" ? "expanded" : "compact");
    }, 700);
  };

  const stopHold = () => {
    setPressing(false);
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

  const chooseAction = (label: string) => {
    setActiveAction(label);
    setPageTitle(label);
    setView("title");
    setMode("compact");
    if (idleTimer.current) clearTimeout(idleTimer.current);
  };

  return (
    <div className={`nowbar-dock ${view === "title" ? "nowbar-dock-title" : ""} ${mode === "expanded" && view === "actions" ? "nowbar-dock-expanded" : ""}`}>
      <div
        ref={barRef}
        className={`nowbar-shell ${view === "title" ? "nowbar-shell-title" : "nowbar-shell-actions"} ${mode === "expanded" && view === "actions" ? "nowbar-shell-expanded" : ""} ${pressing ? "nowbar-pressing" : ""}`}
        role="button"
        tabIndex={0}
        aria-label={view === "title" ? `${pageTitle} page. Tap to show navigation buttons; hold to expand.` : "Navigation buttons. Tap to show current page."}
        onClick={toggleView}
        onMouseDown={startHold}
        onMouseUp={stopHold}
        onMouseLeave={stopHold}
        onTouchStart={startHold}
        onTouchEnd={stopHold}
        onTouchCancel={stopHold}
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
                >
                  <span className="nowbar-icon"><Icon size={18} /></span>
                  {mode !== "expanded" && <span className="nowbar-label-compact">{label}</span>}
                  {mode === "expanded" && (
                    label.length > 12 ? (
                      <span className="nowbar-label-expanded nowbar-marquee-viewport">
                        <span className="nowbar-marquee-track">{label.toUpperCase()}&nbsp;&nbsp;•&nbsp;&nbsp;{label.toUpperCase()}</span>
                      </span>
                    ) : (
                      <span className="nowbar-label-expanded">{label.toUpperCase()}</span>
                    )
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
