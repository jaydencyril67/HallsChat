import { Check, Download, Globe, MoreHorizontal, Smartphone, Store } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { NativeAppUpdate } from "./utils/nativeAppUpdate";
import { navigate } from "./utils/navigate";
import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
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
  const [downloadAppMenuOpen, setDownloadAppMenuOpen] = useState(false);
  const downloadAppMenuRef = useRef<HTMLDivElement>(null);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [pwaInstalled, setPwaInstalled] = useState(() => window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true);
  const [downloadAppMessage, setDownloadAppMessage] = useState("");
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

  const handleApkDownload = async (event: ReactMouseEvent<HTMLAnchorElement>) => {
    setDownloadAppMenuOpen(false);
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
      setDownloadAppMessage("Opening the latest signed HallsChat APK download.");
      return;
    }
    event.preventDefault();
    setDownloadAppMessage("Preparing the Android APK download…");
    try {
      const result = await NativeAppUpdate.downloadAndInstall({ url: HALLSCHAT_APK_URL });
      if (result.requiresPermission) {
        setDownloadAppMessage("Allow HallsChat to install unknown apps in Android settings, return here, then tap Android APK again.");
      } else {
        setDownloadAppMessage("The APK is downloading. Android will ask you to approve the update when it finishes.");
      }
    } catch {
      setDownloadAppMessage("The in-app installer could not start. Opening the APK download in your browser.");
      window.setTimeout(() => window.open(HALLSCHAT_APK_URL, "_blank", "noopener,noreferrer"), 300);
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
      {alertTypesError && <p className="settings-theme-current" role="status">{alertTypesError}</p>}
      {alertChannelsError && <p className="settings-theme-current" role="status">{alertChannelsError}</p>}
      {commentingError && <p className="settings-theme-current" role="status">{commentingError}</p>}
      {readReceiptsError && <p className="settings-theme-current" role="status">{readReceiptsError}</p>}
      {visibilityError && <p className="settings-theme-current" role="status">{visibilityError}</p>}
      {callsPrivacyError && <p className="settings-theme-current" role="status">{callsPrivacyError}</p>}
      {activeStatusError && <p className="settings-theme-current" role="status">{activeStatusError}</p>}
      <section className="settings-theme-card" aria-label="Download App">
        <span className="settings-theme-title">Download App</span>
        <span className="settings-theme-current" aria-live="polite">{pwaInstalled ? "PWA installed" : "APK · Web App"}</span>
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
              <span>Android APK</span>
              <Download size={15} aria-hidden="true" />
            </a>
            <button type="button" role="menuitem" className="settings-theme-menu-option" onClick={() => void handlePwaInstall()}>
              <Globe size={16} aria-hidden="true" />
              <span>PWA (Web App)</span>
              {pwaInstalled && <Check size={15} aria-hidden="true" />}
            </button>
          </div>}
        </div>
        {downloadAppMessage && <span className="settings-theme-current settings-download-app-status" role="status">{downloadAppMessage}</span>}
      </section>
    </section>
    <NowBar />
  </main>;
}
