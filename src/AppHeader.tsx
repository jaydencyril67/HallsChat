import { useEffect, useState } from "react";
import { navigate } from "./utils/navigate";

export default function AppHeader({ homeHref = "#top" }: { homeHref?: string }) {
  const [isOnline, setIsOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    updateOnlineStatus();
    return () => {
      window.removeEventListener("online", updateOnlineStatus);
      window.removeEventListener("offline", updateOnlineStatus);
    };
  }, []);

  const openAlerts = () => {
    if (localStorage.getItem("hallschat_token")) {
      navigate("/notifications");
    } else if (homeHref !== "#top") {
      navigate(homeHref);
    }
  };

  return <header
    className="topbar hallschat-clickable-header"
    role="button"
    tabIndex={0}
    aria-label={localStorage.getItem("hallschat_token") ? "Open alerts" : "HallsChat home"}
    onClick={openAlerts}
    onKeyDown={event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openAlerts();
      }
    }}
  >
    <span className="header-artwork" aria-hidden="true">
      <span className="header-logo"><img src="/crown-chat.svg?v=7" alt="" /></span>
    </span>
    <div className="header-brand">
      <strong>{isOnline ? "HALLSCHAT" : "NO INTERNET"}</strong>
      {!isOnline && <small>Check your connection</small>}
    </div>
    <span className="header-artwork header-artwork-right" aria-hidden="true">
      <span className="header-logo"><img src="/crown-chat.svg?v=7" alt="" /></span>
    </span>
  </header>;
}
