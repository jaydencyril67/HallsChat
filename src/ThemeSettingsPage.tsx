import { Check, Moon, Sun, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import AppHeader from "./AppHeader";
import NowBar from "./NowBar";

type ThemeChoice = "dark" | "light" | "system";
const STORAGE_KEY = "hallschat-theme";

function readChoice(): ThemeChoice {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "light" || saved === "system" || saved === "dark" ? saved : "dark";
  } catch {
    return "dark";
  }
}

function resolveTheme(choice: ThemeChoice): "dark" | "light" {
  if (choice !== "system") return choice;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyChoice(choice: ThemeChoice) {
  const resolved = resolveTheme(choice);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    resolved === "light" ? "#f8f3f1" : "#19070b",
  );
}

export default function ThemeSettingsPage() {
  const [choice, setChoice] = useState<ThemeChoice>(readChoice);
  const resolvedTheme = resolveTheme(choice);
  const isLight = resolvedTheme === "light";

  useEffect(() => {
    applyChoice(choice);
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // Theme still works for this session if storage is unavailable.
    }
    if (choice !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const update = () => applyChoice("system");
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, [choice]);

  const toggleTheme = () => setChoice(isLight ? "dark" : "light");

  return <main className="home-page social-home settings-page">
    <AppHeader homeHref="/home" />
    <section className="home-shell social-shell settings-shell">
      <div className="settings-heading">
        <span className="settings-eyebrow">YOUR EXPERIENCE</span>
        <h1>Settings</h1>
        <p>Make HallsChat feel right for you.</p>
      </div>

      <section className="settings-card" aria-labelledby="appearance-heading">
        <div className="settings-card-heading">
          <span className="settings-section-icon"><Sun size={18} /></span>
          <div>
            <h2 id="appearance-heading">Appearance</h2>
            <p>Choose how HallsChat looks on this device.</p>
          </div>
        </div>

        <div className="settings-theme-switch-row">
          <span className="settings-theme-icon" aria-hidden="true">
            {isLight ? <Sun size={19} /> : <Moon size={19} />}
          </span>
          <span className="settings-theme-copy">
            <strong>{isLight ? "Light theme" : "Dark theme"}</strong>
            <small>{isLight ? "Warm ivory surfaces with burgundy accents" : "The original deep burgundy HallsChat look"}</small>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={isLight}
            aria-label="Toggle light theme"
            className={`settings-theme-switch${isLight ? " is-on" : ""}`}
            onClick={toggleTheme}
          >
            <span className="settings-theme-switch-thumb" />
          </button>
        </div>

        <button
          type="button"
          className={`settings-system-option${choice === "system" ? " is-selected" : ""}`}
          aria-pressed={choice === "system"}
          onClick={() => setChoice("system")}
        >
          <span className="settings-theme-icon"><Smartphone size={18} /></span>
          <span className="settings-theme-copy">
            <strong>Use device theme</strong>
            <small>Automatically follow your phone's light or dark setting</small>
          </span>
          <span className="settings-theme-check" aria-hidden="true">{choice === "system" && <Check size={15} />}</span>
        </button>
        <p className="settings-note">Your choice is saved on this device and stays selected after refresh.</p>
      </section>
    </section>
    <NowBar />
  </main>;
}
