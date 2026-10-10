import { useEffect, useRef, useState } from "react";
import {
  Bell, ChevronDown, CircleHelp, ContactRound, Home, MessageCircle,
  Phone, Settings, UsersRound
} from "lucide-react";

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
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  if (path === "/dashboard") return "DASHBOARD";
  if (path === "/signin" || path === "/sign-in") return "SIGN IN";
  if (path === "/signup") return "SIGN UP";
  return "HALLSCHAT";
}

export default function NowBar() {
  const [view, setView] = useState<View>("title");
  const [mode, setMode] = useState<Mode>("compact");
  const [pageTitle, setPageTitle] = useState(getPageTitle);
  const [activeAction, setActiveAction] = useState("HOME");
  const [pressing, setPressing] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdTriggered = useRef(false);
  const barRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const syncPath = () => {
      setPageTitle(getPageTitle());
      setView("title");
      setMode("compact");
    };
    window.addEventListener("popstate", syncPath);
    return () => window.removeEventListener("popstate", syncPath);
  }, []);

  useEffect(() => () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
  }, []);

  const startHold = () => {
    holdTriggered.current = false;
    setPressing(true);
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
  };

  return (
    <div className={`nowbar-dock ${mode === "expanded" && view === "actions" ? "nowbar-dock-expanded" : ""}`}>
      <div
        ref={barRef}
        className={`nowbar-shell ${mode === "expanded" && view === "actions" ? "nowbar-shell-expanded" : ""}`}
        role="group"
        aria-label="HallsChat quick navigation"
      >
        <div className="nowbar-rail" aria-hidden="true" />
        {view === "title" ? (
          <button
            type="button"
            className="nowbar-title"
            aria-label={`${pageTitle} page. Tap to show navigation buttons.`}
            onClick={toggleView}
            onMouseDown={startHold}
            onMouseUp={stopHold}
            onMouseLeave={stopHold}
            onTouchStart={startHold}
            onTouchEnd={stopHold}
            onTouchCancel={stopHold}
          >
            <span className="nowbar-orb" aria-hidden="true" />
            <span>{pageTitle}</span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        ) : (
          <div className={`nowbar-actions ${mode === "expanded" ? "nowbar-actions-expanded" : ""}`}>
            {actions.map(({ label, icon: Icon }) => (
              <div className="nowbar-slot" key={label}>
                <button
                  type="button"
                  className={`nowbar-action ${activeAction === label ? "nowbar-action-active" : ""}`}
                  aria-label={label}
                  onClick={() => {
                    setActiveAction(label);
                    setPageTitle(label);
                    setView("title");
                    setMode("compact");
                  }}
                >
                  <span className="nowbar-icon"><Icon size={18} /></span>
                  {mode !== "expanded" && <span className="nowbar-label-compact">{label}</span>}
                  {mode === "expanded" && <span className="nowbar-label-expanded">{label}</span>}
                </button>
              </div>
            ))}
          </div>
        )}
        {view === "actions" && (
          <button
            type="button"
            className="nowbar-back-title"
            aria-label="Show current page title"
            onClick={() => { setView("title"); setMode("compact"); }}
          >
            <ChevronDown size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
