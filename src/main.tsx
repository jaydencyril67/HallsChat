import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./theme.css";
import "./styles.css";
import { listenForNativeLaunchUrls } from "./utils/crossAppLauncher";

// Lock the app to its burgundy dark theme before React paints.
document.documentElement.dataset.theme = "dark";
document.documentElement.style.colorScheme = "dark";
document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#210812");

function handleNativeHallsChatLaunch(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "hallschat:" || url.hostname !== "signin") return;
    const params = new URLSearchParams(url.hash.replace(/^#/, ""));
    const email = (params.get("kingshall_account") || "").trim().toLowerCase();
    const route = "/signin" + (email ? "#kingshall_account=" + encodeURIComponent(email) : "");
    window.history.replaceState({}, "", route);
    window.dispatchEvent(new PopStateEvent("popstate"));
  } catch {
    // Ignore unrelated or malformed Android launch intents.
  }
}

listenForNativeLaunchUrls(handleNativeHallsChatLaunch);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registration) => registration.update())
      .catch((error) => {
        console.error("HallsChat service worker update failed:", error);
      });
  });
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
