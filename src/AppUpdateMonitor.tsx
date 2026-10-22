import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Download } from "lucide-react";
import { NativeAppUpdate } from "./utils/nativeAppUpdate";
import { openCrownStoreApp } from "./utils/crownStore";

type UpdateCheckResponse = {
  updateAvailable: boolean;
  installedVersion?: string;
  latestVersion?: string;
  tag?: string;
  releaseNotes?: string;
  releaseUrl?: string;
};

const API_BASE_URL = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");

export default function AppUpdateMonitor() {
  const [update, setUpdate] = useState<UpdateCheckResponse | null>(null);
  const [hidden, setHidden] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  const checkForUpdate = useCallback(async () => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;
    try {
      const appInfo = await NativeAppUpdate.getAppInfo();
      if (!appInfo?.versionName) return;
      const token = localStorage.getItem("hallschat_token");
      const response = await fetch(
        `${API_BASE_URL}/api/notifications/app-update-check?installedVersion=${encodeURIComponent(appInfo.versionName)}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" }
      );
      if (!response.ok) return;
      const data = await response.json() as UpdateCheckResponse;
      if (data.updateAvailable && data.latestVersion) {
        setUpdate({ ...data, installedVersion: appInfo.versionName });
        setHidden(false);
      } else {
        setUpdate(null);
      }
    } catch {
      // Update checks are best-effort; they must never interrupt normal app use.
    }
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;
    void checkForUpdate();
    const interval = window.setInterval(() => { void checkForUpdate(); }, 15 * 60 * 1000);
    const onVisible = () => { if (document.visibilityState === "visible") void checkForUpdate(); };
    const onAuthChanged = () => { void checkForUpdate(); };
    const onUpdateCheckNow = () => { void checkForUpdate(); };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("hallschat:auth-changed", onAuthChanged);
    window.addEventListener("hallschat:app-update-check-now", onUpdateCheckNow);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("hallschat:auth-changed", onAuthChanged);
      window.removeEventListener("hallschat:app-update-check-now", onUpdateCheckNow);
    };
  }, [checkForUpdate]);

  const startUpdate = () => {
    if (!update?.latestVersion) return;
    openCrownStoreApp("halls-chat", setActionMessage);
  };

  if (!update || hidden || !Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return null;

  return (
    <aside className="hallschat-update-notice" role="status" aria-live="polite">
      <div className="hallschat-update-copy">
        <strong>HallsChat update available</strong>
        <p>Latest APK available: v{update.latestVersion}. Currently installed: v{update.installedVersion || "unknown"}. Update without uninstalling your current app.</p>
        {update.releaseNotes && <details className="hallschat-update-notes"><summary>Release notes</summary><p>{update.releaseNotes}</p></details>}
        {actionMessage && <p className="hallschat-update-message">{actionMessage}</p>}
      </div>
      <div className="hallschat-update-actions">
        <button type="button" className="hallschat-update-primary" onClick={startUpdate}>
          <Download size={15} aria-hidden="true" /> Open CrownStore to update
        </button>
        <button type="button" className="hallschat-update-later" onClick={() => setHidden(true)}>Later</button>
      </div>
    </aside>
  );
}
