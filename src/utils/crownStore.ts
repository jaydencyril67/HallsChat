import { Capacitor } from "@capacitor/core";

export type CrownStoreSlug = "kingshall" | "halls-chat" | "crybots";

const CROWNSTORE_BASE_URL = "https://crownstore.kingshall.online";
const CROWNSTORE_ANDROID_PACKAGE = "online.kingshall.crownstore";

export function openCrownStoreApp(slug: CrownStoreSlug, onMessage?: (message: string) => void): void {
  const webUrl = CROWNSTORE_BASE_URL + "/?app=" + encodeURIComponent(slug);
  onMessage?.("Opening CrownStore…");

  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
    window.location.assign(webUrl);
    return;
  }

  let appWasBackgrounded = false;
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") appWasBackgrounded = true;
  };
  document.addEventListener("visibilitychange", onVisibilityChange);
  const deepLink = "intent://app?slug=" + encodeURIComponent(slug)
    + "#Intent;scheme=crownstore;package=" + CROWNSTORE_ANDROID_PACKAGE
    + ";S.browser_fallback_url=" + encodeURIComponent(webUrl) + ";end";

  try {
    window.location.assign(deepLink);
  } catch {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.location.assign(webUrl);
    return;
  }

  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    if (!appWasBackgrounded && document.visibilityState !== "hidden") window.location.assign(webUrl);
  }, 1400);
}
