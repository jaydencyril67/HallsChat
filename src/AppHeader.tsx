import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";

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

  return <header className="topbar" aria-label="HallsChat app header">
    <a className="header-artwork" href={homeHref} aria-label="HallsChat home">
      <span className="header-logo"><MessageCircle size={19} strokeWidth={2.4}/><i /></span>
    </a>
    <div className="header-brand">
      <strong>{isOnline ? "HALLSCHAT" : "NO INTERNET"}</strong>
      {!isOnline && <small>Check your connection</small>}
    </div>
    <a className="header-artwork header-artwork-right" href={homeHref} aria-label="Back to top">
      <span className="header-logo"><MessageCircle size={19} strokeWidth={2.4}/><i /></span>
    </a>
  </header>;
}
