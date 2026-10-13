import { Check, MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAppTheme } from "./components/AppTheme";
import AppHeader from "./AppHeader";
import NowBar from "./NowBar";

export default function ThemeSettingsPage() {
  const { themePreference, setThemePreference } = useAppTheme();
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const currentThemeLabel = themePreference === "system"
    ? "System"
    : themePreference === "light"
      ? "Light"
      : "Dark";

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

  const chooseTheme = (preference: "dark" | "light" | "system") => {
    setThemePreference(preference);
    setThemeMenuOpen(false);
  };

  return <main className="home-page social-home settings-page theme-token-scope">
    <AppHeader homeHref="/home" />
    <section className="home-shell social-shell settings-shell">
      <section className="settings-theme-card" aria-label="App theme">
        <span className="settings-theme-title">App theme</span>
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
        <span className="settings-theme-current" aria-live="polite">{currentThemeLabel}</span>
      </section>
    </section>
    <NowBar />
  </main>;
}
