import { Check, Download, Globe, MoreHorizontal, Smartphone, Store } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { NativeAppUpdate } from "./utils/nativeAppUpdate";
import AlertColorModal from "./AlertColorModal";
import { navigate } from "./utils/navigate";
import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type CSSProperties } from "react";
import { useAppTheme } from "./components/AppTheme";
import AppHeader from "./AppHeader";
import NowBar from "./NowBar";

type BeforeInstallPromptEvent = Event & { readonly platforms: string[]; readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>; prompt: () => Promise<void> };
const HALLSCHAT_APK_URL = "https://hallschat.kingshall.online/downloads/HallsChat.apk";
type AlertTypeKey = "chats" | "posts" | "stories" | "comments" | "follows" | "likes" | "calls" | "mentions" | "communities" | "systemUpdates" | "accountSecurity";
const DEFAULT_ALERT_TYPES: Record<AlertTypeKey, boolean> = {
  chats: true, posts: true, stories: true, comments: true, follows: true, likes: true, calls: true, mentions: true, communities: true, systemUpdates: true, accountSecurity: true
};
const ALERT_TYPE_GROUPS: { label: string; options: { value: AlertTypeKey; label: string }[] }[] = [
  { label: "Social", options: [{ value: "chats", label: "Chats" }, { value: "posts", label: "Posts" }, { value: "stories", label: "Stories" }, { value: "communities", label: "Communities" }] },
  { label: "Interactions", options: [{ value: "comments", label: "Comments & replies" }, { value: "likes", label: "Likes" }, { value: "follows", label: "Follows" }, { value: "mentions", label: "Mentions" }, { value: "calls", label: "Calls & missed calls" }] },
  { label: "System", options: [{ value: "systemUpdates", label: "App updates & notices" }, { value: "accountSecurity", label: "Account & security" }] }
];

export default function ThemeSettingsPage() {
  const { themePreference, setThemePreference } = useAppTheme();
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [maxDeviceMode, setMaxDeviceMode] = useState<"flex" | "fixed">("flex");
  const [maxDevices, setMaxDevices] = useState(2);
  const [activeDeviceSessions, setActiveDeviceSessions] = useState(0);
  const [maxDeviceLoaded, setMaxDeviceLoaded] = useState(false);
  const [maxDeviceSaving, setMaxDeviceSaving] = useState(false);
  const [maxDeviceMenuOpen, setMaxDeviceMenuOpen] = useState(false);
  const [maxDeviceMessage, setMaxDeviceMessage] = useState("");
  const maxDeviceMenuRef = useRef<HTMLDivElement>(null);
  const [alertColorEnabled, setAlertColorEnabled] = useState(() => localStorage.getItem("hallschat_alert_color_enabled") !== "false");
  const [alertColor, setAlertColor] = useState(() => {
    const saved = localStorage.getItem("hallschat_alert_color");
    return saved && /^#[0-9a-f]{6}$/i.test(saved) ? saved.toLowerCase() : "#e11d48";
  });
  const [alertColorMenuOpen, setAlertColorMenuOpen] = useState(false);
  const [alertColorModalOpen, setAlertColorModalOpen] = useState(false);
  const alertColorMenuRef = useRef<HTMLDivElement>(null);
  const closeAlertColorModal = useCallback(() => setAlertColorModalOpen(false), []);
  const [nowbarColorEnabled, setNowbarColorEnabled] = useState(() => localStorage.getItem("hallschat_nowbar_color_enabled") === "true");
  const [nowbarColor, setNowbarColor] = useState(() => {
    const saved = localStorage.getItem("hallschat_nowbar_color");
    return saved && /^#[0-9a-f]{6}$/i.test(saved) ? saved.toLowerCase() : "#38bdf8";
  });
  const [nowbarLightStyle, setNowbarLightStyle] = useState(() => {
    const saved = localStorage.getItem("hallschat_nowbar_light_style");
    return ["stable-light", "stable", "blink-light", "blink", "pulse-light", "pulse", "color-light", "color"].includes(saved || "") ? saved! : "stable";
  });
  const [nowbarColorMenuOpen, setNowbarColorMenuOpen] = useState(false);
  const [nowbarColorModalOpen, setNowbarColorModalOpen] = useState(false);
  const [nowbarButtonColorEnabled, setNowbarButtonColorEnabled] = useState(() => localStorage.getItem("hallschat_nowbar_button_color_enabled") === "true");
  const [nowbarButtonColor, setNowbarButtonColor] = useState(() => {
    const saved = localStorage.getItem("hallschat_nowbar_button_color");
    return saved && /^#[0-9a-f]{6}$/i.test(saved) ? saved.toLowerCase() : "#38bdf8";
  });
  const [nowbarButtonColorMenuOpen, setNowbarButtonColorMenuOpen] = useState(false);
  const [nowbarButtonColorModalOpen, setNowbarButtonColorModalOpen] = useState(false);
  const nowbarButtonColorMenuRef = useRef<HTMLDivElement>(null);
  const closeNowbarButtonColorModal = useCallback(() => setNowbarButtonColorModalOpen(false), []);
  const nowbarColorMenuRef = useRef<HTMLDivElement>(null);
  const closeNowbarColorModal = useCallback(() => setNowbarColorModalOpen(false), []);
  const NOWBAR_LIGHT_STYLES = [
    { value: "stable-light", label: "Steady Light", description: "A clean edge with no glow" },
    { value: "stable", label: "Steady Glow", description: "A constant colored glow" },
    { value: "blink-light", label: "Blink Light", description: "A gentle light blink" },
    { value: "blink", label: "Blink Glow", description: "A blinking colored glow" },
    { value: "pulse-light", label: "Pulse Light", description: "A soft breathing edge" },
    { value: "pulse", label: "Pulse Glow", description: "A stronger breathing glow" },
    { value: "color-light", label: "Rainbow Light", description: "Cycles through edge colors" },
    { value: "color", label: "Rainbow Glow", description: "Cycles through glowing colors" }
  ] as const;
  const [downloadAppMenuOpen, setDownloadAppMenuOpen] = useState(false);
  const downloadAppMenuRef = useRef<HTMLDivElement>(null);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [pwaInstalled, setPwaInstalled] = useState(() => window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true);
  const [downloadAppMessage, setDownloadAppMessage] = useState("");
  const [apkUpdate, setApkUpdate] = useState<{ status: "checking" | "current" | "update" | "unknown"; installedVersion?: string; latestVersion?: string; downloadUrl?: string }>({ status: Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android" ? "checking" : "unknown" });
  const [idleLogoutMinutes, setIdleLogoutMinutes] = useState<0 | 5 | 10 | 30>(() => {
    const saved = Number(localStorage.getItem("hallschat_idle_logout_minutes") || 0);
    return saved === 5 || saved === 10 || saved === 30 ? saved : 0;
  });
  const [idleLogoutMenuOpen, setIdleLogoutMenuOpen] = useState(false);
  const [nowbarSwipeEnabled, setNowbarSwipeEnabled] = useState(() => localStorage.getItem("hallschat_nowbar_swipe_enabled") !== "false");
  const [nowbarExpandEnabled, setNowbarExpandEnabled] = useState(() => localStorage.getItem("hallschat_nowbar_expand_enabled") !== "false");
  const [nowbarToggleMenuOpen, setNowbarToggleMenuOpen] = useState(false);
  const nowbarToggleMenuRef = useRef<HTMLDivElement>(null);
  const [alertChannels, setAlertChannels] = useState<{ email: boolean; inApp: boolean; push: boolean }>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("hallschat_alert_channels") || "{}");
      return { email: saved.email === true, inApp: saved.inApp !== false, push: saved.push === true };
    } catch {
      return { email: false, inApp: true, push: false };
    }
  });
  const [alertChannelMenuOpen, setAlertChannelMenuOpen] = useState(false);
  const [alertTypes, setAlertTypes] = useState<Record<AlertTypeKey, boolean>>(DEFAULT_ALERT_TYPES);
  const [alertTypesMenuOpen, setAlertTypesMenuOpen] = useState(false);
  const [alertTypesSaving, setAlertTypesSaving] = useState(false);
  const [alertTypesError, setAlertTypesError] = useState("");
  const alertTypesMenuRef = useRef<HTMLDivElement>(null);
  const [alertChannelsLoaded, setAlertChannelsLoaded] = useState(false);
  const [alertChannelsSaving, setAlertChannelsSaving] = useState(false);
  const [alertChannelsError, setAlertChannelsError] = useState("");
  const [pushVapidKey, setPushVapidKey] = useState<string | null>(null);
  const alertChannelMenuRef = useRef<HTMLDivElement>(null);
  const idleLogoutMenuRef = useRef<HTMLDivElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const [activeStatusVisible, setActiveStatusVisible] = useState(true);
  const [activeStatusLoaded, setActiveStatusLoaded] = useState(false);
  const [activeStatusMenuOpen, setActiveStatusMenuOpen] = useState(false);
  const [activeStatusSaving, setActiveStatusSaving] = useState(false);
  const [activeStatusError, setActiveStatusError] = useState("");
  const activeStatusMenuRef = useRef<HTMLDivElement>(null);
  const [callsPrivacy, setCallsPrivacy] = useState<"audio" | "video" | "both" | "none">("both");
  const [callsPrivacyLoaded, setCallsPrivacyLoaded] = useState(false);
  const [callsPrivacyMenuOpen, setCallsPrivacyMenuOpen] = useState(false);
  const [callsPrivacySaving, setCallsPrivacySaving] = useState(false);
  const [callsPrivacyError, setCallsPrivacyError] = useState("");
  const callsPrivacyMenuRef = useRef<HTMLDivElement>(null);
  const [profileDiscoverable, setProfileDiscoverable] = useState(true);
  const [visibilityLoaded, setVisibilityLoaded] = useState(false);
  const [visibilityMenuOpen, setVisibilityMenuOpen] = useState(false);
  const [visibilitySaving, setVisibilitySaving] = useState(false);
  const [visibilityError, setVisibilityError] = useState("");
  const visibilityMenuRef = useRef<HTMLDivElement>(null);
  const [readReceiptsVisible, setReadReceiptsVisible] = useState(true);
  const [readReceiptsLoaded, setReadReceiptsLoaded] = useState(false);
  const [readReceiptsMenuOpen, setReadReceiptsMenuOpen] = useState(false);
  const [readReceiptsSaving, setReadReceiptsSaving] = useState(false);
  const [readReceiptsError, setReadReceiptsError] = useState("");
  const readReceiptsMenuRef = useRef<HTMLDivElement>(null);
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [commentingLoaded, setCommentingLoaded] = useState(false);
  const [commentingMenuOpen, setCommentingMenuOpen] = useState(false);
  const [commentingSaving, setCommentingSaving] = useState(false);
  const [commentingError, setCommentingError] = useState("");
  const commentingMenuRef = useRef<HTMLDivElement>(null);
  const apiBase = (import.meta.env.VITE_API_URL || "https://hallschats.onrender.com").replace(/\/$/, "");
  const currentThemeLabel = themePreference === "system"
    ? "System"
    : themePreference === "light"
      ? "Light"
      : "Dark";

  useEffect(() => {
    if (!maxDeviceMenuOpen) return;
    const outside = (event: PointerEvent) => { if (maxDeviceMenuRef.current && !maxDeviceMenuRef.current.contains(event.target as Node)) setMaxDeviceMenuOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setMaxDeviceMenuOpen(false); };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [maxDeviceMenuOpen]);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem("hallschat_token");
    if (!token) { setMaxDeviceLoaded(true); setMaxDeviceMessage("Sign in to manage active sessions."); return; }
    fetch(apiBase + "/api/settings/max-device", { headers: { Authorization: "Bearer " + token }, cache: "no-store" })
      .then(async response => { const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.message || "Unable to load Max Device settings."); return payload as { mode?: string; maxDevices?: number; activeSessions?: number }; })
      .then(payload => { if (cancelled) return; setMaxDeviceMode(payload.mode === "fixed" ? "fixed" : "flex"); setMaxDevices(Math.min(5, Math.max(1, Number(payload.maxDevices) || 2))); setActiveDeviceSessions(Math.max(0, Number(payload.activeSessions) || 0)); setMaxDeviceLoaded(true); })
      .catch(error => { if (cancelled) return; setMaxDeviceLoaded(true); setMaxDeviceMessage(error instanceof Error ? error.message : "Unable to load Max Device settings."); });
    return () => { cancelled = true; };
  }, [apiBase]);

  const chooseMaxDevice = async (next: { mode?: "flex" | "fixed"; maxDevices?: number }) => {
    const mode = next.mode || maxDeviceMode;
    const limit = next.maxDevices ?? maxDevices;
    setMaxDeviceSaving(true); setMaxDeviceMessage("");
    try {
      const token = localStorage.getItem("hallschat_token");
      if (!token) throw new Error("Sign in again to change Max Device settings.");
      const response = await fetch(apiBase + "/api/settings/max-device", { method: "PATCH", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ mode, maxDevices: limit }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Unable to save Max Device settings.");
      setMaxDeviceMode(mode); setMaxDevices(limit); setActiveDeviceSessions(Math.max(0, Number(payload.activeSessions) || 0));
      setMaxDeviceMessage("Max Device settings saved."); setMaxDeviceMenuOpen(false);
    } catch (error) { setMaxDeviceMessage(error instanceof Error ? error.message : "Unable to save Max Device settings."); }
    finally { setMaxDeviceSaving(false); }
  };

  useEffect(() => {
    if (!alertColorMenuOpen) return;
    const outside = (event: PointerEvent) => { if (alertColorMenuRef.current && !alertColorMenuRef.current.contains(event.target as Node)) setAlertColorMenuOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setAlertColorMenuOpen(false); };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [alertColorMenuOpen]);

  useEffect(() => {
    if (!nowbarColorMenuOpen) return;
    const outside = (event: PointerEvent) => { if (nowbarColorMenuRef.current && !nowbarColorMenuRef.current.contains(event.target as Node)) setNowbarColorMenuOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setNowbarColorMenuOpen(false); };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [nowbarColorMenuOpen]);

  useEffect(() => {
    if (!nowbarButtonColorMenuOpen) return;
    const outside = (event: PointerEvent) => { if (nowbarButtonColorMenuRef.current && !nowbarButtonColorMenuRef.current.contains(event.target as Node)) setNowbarButtonColorMenuOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setNowbarButtonColorMenuOpen(false); };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [nowbarButtonColorMenuOpen]);

  const saveAlertColorEnabled = (enabled: boolean) => {
    setAlertColorEnabled(enabled);
    localStorage.setItem("hallschat_alert_color_enabled", String(enabled));
    window.dispatchEvent(new Event("hallschat:alert-color-changed"));
    setAlertColorMenuOpen(false);
  };

  const saveAlertColor = (color: string) => {
    setAlertColor(color);
    localStorage.setItem("hallschat_alert_color", color);
    window.dispatchEvent(new Event("hallschat:alert-color-changed"));
  };

  const saveNowbarColorEnabled = (enabled: boolean) => {
    setNowbarColorEnabled(enabled);
    localStorage.setItem("hallschat_nowbar_color_enabled", String(enabled));
    window.dispatchEvent(new Event("hallschat:nowbar-color-changed"));
    setNowbarColorMenuOpen(false);
  };

  const saveNowbarColor = (color: string) => {
    setNowbarColor(color);
    localStorage.setItem("hallschat_nowbar_color", color);
    window.dispatchEvent(new Event("hallschat:nowbar-color-changed"));
  };

  const saveNowbarLightStyle = (style: string) => {
    setNowbarLightStyle(style);
    localStorage.setItem("hallschat_nowbar_light_style", style);
    window.dispatchEvent(new Event("hallschat:nowbar-color-changed"));
  };

  const saveNowbarButtonColorEnabled = (enabled: boolean) => {
    setNowbarButtonColorEnabled(enabled);
    localStorage.setItem("hallschat_nowbar_button_color_enabled", String(enabled));
    window.dispatchEvent(new Event("hallschat:nowbar-button-color-changed"));
    setNowbarButtonColorMenuOpen(false);
  };

  const saveNowbarButtonColor = (color: string) => {
    setNowbarButtonColor(color);
    localStorage.setItem("hallschat_nowbar_button_color", color);
    window.dispatchEvent(new Event("hallschat:nowbar-button-color-changed"));
  };

  useEffect(() => {
    if (!downloadAppMenuOpen) return;
    const outside = (event: PointerEvent) => { if (downloadAppMenuRef.current && !downloadAppMenuRef.current.contains(event.target as Node)) setDownloadAppMenuOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setDownloadAppMenuOpen(false); };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [downloadAppMenuOpen]);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => { event.preventDefault(); setDeferredInstallPrompt(event as BeforeInstallPromptEvent); };
    const handleAppInstalled = () => { setPwaInstalled(true); setDeferredInstallPrompt(null); setDownloadAppMessage("HallsChat has been installed on this device."); };
    const displayMode = window.matchMedia("(display-mode: standalone)");
    const syncInstalled = () => setPwaInstalled(displayMode.matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    displayMode.addEventListener("change", syncInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt); window.removeEventListener("appinstalled", handleAppInstalled); displayMode.removeEventListener("change", syncInstalled); };
  }, []);

  const checkApkVersion = useCallback(async () => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") { setApkUpdate({ status: "unknown" }); return; }
    try {
      const appInfo = await NativeAppUpdate.getAppInfo();
      if (!appInfo?.versionName) throw new Error("Installed version unavailable");
      const response = await fetch(apiBase + "/api/notifications/app-update-check?installedVersion=" + encodeURIComponent(appInfo.versionName), { cache: "no-store" });
      if (!response.ok) throw new Error("Version check failed");
      const data = await response.json() as { updateAvailable?: boolean; installedVersion?: string; latestVersion?: string; downloadUrl?: string };
      setApkUpdate({ status: data.updateAvailable && data.downloadUrl ? "update" : "current", installedVersion: data.installedVersion || appInfo.versionName, latestVersion: data.latestVersion, downloadUrl: data.downloadUrl || HALLSCHAT_APK_URL });
    } catch { setApkUpdate({ status: "unknown" }); }
  }, [apiBase]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;
    void checkApkVersion();
    const onVisible = () => { if (document.visibilityState === "visible") void checkApkVersion(); };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.removeEventListener("focus", onVisible); document.removeEventListener("visibilitychange", onVisible); };
  }, [checkApkVersion]);

  useEffect(() => {
    if (!downloadAppMessage) return;
    const timer = window.setTimeout(() => setDownloadAppMessage(""), 4500);
    return () => window.clearTimeout(timer);
  }, [downloadAppMessage]);

  useEffect(() => {
    const timers = [
      maxDeviceMessage && window.setTimeout(() => setMaxDeviceMessage(""), 4500),
      alertTypesError && window.setTimeout(() => setAlertTypesError(""), 4500),
      alertChannelsError && window.setTimeout(() => setAlertChannelsError(""), 4500),
      commentingError && window.setTimeout(() => setCommentingError(""), 4500),
      readReceiptsError && window.setTimeout(() => setReadReceiptsError(""), 4500),
      visibilityError && window.setTimeout(() => setVisibilityError(""), 4500),
      callsPrivacyError && window.setTimeout(() => setCallsPrivacyError(""), 4500),
      activeStatusError && window.setTimeout(() => setActiveStatusError(""), 4500),
    ].filter((timer): timer is number => typeof timer === "number");
    return () => timers.forEach(timer => window.clearTimeout(timer));
  }, [maxDeviceMessage, alertTypesError, alertChannelsError, commentingError, readReceiptsError, visibilityError, callsPrivacyError, activeStatusError]);

  const handleApkDownload = async (event: ReactMouseEvent<HTMLAnchorElement>) => {
    setDownloadAppMenuOpen(false);
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") { setDownloadAppMessage("Opening the latest signed HallsChat APK download."); return; }
    event.preventDefault();
    if (apkUpdate.status === "checking") { setDownloadAppMessage("Checking your installed HallsChat version…"); await checkApkVersion(); return; }
    if (apkUpdate.status === "current") { setDownloadAppMessage("You are already using the latest HallsChat APK" + (apkUpdate.latestVersion ? " (v" + apkUpdate.latestVersion + ")" : "") + "."); return; }
    const downloadUrl = apkUpdate.downloadUrl || HALLSCHAT_APK_URL;
    if (apkUpdate.status === "unknown") {
      setDownloadAppMessage("Version check unavailable. Opening the latest APK release.");
      await checkApkVersion();
      window.setTimeout(() => window.open(HALLSCHAT_APK_URL, "_blank", "noopener,noreferrer"), 300);
      return;
    }
    setDownloadAppMessage("Preparing HallsChat update v" + (apkUpdate.latestVersion || "latest") + "…");
    try {
      const result = await NativeAppUpdate.downloadAndInstall({ url: downloadUrl });
      if (result.requiresPermission) setDownloadAppMessage("Allow HallsChat to install unknown apps in Android settings, return here, then tap Update again.");
      else setDownloadAppMessage("The APK update is downloading. Android will ask you to approve it when it finishes.");
    } catch {
      setDownloadAppMessage("The in-app installer could not start. Opening the APK download in your browser.");
      window.setTimeout(() => window.open(downloadUrl, "_blank", "noopener,noreferrer"), 300);
    }
  };

  const handlePwaInstall = async () => {
    if (pwaInstalled) { setDownloadAppMessage("HallsChat is already installed on this device."); setDownloadAppMenuOpen(false); return; }
    if (!deferredInstallPrompt) { setDownloadAppMessage("Automatic installation is unavailable in this browser right now. Open the browser menu and choose “Install app” or “Add to Home screen”."); setDownloadAppMenuOpen(false); return; }
    try {
      await deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      setDownloadAppMessage(choice.outcome === "accepted" ? "HallsChat installation started." : "Installation was cancelled.");
      if (choice.outcome === "accepted") setPwaInstalled(true);
      setDeferredInstallPrompt(null);
    } catch {
      setDownloadAppMessage("Could not open the install prompt. Open the browser menu and choose “Install app” or “Add to Home screen”.");
    }
    setDownloadAppMenuOpen(false);
  };

  useEffect(() => {
    if (!idleLogoutMenuOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (idleLogoutMenuRef.current && !idleLogoutMenuRef.current.contains(event.target as Node)) setIdleLogoutMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setIdleLogoutMenuOpen(false); };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [idleLogoutMenuOpen]);

  const chooseIdleLogout = (minutes: 0 | 5 | 10 | 30) => {
    setIdleLogoutMinutes(minutes);
    localStorage.setItem("hallschat_idle_logout_minutes", String(minutes));
    if (minutes === 0) localStorage.removeItem("hallschat_last_activity_at");
    else localStorage.setItem("hallschat_last_activity_at", String(Date.now()));
    setIdleLogoutMenuOpen(false);
  };

  useEffect(() => {
    if (!nowbarToggleMenuOpen) return;
    const outside = (event: PointerEvent) => { if (nowbarToggleMenuRef.current && !nowbarToggleMenuRef.current.contains(event.target as Node)) setNowbarToggleMenuOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setNowbarToggleMenuOpen(false); };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [nowbarToggleMenuOpen]);

  useEffect(() => {
    if (!alertChannelMenuOpen) return;
    const outside = (event: PointerEvent) => { if (alertChannelMenuRef.current && !alertChannelMenuRef.current.contains(event.target as Node)) setAlertChannelMenuOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setAlertChannelMenuOpen(false); };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [alertChannelMenuOpen]);

  useEffect(() => {
    if (!alertTypesMenuOpen) return;
    const outside = (event: PointerEvent) => { if (alertTypesMenuRef.current && !alertTypesMenuRef.current.contains(event.target as Node)) setAlertTypesMenuOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setAlertTypesMenuOpen(false); };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [alertTypesMenuOpen]);

  const chooseAlertType = async (type: AlertTypeKey) => {
    const token = localStorage.getItem("hallschat_token");
    if (!token || alertTypesSaving || !alertChannelsLoaded) return;
    const next = { ...alertTypes, [type]: !alertTypes[type] };
    setAlertTypesSaving(true);
    setAlertTypesError("");
    try {
      const response = await fetch(apiBase + "/api/settings/alert-types", { method: "PATCH", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ alertTypes: next }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Unable to update alert types.");
      const saved = { ...DEFAULT_ALERT_TYPES, ...(payload.alertTypes || next) };
      setAlertTypes(saved);
      window.dispatchEvent(new CustomEvent("hallschat:alert-types-changed", { detail: saved }));
    } catch (error) {
      setAlertTypesError(error instanceof Error ? error.message : "Unable to update alert types.");
    } finally {
      setAlertTypesSaving(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("hallschat_token");
    if (!token) { navigate("/signin", { replace: true }); return; }
    let cancelled = false;
    fetch(apiBase + "/api/settings/alert-channels", { headers: { Authorization: "Bearer " + token } })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || "Unable to load alert channel settings.");
        if (!cancelled) {
          const channels = payload.alertChannels || {};
          setAlertChannels({ email: channels.email === true, inApp: channels.inApp !== false, push: channels.push === true });
          const types = payload.alertTypes || {};
          setAlertTypes({
            chats: types.chats !== false, posts: types.posts !== false, stories: types.stories !== false,
            comments: types.comments !== false, follows: types.follows !== false, likes: types.likes !== false,
            calls: types.calls !== false, mentions: types.mentions !== false, communities: types.communities !== false,
            systemUpdates: types.systemUpdates !== false, accountSecurity: types.accountSecurity !== false
          });
          setPushVapidKey(typeof payload.vapidPublicKey === "string" ? payload.vapidPublicKey : null);
          localStorage.setItem("hallschat_alert_channels", JSON.stringify({ email: channels.email === true, inApp: channels.inApp !== false, push: channels.push === true }));
        }
      })
      .catch(error => { if (!cancelled) setAlertChannelsError(error instanceof Error ? error.message : "Unable to load alert channel settings."); })
      .finally(() => { if (!cancelled) setAlertChannelsLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  const decodeVapidKey = (value: string): ArrayBuffer => {
    const padded = value + "=".repeat((4 - value.length % 4) % 4);
    const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
    const raw = window.atob(base64);
    return Uint8Array.from(raw, char => char.charCodeAt(0)).buffer as ArrayBuffer;
  };

  const chooseAlertChannel = async (channel: "email" | "inApp" | "push") => {
    const token = localStorage.getItem("hallschat_token");
    if (!token || alertChannelsSaving || !alertChannelsLoaded) return;
    setAlertChannelsSaving(true);
    setAlertChannelsError("");
    let nativeToken = localStorage.getItem("hallschat_native_push_token");
    try {
      if (channel === "push" && !alertChannels.push) {
        if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
          const permission = await PushNotifications.requestPermissions();
          if (permission.receive !== "granted") throw new Error("Allow notifications for HallsChat in Android settings to enable push alerts.");
          const fcmToken = await new Promise<string>(async (resolve, reject) => {
            let settled = false;
            let registrationListener: { remove: () => Promise<void> } | undefined;
            let errorListener: { remove: () => Promise<void> } | undefined;
            registrationListener = await PushNotifications.addListener("registration", result => {
              if (settled) return;
              settled = true;
              void registrationListener?.remove();
              void errorListener?.remove();
              resolve(result.value);
            });
            errorListener = await PushNotifications.addListener("registrationError", error => {
              if (settled) return;
              settled = true;
              void registrationListener?.remove();
              void errorListener?.remove();
              reject(new Error(error.error || "Android could not register this device for push notifications."));
            });
            await PushNotifications.register();
          });
          const saveToken = await fetch(apiBase + "/api/alerts/native-push-token", {
            method: "POST",
            headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
            body: JSON.stringify({ token: fcmToken })
          });
          const tokenPayload = await saveToken.json().catch(() => ({}));
          if (!saveToken.ok) throw new Error(tokenPayload.message || "Unable to register this Android device for push alerts.");
          nativeToken = fcmToken;
          localStorage.setItem("hallschat_native_push_token", fcmToken);
          await PushNotifications.addListener("pushNotificationActionPerformed", action => {
            const target = action.notification.data?.url;
            if (typeof target === "string" && target.startsWith("/")) navigate(target);
          });
        } else {
          if (!( "serviceWorker" in navigator) || !( "PushManager" in window) || !( "Notification" in window)) throw new Error("Push alerts are not supported by this browser.");
          if (!pushVapidKey) throw new Error("Push alerts need the VAPID public/private keys configured on the HallsChat backend first.");
          const permission = await Notification.requestPermission();
          if (permission !== "granted") throw new Error("Allow notifications in your browser settings to enable push alerts.");
          const registration = await navigator.serviceWorker.register("/sw.js");
          await navigator.serviceWorker.ready;
          let pushSubscription = await registration.pushManager.getSubscription();
          if (!pushSubscription) pushSubscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeVapidKey(pushVapidKey) });
          const saveSubscription = await fetch(apiBase + "/api/alerts/push-subscription", { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ subscription: pushSubscription.toJSON() }) });
          const savePayload = await saveSubscription.json().catch(() => ({}));
          if (!saveSubscription.ok) throw new Error(savePayload.message || "Unable to register this device for push alerts.");
        }
      }
      const next = { ...alertChannels, [channel]: !alertChannels[channel] };
      const response = await fetch(apiBase + "/api/settings/alert-channels", { method: "PATCH", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ alertChannels: next }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Unable to update alert channel settings.");
      setAlertChannels(payload.alertChannels || next);
      localStorage.setItem("hallschat_alert_channels", JSON.stringify(payload.alertChannels || next));
      if (channel === "push" && next.push === false) {
        if (Capacitor.isNativePlatform() && nativeToken) {
          await fetch(apiBase + "/api/alerts/native-push-token", { method: "DELETE", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ token: nativeToken }) }).catch(() => undefined);
          localStorage.removeItem("hallschat_native_push_token");
        } else if ("serviceWorker" in navigator) {
          const registration = await navigator.serviceWorker.getRegistration("/");
          const subscription = await registration?.pushManager.getSubscription();
          if (subscription) {
            await fetch(apiBase + "/api/alerts/push-subscription", { method: "DELETE", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) }).catch(() => undefined);
            await subscription.unsubscribe().catch(() => false);
          }
        }
      }
      window.dispatchEvent(new CustomEvent("hallschat:alert-channels-changed", { detail: payload.alertChannels || next }));
      setAlertChannelMenuOpen(false);
    } catch (error) {
      setAlertChannelsError(error instanceof Error ? error.message : "Unable to update alert channel settings.");
    } finally {
      setAlertChannelsSaving(false);
    }
  };

  const chooseNowbarToggle = (feature: "swipe" | "expand", enabled: boolean) => {
    if (feature === "swipe") { setNowbarSwipeEnabled(enabled); localStorage.setItem("hallschat_nowbar_swipe_enabled", String(enabled)); }
    else { setNowbarExpandEnabled(enabled); localStorage.setItem("hallschat_nowbar_expand_enabled", String(enabled)); }
    window.dispatchEvent(new CustomEvent("hallschat:nowbar-settings-changed")); setNowbarToggleMenuOpen(false);
  };

  useEffect(() => {
    if (!themeMenuOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setThemeMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setThemeMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [themeMenuOpen]);


  useEffect(() => {
    const savedToken = localStorage.getItem("hallschat_token");
    if (!savedToken) { navigate("/signin", { replace: true }); return; }
    let cancelled = false;
    fetch(apiBase + "/api/settings/active-status", { headers: { Authorization: "Bearer " + savedToken } })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || "Unable to load active status settings.");
        if (!cancelled) setActiveStatusVisible(payload.activeStatusVisible !== false);
      })
      .catch(error => { if (!cancelled) setActiveStatusError(error instanceof Error ? error.message : "Unable to load active status settings."); })
      .finally(() => { if (!cancelled) setActiveStatusLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const savedToken = localStorage.getItem("hallschat_token");
    if (!savedToken) { navigate("/signin", { replace: true }); return; }
    let cancelled = false;
    fetch(apiBase + "/api/settings/calls-privacy", { headers: { Authorization: "Bearer " + savedToken } })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || "Unable to load calls privacy settings.");
        const value = payload.callsPrivacy;
        if (!cancelled) setCallsPrivacy(value === "audio" || value === "video" || value === "none" ? value : "both");
      })
      .catch(error => { if (!cancelled) setCallsPrivacyError(error instanceof Error ? error.message : "Unable to load calls privacy settings."); })
      .finally(() => { if (!cancelled) setCallsPrivacyLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const savedToken = localStorage.getItem("hallschat_token");
    if (!savedToken) { navigate("/signin", { replace: true }); return; }
    let cancelled = false;
    fetch(apiBase + "/api/settings/visibility", { headers: { Authorization: "Bearer " + savedToken } })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || "Unable to load visibility settings.");
        if (!cancelled) setProfileDiscoverable(payload.profileDiscoverable !== false);
      })
      .catch(error => { if (!cancelled) setVisibilityError(error instanceof Error ? error.message : "Unable to load visibility settings."); })
      .finally(() => { if (!cancelled) setVisibilityLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!visibilityMenuOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (visibilityMenuRef.current && !visibilityMenuRef.current.contains(event.target as Node)) setVisibilityMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setVisibilityMenuOpen(false); };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [visibilityMenuOpen]);

  useEffect(() => {
    const savedToken = localStorage.getItem("hallschat_token");
    if (!savedToken) { navigate("/signin", { replace: true }); return; }
    let cancelled = false;
    fetch(apiBase + "/api/settings/read-receipts", { headers: { Authorization: "Bearer " + savedToken } })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || "Unable to load read receipt settings.");
        if (!cancelled) setReadReceiptsVisible(payload.readReceiptsVisible !== false);
      })
      .catch(error => { if (!cancelled) setReadReceiptsError(error instanceof Error ? error.message : "Unable to load read receipt settings."); })
      .finally(() => { if (!cancelled) setReadReceiptsLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const savedToken = localStorage.getItem("hallschat_token");
    if (!savedToken) { navigate("/signin", { replace: true }); return; }
    let cancelled = false;
    fetch(apiBase + "/api/settings/commenting", { headers: { Authorization: "Bearer " + savedToken } })
      .then(async response => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.message || "Unable to load commenting settings.");
        if (!cancelled) setCommentsEnabled(payload.commentsEnabled !== false);
      })
      .catch(error => { if (!cancelled) setCommentingError(error instanceof Error ? error.message : "Unable to load commenting settings."); })
      .finally(() => { if (!cancelled) setCommentingLoaded(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!commentingMenuOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (commentingMenuRef.current && !commentingMenuRef.current.contains(event.target as Node)) setCommentingMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setCommentingMenuOpen(false); };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [commentingMenuOpen]);

  useEffect(() => {
    if (!readReceiptsMenuOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (readReceiptsMenuRef.current && !readReceiptsMenuRef.current.contains(event.target as Node)) setReadReceiptsMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setReadReceiptsMenuOpen(false); };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [readReceiptsMenuOpen]);

  useEffect(() => {
    if (!callsPrivacyMenuOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (callsPrivacyMenuRef.current && !callsPrivacyMenuRef.current.contains(event.target as Node)) setCallsPrivacyMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setCallsPrivacyMenuOpen(false); };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [callsPrivacyMenuOpen]);

  useEffect(() => {
    if (!activeStatusMenuOpen) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (activeStatusMenuRef.current && !activeStatusMenuRef.current.contains(event.target as Node)) setActiveStatusMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setActiveStatusMenuOpen(false); };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [activeStatusMenuOpen]);

  const chooseActiveStatus = async (visible: boolean) => {
    const savedToken = localStorage.getItem("hallschat_token");
    if (!savedToken || activeStatusSaving || !activeStatusLoaded) return;
    setActiveStatusSaving(true);
    setActiveStatusError("");
    try {
      const response = await fetch(apiBase + "/api/settings/active-status", {
        method: "PATCH",
        headers: { Authorization: "Bearer " + savedToken, "Content-Type": "application/json" },
        body: JSON.stringify({ activeStatusVisible: visible })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Unable to update active status.");
      setActiveStatusVisible(payload.activeStatusVisible !== false);
      setActiveStatusMenuOpen(false);
    } catch (error) {
      setActiveStatusError(error instanceof Error ? error.message : "Unable to update active status.");
    } finally {
      setActiveStatusSaving(false);
    }
  };

  const chooseCallsPrivacy = async (value: "audio" | "video" | "both" | "none") => {
    const savedToken = localStorage.getItem("hallschat_token");
    if (!savedToken || callsPrivacySaving || !callsPrivacyLoaded) return;
    setCallsPrivacySaving(true);
    setCallsPrivacyError("");
    try {
      const response = await fetch(apiBase + "/api/settings/calls-privacy", {
        method: "PATCH",
        headers: { Authorization: "Bearer " + savedToken, "Content-Type": "application/json" },
        body: JSON.stringify({ callsPrivacy: value })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Unable to update calls privacy.");
      const savedValue = payload.callsPrivacy;
      setCallsPrivacy(savedValue === "audio" || savedValue === "video" || savedValue === "none" ? savedValue : "both");
      setCallsPrivacyMenuOpen(false);
    } catch (error) {
      setCallsPrivacyError(error instanceof Error ? error.message : "Unable to update calls privacy.");
    } finally {
      setCallsPrivacySaving(false);
    }
  };

  const chooseVisibility = async (visible: boolean) => {
    const savedToken = localStorage.getItem("hallschat_token");
    if (!savedToken || visibilitySaving || !visibilityLoaded) return;
    setVisibilitySaving(true);
    setVisibilityError("");
    try {
      const response = await fetch(apiBase + "/api/settings/visibility", {
        method: "PATCH",
        headers: { Authorization: "Bearer " + savedToken, "Content-Type": "application/json" },
        body: JSON.stringify({ profileDiscoverable: visible })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Unable to update visibility.");
      setProfileDiscoverable(payload.profileDiscoverable !== false);
      setVisibilityMenuOpen(false);
    } catch (error) {
      setVisibilityError(error instanceof Error ? error.message : "Unable to update visibility.");
    } finally {
      setVisibilitySaving(false);
    }
  };

  const chooseCommenting = async (enabled: boolean) => {
    const savedToken = localStorage.getItem("hallschat_token");
    if (!savedToken || commentingSaving || !commentingLoaded) return;
    setCommentingSaving(true);
    setCommentingError("");
    try {
      const response = await fetch(apiBase + "/api/settings/commenting", {
        method: "PATCH",
        headers: { Authorization: "Bearer " + savedToken, "Content-Type": "application/json" },
        body: JSON.stringify({ commentsEnabled: enabled })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Unable to update commenting settings.");
      setCommentsEnabled(payload.commentsEnabled !== false);
      setCommentingMenuOpen(false);
    } catch (error) {
      setCommentingError(error instanceof Error ? error.message : "Unable to update commenting settings.");
    } finally {
      setCommentingSaving(false);
    }
  };

  const chooseReadReceipts = async (visible: boolean) => {
    const savedToken = localStorage.getItem("hallschat_token");
    if (!savedToken || readReceiptsSaving || !readReceiptsLoaded) return;
    setReadReceiptsSaving(true);
    setReadReceiptsError("");
    try {
      const response = await fetch(apiBase + "/api/settings/read-receipts", {
        method: "PATCH",
        headers: { Authorization: "Bearer " + savedToken, "Content-Type": "application/json" },
        body: JSON.stringify({ readReceiptsVisible: visible })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || "Unable to update read receipt settings.");
      setReadReceiptsVisible(payload.readReceiptsVisible !== false);
      setReadReceiptsMenuOpen(false);
    } catch (error) {
      setReadReceiptsError(error instanceof Error ? error.message : "Unable to update read receipt settings.");
    } finally {
      setReadReceiptsSaving(false);
    }
  };

  const callsPrivacyLabel = callsPrivacy === "audio" ? "Only Audio" : callsPrivacy === "video" ? "Only Video" : callsPrivacy === "none" ? "Allow None" : "Allow Both";

  const chooseTheme = (preference: "dark" | "light" | "system") => {
    setThemePreference(preference);
    setThemeMenuOpen(false);
  };

  return <main className="home-page social-home settings-page theme-token-scope">
    <AppHeader homeHref="/home" />
    <section className="home-shell social-shell settings-shell">
      <section className="settings-theme-card" aria-label="App theme">
        <span className="settings-theme-title">App theme</span>
        <span className="settings-theme-current" aria-live="polite">{currentThemeLabel}</span>
        <div className="settings-theme-menu-anchor" ref={themeMenuRef}>
          <button
            type="button"
            className="settings-theme-menu-trigger"
            aria-label="Choose app theme"
            aria-haspopup="menu"
            aria-expanded={themeMenuOpen}
            onClick={() => setThemeMenuOpen(open => !open)}
          >
            <MoreHorizontal size={21} />
          </button>
          {themeMenuOpen && <div className="settings-theme-menu" role="menu" aria-label="App theme options">
            {([
              { value: "dark", label: "Dark" },
              { value: "light", label: "Light" },
              { value: "system", label: "System" },
            ] as const).map(option => <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={themePreference === option.value}
              className={`settings-theme-menu-option${themePreference === option.value ? " is-selected" : ""}`}
              onClick={() => chooseTheme(option.value)}
            >
              <span>{option.label}</span>
              {themePreference === option.value && <Check size={15} aria-hidden="true" />}
            </button>)}
          </div>}
        </div>
      </section>
      {maxDeviceMessage && <div className="halls-toast halls-toast-error" role="status" aria-live="polite"><span>{maxDeviceMessage}</span><button type="button" onClick={() => setMaxDeviceMessage("")} aria-label="Dismiss notification">×</button></div>}
      <section className="settings-theme-card" aria-label="Alert Color">
        <span className="settings-theme-title">Alert Color</span>
        <span className="settings-theme-current" aria-live="polite"><span className="settings-alert-color-swatch" style={{ background: alertColor }} aria-hidden="true" />{alertColorEnabled ? "Enabled" : "Disabled"}</span>
        <div className="settings-theme-menu-anchor" ref={alertColorMenuRef}>
          <button type="button" className="settings-theme-menu-trigger" aria-label="Alert Color options" aria-haspopup="menu" aria-expanded={alertColorMenuOpen} onClick={() => setAlertColorMenuOpen(open => !open)}>
            <MoreHorizontal size={21} />
          </button>
          {alertColorMenuOpen && <div className="settings-theme-menu" role="menu" aria-label="Alert Color options">
            <button type="button" role="menuitemcheckbox" aria-checked={alertColorEnabled} className={"settings-theme-menu-option" + (alertColorEnabled ? " is-selected" : "")} onClick={() => saveAlertColorEnabled(!alertColorEnabled)}>
              <span>{alertColorEnabled ? "Disable" : "Enable"}</span><span>{alertColorEnabled ? "On" : "Off"}</span>{alertColorEnabled && <Check size={15} aria-hidden="true" />}
            </button>
            <button type="button" role="menuitem" className="settings-theme-menu-option" onClick={() => { setAlertColorMenuOpen(false); setAlertColorModalOpen(true); }}>
              <span>Choose Color</span><span className="settings-alert-color-swatch" style={{ background: alertColor }} aria-hidden="true" />
            </button>
          </div>}
        </div>
      </section>
      <section className="settings-theme-card" aria-label="Nowbar Color">
        <span className="settings-theme-title">Nowbar Color</span>
        <span className="settings-theme-current" aria-live="polite"><span className="settings-alert-color-swatch" style={{ background: nowbarColor }} aria-hidden="true" />{nowbarColorEnabled ? "Enabled" : "Disabled"} · {NOWBAR_LIGHT_STYLES.find(option => option.value === nowbarLightStyle)?.label || "Steady Glow"}</span>
        <div className="settings-theme-menu-anchor" ref={nowbarColorMenuRef}>
          <button type="button" className="settings-theme-menu-trigger" aria-label="Nowbar Color options" aria-haspopup="menu" aria-expanded={nowbarColorMenuOpen} onClick={() => setNowbarColorMenuOpen(open => !open)}><MoreHorizontal size={21} /></button>
          {nowbarColorMenuOpen && <div className="settings-theme-menu settings-nowbar-color-menu" role="menu" aria-label="Nowbar Color options">
            <button type="button" role="menuitemcheckbox" aria-checked={nowbarColorEnabled} className={"settings-theme-menu-option" + (nowbarColorEnabled ? " is-selected" : "")} onClick={() => saveNowbarColorEnabled(!nowbarColorEnabled)}>
              <span>{nowbarColorEnabled ? "Disable" : "Enable"}</span><span>{nowbarColorEnabled ? "On" : "Off"}</span>{nowbarColorEnabled && <Check size={15} aria-hidden="true" />}
            </button>
            <button type="button" role="menuitem" className="settings-theme-menu-option" onClick={() => { setNowbarColorMenuOpen(false); setNowbarColorModalOpen(true); }}>
              <span>Choose Color</span><span className="settings-alert-color-swatch" style={{ background: nowbarColor }} aria-hidden="true" />
            </button>
            <div className="settings-theme-menu-group-label">Light Style</div>
            {NOWBAR_LIGHT_STYLES.map(option => <button key={option.value} type="button" role="menuitemradio" aria-checked={nowbarLightStyle === option.value} title={option.description} className={"settings-theme-menu-option settings-nowbar-light-option" + (nowbarLightStyle === option.value ? " is-selected" : "")} onClick={() => saveNowbarLightStyle(option.value)}>
              <span><span className={"settings-nowbar-style-preview settings-nowbar-style-" + option.value} style={{ "--nowbar-preview-color": nowbarColor } as CSSProperties} aria-hidden="true" />{option.label}</span>{nowbarLightStyle === option.value && <Check size={15} aria-hidden="true" />}
            </button>)}
          </div>}
        </div>
      </section>
      <section className="settings-theme-card" aria-label="Nowbar Button Color">
        <span className="settings-theme-title">Nowbar Button Color</span>
        <span className="settings-theme-current" aria-live="polite"><span className="settings-alert-color-swatch" style={{ background: nowbarButtonColor }} aria-hidden="true" />{nowbarButtonColorEnabled ? "Enabled" : "Disabled"}</span>
        <div className="settings-theme-menu-anchor" ref={nowbarButtonColorMenuRef}>
          <button type="button" className="settings-theme-menu-trigger" aria-label="Nowbar Button Color options" aria-haspopup="menu" aria-expanded={nowbarButtonColorMenuOpen} onClick={() => setNowbarButtonColorMenuOpen(open => !open)}><MoreHorizontal size={21} /></button>
          {nowbarButtonColorMenuOpen && <div className="settings-theme-menu settings-nowbar-button-color-menu" role="menu" aria-label="Nowbar Button Color options">
            <button type="button" role="menuitemcheckbox" aria-checked={nowbarButtonColorEnabled} className={"settings-theme-menu-option" + (nowbarButtonColorEnabled ? " is-selected" : "")} onClick={() => saveNowbarButtonColorEnabled(!nowbarButtonColorEnabled)}>
              <span>{nowbarButtonColorEnabled ? "Disable" : "Enable"}</span><span>{nowbarButtonColorEnabled ? "On" : "Off"}</span>{nowbarButtonColorEnabled && <Check size={15} aria-hidden="true" />}
            </button>
            <button type="button" role="menuitem" className="settings-theme-menu-option" onClick={() => { setNowbarButtonColorMenuOpen(false); setNowbarButtonColorModalOpen(true); }}>
              <span>Choose Color</span><span className="settings-alert-color-swatch" style={{ background: nowbarButtonColor }} aria-hidden="true" />
            </button>
          </div>}
        </div>
      </section>
      <section className="settings-theme-card" aria-label="Active status">
        <span className="settings-theme-title">Active Status</span>
        <span className="settings-theme-current" aria-live="polite">{!activeStatusLoaded ? "Loading…" : activeStatusVisible ? "Shown" : "Hidden"}</span>
        <div className="settings-theme-menu-anchor" ref={activeStatusMenuRef}>
          <button
            type="button"
            className="settings-theme-menu-trigger"
            aria-label="Active status options"
            aria-haspopup="menu"
            aria-expanded={activeStatusMenuOpen}
            disabled={!activeStatusLoaded || activeStatusSaving}
            onClick={() => setActiveStatusMenuOpen(open => !open)}
          >
            <MoreHorizontal size={21} />
          </button>
          {activeStatusMenuOpen && <div className="settings-theme-menu" role="menu" aria-label="Active status options">
            {([
              { value: true, label: "Show active status" },
              { value: false, label: "Hide active status" },
            ] as const).map(option => <button
              key={String(option.value)}
              type="button"
              role="menuitemradio"
              aria-checked={activeStatusVisible === option.value}
              className={"settings-theme-menu-option" + (activeStatusVisible === option.value ? " is-selected" : "")}
              disabled={activeStatusSaving}
              onClick={() => void chooseActiveStatus(option.value)}
            >
              <span>{option.label}</span>
              {activeStatusVisible === option.value && <Check size={15} aria-hidden="true" />}
            </button>)}
          </div>}
        </div>
      </section>
      <section className="settings-theme-card" aria-label="Calls privacy">
        <span className="settings-theme-title">Calls privacy</span>
        <span className="settings-theme-current" aria-live="polite">{!callsPrivacyLoaded ? "Loading…" : callsPrivacyLabel}</span>
        <div className="settings-theme-menu-anchor" ref={callsPrivacyMenuRef}>
          <button
            type="button"
            className="settings-theme-menu-trigger"
            aria-label="Calls privacy options"
            aria-haspopup="menu"
            aria-expanded={callsPrivacyMenuOpen}
            disabled={!callsPrivacyLoaded || callsPrivacySaving}
            onClick={() => setCallsPrivacyMenuOpen(open => !open)}
          >
            <MoreHorizontal size={21} />
          </button>
          {callsPrivacyMenuOpen && <div className="settings-theme-menu" role="menu" aria-label="Calls privacy options">
            {([
              { value: "audio", label: "Only Audio" },
              { value: "video", label: "Only Video" },
              { value: "both", label: "Allow Both" },
              { value: "none", label: "Allow None" },
            ] as const).map(option => <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={callsPrivacy === option.value}
              className={"settings-theme-menu-option" + (callsPrivacy === option.value ? " is-selected" : "")}
              disabled={callsPrivacySaving}
              onClick={() => void chooseCallsPrivacy(option.value)}
            >
              <span>{option.label}</span>
              {callsPrivacy === option.value && <Check size={15} aria-hidden="true" />}
            </button>)}
          </div>}
        </div>
      </section>
      <section className="settings-theme-card" aria-label="Visibility">
        <span className="settings-theme-title">Visibility</span>
        <span className="settings-theme-current" aria-live="polite">{!visibilityLoaded ? "Loading…" : profileDiscoverable ? "Profile shown" : "Profile hidden"}</span>
        <div className="settings-theme-menu-anchor" ref={visibilityMenuRef}>
          <button
            type="button"
            className="settings-theme-menu-trigger"
            aria-label="Visibility options"
            aria-haspopup="menu"
            aria-expanded={visibilityMenuOpen}
            disabled={!visibilityLoaded || visibilitySaving}
            onClick={() => setVisibilityMenuOpen(open => !open)}
          >
            <MoreHorizontal size={21} />
          </button>
          {visibilityMenuOpen && <div className="settings-theme-menu" role="menu" aria-label="Visibility options">
            {([
              { value: false, label: "Hide Profile" },
              { value: true, label: "Show Profile" },
            ] as const).map(option => <button
              key={String(option.value)}
              type="button"
              role="menuitemradio"
              aria-checked={profileDiscoverable === option.value}
              className={"settings-theme-menu-option" + (profileDiscoverable === option.value ? " is-selected" : "")}
              disabled={visibilitySaving}
              onClick={() => void chooseVisibility(option.value)}
            >
              <span>{option.label}</span>
              {profileDiscoverable === option.value && <Check size={15} aria-hidden="true" />}
            </button>)}
          </div>}
        </div>
      </section>
      <section className="settings-theme-card" aria-label="Read Receipt">
        <span className="settings-theme-title">Read Receipt</span>
        <span className="settings-theme-current" aria-live="polite">{!readReceiptsLoaded ? "Loading…" : readReceiptsVisible ? "Shown" : "Hidden"}</span>
        <div className="settings-theme-menu-anchor" ref={readReceiptsMenuRef}>
          <button
            type="button"
            className="settings-theme-menu-trigger"
            aria-label="Read receipt options"
            aria-haspopup="menu"
            aria-expanded={readReceiptsMenuOpen}
            disabled={!readReceiptsLoaded || readReceiptsSaving}
            onClick={() => setReadReceiptsMenuOpen(open => !open)}
          >
            <MoreHorizontal size={21} />
          </button>
          {readReceiptsMenuOpen && <div className="settings-theme-menu" role="menu" aria-label="Read receipt options">
            {([
              { value: false, label: "Hide" },
              { value: true, label: "Show" },
            ] as const).map(option => <button
              key={String(option.value)}
              type="button"
              role="menuitemradio"
              aria-checked={readReceiptsVisible === option.value}
              className={"settings-theme-menu-option" + (readReceiptsVisible === option.value ? " is-selected" : "")}
              disabled={readReceiptsSaving}
              onClick={() => void chooseReadReceipts(option.value)}
            >
              <span>{option.label}</span>
              {readReceiptsVisible === option.value && <Check size={15} aria-hidden="true" />}
            </button>)}
          </div>}
        </div>
      </section>
      <section className="settings-theme-card" aria-label="Commenting">
        <span className="settings-theme-title">Commenting</span>
        <span className="settings-theme-current" aria-live="polite">{!commentingLoaded ? "Loading…" : commentsEnabled ? "Turned On" : "Turned Off"}</span>
        <div className="settings-theme-menu-anchor" ref={commentingMenuRef}>
          <button
            type="button"
            className="settings-theme-menu-trigger"
            aria-label="Commenting options"
            aria-haspopup="menu"
            aria-expanded={commentingMenuOpen}
            disabled={!commentingLoaded || commentingSaving}
            onClick={() => setCommentingMenuOpen(open => !open)}
          >
            <MoreHorizontal size={21} />
          </button>
          {commentingMenuOpen && <div className="settings-theme-menu" role="menu" aria-label="Commenting options">
            {([
              { value: true, label: "Turn On" },
              { value: false, label: "Turn Off" },
            ] as const).map(option => <button
              key={String(option.value)}
              type="button"
              role="menuitemradio"
              aria-checked={commentsEnabled === option.value}
              className={"settings-theme-menu-option" + (commentsEnabled === option.value ? " is-selected" : "")}
              disabled={commentingSaving}
              onClick={() => void chooseCommenting(option.value)}
            >
              <span>{option.label}</span>
              {commentsEnabled === option.value && <Check size={15} aria-hidden="true" />}
            </button>)}
          </div>}
        </div>
      </section>
      <section className="settings-theme-card" aria-label="Alert Channel">
        <span className="settings-theme-title">Alert Channel</span>
        <span className="settings-theme-current" aria-live="polite">{!alertChannelsLoaded ? "Loading…" : [alertChannels.email && "Email", alertChannels.inApp && "In-App", alertChannels.push && "Push"].filter(Boolean).join(" · ") || "All Off"}</span>
        <div className="settings-theme-menu-anchor" ref={alertChannelMenuRef}>
          <button type="button" className="settings-theme-menu-trigger" aria-label="Alert Channel options" aria-haspopup="menu" aria-expanded={alertChannelMenuOpen} disabled={!alertChannelsLoaded || alertChannelsSaving} onClick={() => setAlertChannelMenuOpen(open => !open)}>
            <MoreHorizontal size={21} />
          </button>
          {alertChannelMenuOpen && <div className="settings-theme-menu" role="menu" aria-label="Alert Channel options">
            {([
              { value: "email", label: "Email" },
              { value: "inApp", label: "In-App" },
              { value: "push", label: "Push" },
            ] as const).map(option => <button
              key={option.value}
              type="button"
              role="menuitemcheckbox"
              aria-checked={alertChannels[option.value]}
              className={"settings-theme-menu-option" + (alertChannels[option.value] ? " is-selected" : "")}
              disabled={alertChannelsSaving}
              onClick={() => void chooseAlertChannel(option.value)}
            >
              <span>{option.label}</span>
              <span>{alertChannels[option.value] ? "On" : "Off"}</span>
              {alertChannels[option.value] && <Check size={15} aria-hidden="true" />}
            </button>)}
          </div>}
        </div>
      </section>
      <section className="settings-theme-card" aria-label="Alert Types">
        <span className="settings-theme-title">Alert Types</span>
        <span className="settings-theme-current" aria-live="polite">{!alertChannelsLoaded ? "Loading…" : `${Object.values(alertTypes).filter(Boolean).length} of ${Object.keys(DEFAULT_ALERT_TYPES).length} enabled`}</span>
        <div className="settings-theme-menu-anchor" ref={alertTypesMenuRef}>
          <button type="button" className="settings-theme-menu-trigger" aria-label="Alert Types options" aria-haspopup="menu" aria-expanded={alertTypesMenuOpen} disabled={!alertChannelsLoaded || alertTypesSaving} onClick={() => setAlertTypesMenuOpen(open => !open)}>
            <MoreHorizontal size={21} />
          </button>
          {alertTypesMenuOpen && <div className="settings-theme-menu settings-alert-types-menu" role="menu" aria-label="Alert Types options">
            {ALERT_TYPE_GROUPS.map(group => <div key={group.label}>
              <div className="settings-theme-menu-group-label">{group.label}</div>
              {group.options.map(option => <button
                key={option.value}
                type="button"
                role="menuitemcheckbox"
                aria-checked={alertTypes[option.value]}
                className={"settings-theme-menu-option" + (alertTypes[option.value] ? " is-selected" : "")}
                disabled={alertTypesSaving}
                onClick={() => void chooseAlertType(option.value)}
              >
                <span>{option.label}</span>
                <span>{alertTypes[option.value] ? "On" : "Off"}</span>
                {alertTypes[option.value] && <Check size={15} aria-hidden="true" />}
              </button>)}
            </div>)}
          </div>}
        </div>
      </section>
      <section className="settings-theme-card" aria-label="Idle Logout">
        <span className="settings-theme-title">Idle Logout</span>
        <span className="settings-theme-current" aria-live="polite">{idleLogoutMinutes === 0 ? "Disabled" : `${idleLogoutMinutes} Minutes`}</span>
        <div className="settings-theme-menu-anchor" ref={idleLogoutMenuRef}>
          <button type="button" className="settings-theme-menu-trigger" aria-label="Idle Logout options" aria-haspopup="menu" aria-expanded={idleLogoutMenuOpen} onClick={() => setIdleLogoutMenuOpen(open => !open)}>
            <MoreHorizontal size={21} />
          </button>
          {idleLogoutMenuOpen && <div className="settings-theme-menu" role="menu" aria-label="Idle Logout options">
            {([
              { value: 0, label: "Disabled" },
              { value: 5, label: "5 Minutes" },
              { value: 10, label: "10 Minutes" },
              { value: 30, label: "30 Minutes" },
            ] as const).map(option => <button key={option.value} type="button" role="menuitemradio" aria-checked={idleLogoutMinutes === option.value} className={"settings-theme-menu-option" + (idleLogoutMinutes === option.value ? " is-selected" : "")} onClick={() => chooseIdleLogout(option.value)}>
              <span>{option.label}</span>
              {idleLogoutMinutes === option.value && <Check size={15} aria-hidden="true" />}
            </button>)}
          </div>}
        </div>
      </section>
      <section className="settings-theme-card" aria-label="Nowbar Toggle">
        <span className="settings-theme-title">Nowbar Toggle</span>
        <span className="settings-theme-current" aria-live="polite">{nowbarSwipeEnabled ? "Swipe On" : "Swipe Off"} · {nowbarExpandEnabled ? "Expand On" : "Expand Off"}</span>
        <div className="settings-theme-menu-anchor" ref={nowbarToggleMenuRef}>
          <button type="button" className="settings-theme-menu-trigger" aria-label="Nowbar Toggle options" aria-haspopup="menu" aria-expanded={nowbarToggleMenuOpen} onClick={() => setNowbarToggleMenuOpen(open => !open)}><MoreHorizontal size={21} /></button>
          {nowbarToggleMenuOpen && <div className="settings-theme-menu" role="menu" aria-label="Nowbar Toggle options" style={{ width: "166px" }}>
            <div className="settings-theme-menu-group-label">Swipe navigation</div>
            <button type="button" role="menuitemcheckbox" aria-checked={nowbarSwipeEnabled} className={"settings-theme-menu-option" + (nowbarSwipeEnabled ? " is-selected" : "")} onClick={() => chooseNowbarToggle("swipe", !nowbarSwipeEnabled)}><span>Swipe</span><span>{nowbarSwipeEnabled ? "On" : "Off"}</span></button>
            <div className="settings-theme-menu-group-label">Expansion</div>
            <button type="button" role="menuitemcheckbox" aria-checked={nowbarExpandEnabled} className={"settings-theme-menu-option" + (nowbarExpandEnabled ? " is-selected" : "")} onClick={() => chooseNowbarToggle("expand", !nowbarExpandEnabled)}><span>Expand</span><span>{nowbarExpandEnabled ? "On" : "Off"}</span></button>
          </div>}
        </div>
      </section>
{maxDeviceMessage && <div className="halls-toast halls-toast-error" role="status" aria-live="polite"><span>{maxDeviceMessage}</span><button type="button" onClick={() => setMaxDeviceMessage("")} aria-label="Dismiss notification">×</button></div>}
            {alertTypesError && <div className="halls-toast halls-toast-error" role="status" aria-live="polite"><span>{alertTypesError}</span><button type="button" onClick={() => setAlertTypesError("")} aria-label="Dismiss notification">×</button></div>}
      {alertChannelsError && <div className="halls-toast halls-toast-error" role="status" aria-live="polite"><span>{alertChannelsError}</span><button type="button" onClick={() => setAlertChannelsError("")} aria-label="Dismiss notification">×</button></div>}
      {commentingError && <div className="halls-toast halls-toast-error" role="status" aria-live="polite"><span>{commentingError}</span><button type="button" onClick={() => setCommentingError("")} aria-label="Dismiss notification">×</button></div>}
      {readReceiptsError && <div className="halls-toast halls-toast-error" role="status" aria-live="polite"><span>{readReceiptsError}</span><button type="button" onClick={() => setReadReceiptsError("")} aria-label="Dismiss notification">×</button></div>}
      {visibilityError && <div className="halls-toast halls-toast-error" role="status" aria-live="polite"><span>{visibilityError}</span><button type="button" onClick={() => setVisibilityError("")} aria-label="Dismiss notification">×</button></div>}
      {callsPrivacyError && <div className="halls-toast halls-toast-error" role="status" aria-live="polite"><span>{callsPrivacyError}</span><button type="button" onClick={() => setCallsPrivacyError("")} aria-label="Dismiss notification">×</button></div>}
      {activeStatusError && <div className="halls-toast halls-toast-error" role="status" aria-live="polite"><span>{activeStatusError}</span><button type="button" onClick={() => setActiveStatusError("")} aria-label="Dismiss notification">×</button></div>}
      <section className="settings-theme-card" aria-label="Max Device">
        <span className="settings-theme-title">Max Device</span>
        <span className="settings-theme-current" aria-live="polite">{!maxDeviceLoaded ? "Loading…" : `${maxDeviceMode === "flex" ? "Flex" : "Fixed"} · ${maxDevices} ${maxDevices === 1 ? "session" : "sessions"}`}</span>
        <div className="settings-theme-menu-anchor" ref={maxDeviceMenuRef}>
          <button type="button" className="settings-theme-menu-trigger" aria-label="Max Device options" aria-haspopup="menu" aria-expanded={maxDeviceMenuOpen} disabled={!maxDeviceLoaded || maxDeviceSaving} onClick={() => setMaxDeviceMenuOpen(open => !open)}>
            <MoreHorizontal size={21} />
          </button>
          {maxDeviceMenuOpen && <div className="settings-theme-menu settings-max-device-menu" role="menu" aria-label="Max Device options">
            <div className="settings-theme-menu-group-label">When the limit is reached</div>
            {([{ value: "flex", label: "Flex" }, { value: "fixed", label: "Fixed" }] as const).map(option => <button key={option.value} type="button" role="menuitemradio" aria-checked={maxDeviceMode === option.value} className={"settings-theme-menu-option" + (maxDeviceMode === option.value ? " is-selected" : "")} disabled={maxDeviceSaving} onClick={() => void chooseMaxDevice({ mode: option.value })}>
              <span>{option.label}</span>{maxDeviceMode === option.value && <Check size={15} aria-hidden="true" />}
            </button>)}
            <div className="settings-theme-menu-group-label">Maximum active sessions</div>
            <div className="settings-max-device-number-grid">
              {[1, 2, 3, 4, 5].map(value => <button key={value} type="button" role="menuitemradio" aria-checked={maxDevices === value} className={"settings-max-device-number" + (maxDevices === value ? " is-selected" : "")} disabled={maxDeviceSaving} onClick={() => void chooseMaxDevice({ maxDevices: value })}>{value}{maxDevices === value && <Check size={13} aria-hidden="true" />}</button>)}
            </div>
            <div className="settings-theme-menu-group-label">Currently active: {activeDeviceSessions}</div>
          </div>}
        </div>
      </section>
      <section className="settings-theme-card settings-download-app-card" aria-label="Download App">
        <div className="settings-download-app-details">
          <span className="settings-theme-title">Download App</span>
          <span className="settings-theme-current" aria-live="polite">{pwaInstalled ? "PWA installed" : "APK · Web App"}</span>
          {Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android" && <span className="settings-theme-current" aria-live="polite">{apkUpdate.status === "checking" ? "Checking APK version…" : apkUpdate.status === "update" ? "Update available · v" + (apkUpdate.latestVersion || "latest") : apkUpdate.status === "current" ? "Latest APK installed · v" + (apkUpdate.installedVersion || "") : "APK version unavailable"}</span>}
        </div>
        <div className="settings-theme-menu-anchor" ref={downloadAppMenuRef}>
          <button
            type="button"
            className="settings-theme-menu-trigger"
            aria-label="Download App options"
            aria-haspopup="menu"
            aria-expanded={downloadAppMenuOpen}
            onClick={() => setDownloadAppMenuOpen(open => !open)}
          >
            <MoreHorizontal size={21} />
          </button>
          {downloadAppMenuOpen && <div className="settings-theme-menu settings-download-app-menu" role="menu" aria-label="Download App options">
            <button type="button" role="menuitem" className="settings-theme-menu-option" disabled aria-disabled="true">
              <Store size={16} aria-hidden="true" />
              <span>KingsStore</span>
              <span className="settings-download-app-note">Soon</span>
            </button>
            <a
              role="menuitem"
              className="settings-theme-menu-option settings-download-app-link"
              href={HALLSCHAT_APK_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleApkDownload}
            >
              <Smartphone size={16} aria-hidden="true" />
              <span>{Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android" && apkUpdate.status === "update" ? "Update APK" : "Android APK"}</span>
              {Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android" && apkUpdate.status === "current" ? <Check size={15} aria-hidden="true" /> : <Download size={15} aria-hidden="true" />}
            </a>
            <button type="button" role="menuitem" className="settings-theme-menu-option" onClick={() => void handlePwaInstall()}>
              <Globe size={16} aria-hidden="true" />
              <span>PWA (Web App)</span>
              {pwaInstalled && <Check size={15} aria-hidden="true" />}
            </button>
          </div>}
        </div>
      </section>
    </section>
    {alertColorModalOpen && <AlertColorModal color={alertColor} onChange={saveAlertColor} onClose={closeAlertColorModal} />}
    {nowbarColorModalOpen && <AlertColorModal color={nowbarColor} onChange={saveNowbarColor} onClose={closeNowbarColorModal} title="Choose Nowbar Color" description="Choose the edge-light color used by your Nowbar. Your choice saves immediately." />}
    {nowbarButtonColorModalOpen && <AlertColorModal color={nowbarButtonColor} onChange={saveNowbarButtonColor} onClose={closeNowbarButtonColorModal} title="Choose Nowbar Button Color" description="Choose the border color for your Nowbar navigation buttons. Your choice saves immediately." />}
    {downloadAppMessage && <div className="halls-toast halls-toast-success" role="status" aria-live="polite"><span>{downloadAppMessage}</span><button type="button" onClick={() => setDownloadAppMessage("")} aria-label="Dismiss notification">×</button></div>}
    <NowBar />
  </main>;
}
