import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./theme.css";
import "./styles.css";

// Lock the app to its burgundy dark theme before React paints.
document.documentElement.dataset.theme = "dark";
document.documentElement.style.colorScheme = "dark";
document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#210812");

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
