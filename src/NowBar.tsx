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
  const path = window.location.pathname.replace(/\\/$/, "") || "/";
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
    holdTimer.current = setTimeout(() => {
      holdTriggered.current = true;
      setView("actions");
      setMode(current => current === "compact" ? "expanded" : "compact");
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
  };

  return (
    <div className={`nowbar-dock ${mode === "expanded" && view === "actions" ? "nowbar-dock-expanded" : ""}`}>
      <div
        ref={barRef}
        className={`nowbar-shell ${mode === "expanded" && view === "actions" ? "nowbar-shell-expanded" : ""}`}
        role="button"
        tabIndex={0}
        aria-label={view === "title" ? `${pageTitle} page. Tap to show navigation buttons.` : "Navigation buttons. Tap to show current page."}
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
            <span>{pageTitle}</span>
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
      </div>
    </div>
  );
}
