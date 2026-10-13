import { useCallback, useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Download, X } from "lucide-react";
import { NativeAppUpdate } from "./utils/nativeAppUpdate";

type UpdateCheckResponse = {
  updateAvailable: boolean;
  installedVersion?: string;
  latestVersion?: string;
  tag?: string;
  downloadUrl?: string;
  releaseNotes?: string;
  releaseUrl?: string;
};

const API_BASE_URL = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");

export default function AppUpdateMonitor() {
  const [update, setUpdate] = useState<UpdateCheckResponse | null>(null);
  const [hidden, setHidden] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [installing, setInstalling] = useState(false);

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
      if (data.updateAvailable && data.downloadUrl && data.latestVersion) {
        setUpdate(data);
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

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android" || !NativeAppUpdate.addListener) return;
    let listenerHandle: { remove: () => Promise<void> } | undefined;
    void NativeAppUpdate.addListener("downloadError", event => {
      setInstalling(false);
      setActionMessage(event.message || "The APK download or installer could not complete.");
    }).then(handle => { listenerHandle = handle; }).catch(() => {
      // The update card remains usable if optional native diagnostics cannot attach.
    });
    return () => { if (listenerHandle) void listenerHandle.remove(); };
  }, []);

  const startUpdate = async () => {
    if (!update?.downloadUrl || installing) return;
    setInstalling(true);
    setActionMessage("Preparing the update…");
    try {
      const result = await NativeAppUpdate.downloadAndInstall({ url: update.downloadUrl });
      if (result.requiresPermission) {
        setInstalling(false);
        setActionMessage("Allow HallsChat to install unknown apps in Android settings, return here, then tap Update now again.");
      } else {
        setActionMessage("The APK is downloading. Android will ask you to approve the update when it finishes.");
      }
    } catch {
      setInstalling(false);
      setActionMessage("The in-app installer could not start. Use Settings → Download App → Android APK instead.");
      window.setTimeout(() => {
        if (update.downloadUrl) window.open(update.downloadUrl, "_blank", "noopener,noreferrer");
      }, 500);
    }
  };

  if (!update || hidden || !Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return null;

  return (
    <aside className="hallschat-update-notice" role="status" aria-live="polite">
      <div className="hallschat-update-copy">
        <strong>HallsChat update available</strong>
        <p>Version {update.latestVersion} is ready. Update without uninstalling your current app.</p>
        {update.releaseNotes && <details className="hallschat-update-notes"><summary>Release notes</summary><p>{update.releaseNotes}</p></details>}
        {actionMessage && <p className="hallschat-update-message">{actionMessage}</p>}
      </div>
      <div className="hallschat-update-actions">
        {installing ? (
          <div className="hallschat-update-progress" role="status" aria-live="polite">
            <span className="hallschat-update-spinner" aria-hidden="true" />
            APK downloading…
          </div>
        ) : (
          <button type="button" className="hallschat-update-primary" onClick={() => void startUpdate()}>
            <Download size={15} aria-hidden="true" /> Update now
          </button>
        )}
        <button type="button" className="hallschat-update-later" onClick={() => setHidden(true)}>Later</button>
        <button type="button" className="hallschat-update-dismiss" aria-label="Dismiss update notice" onClick={() => setHidden(true)}><X size={16} /></button>
      </div>
    </aside>
  );
}
