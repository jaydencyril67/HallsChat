import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./theme.css";
import "./styles.css";

// Resolve the saved appearance before React paints so refreshes never flash the wrong theme.
const HALLSCHAT_THEME_KEY = "hallschat-theme";
function applySavedTheme() {
  let preference = "dark";
  try {
    const saved = window.localStorage.getItem(HALLSCHAT_THEME_KEY);
    if (saved === "light" || saved === "dark" || saved === "system") preference = saved;
  } catch {}
  const resolved = preference === "system"
    ? (window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark")
    : preference;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", resolved === "light" ? "#f8f3f1" : "#19070b");
}
applySavedTheme();
try {
  const saved = window.localStorage.getItem(HALLSCHAT_THEME_KEY);
  if (saved === "system") {
    window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", applySavedTheme);
  }
} catch {}

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
