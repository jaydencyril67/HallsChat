import { Check, Moon, Sun, Smartphone } from "lucide-react";
import { useAppTheme } from "./components/AppTheme";
import AppHeader from "./AppHeader";
import NowBar from "./NowBar";

export default function ThemeSettingsPage() {
  const { themeMode, themePreference, setThemePreference } = useAppTheme();
  const isLight = themeMode === "light";
  const choice = themePreference;
  const toggleTheme = () => setThemePreference(isLight ? "dark" : "light");

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
          onClick={() => setThemePreference("system")}
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
