import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type AppThemeMode = "light" | "dark";
export type AppThemePreference = "light" | "dark" | "system" | "shift";

type AppThemeContextValue = {
  themeMode: AppThemeMode;
  themePreference: AppThemePreference;
  setThemeMode: (mode: AppThemeMode) => void;
  setThemePreference: (preference: AppThemePreference) => void;
};

const APP_THEME_STORAGE_KEY = "hallschat-theme";
const APP_THEME_PREFERENCE_STORAGE_KEY = "hallschat-theme-preference";

const getSystemTheme = (): AppThemeMode =>
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";

const getShiftTheme = (): AppThemeMode => {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 18 ? "light" : "dark";
};

const getInitialPreference = (): AppThemePreference => {
  if (typeof window === "undefined") return "dark";

  try {
    const preference = window.localStorage.getItem(APP_THEME_PREFERENCE_STORAGE_KEY);
    if (preference === "light" || preference === "dark" || preference === "system" || preference === "shift") {
      return preference;
    }

    const legacy = window.localStorage.getItem(APP_THEME_STORAGE_KEY);
    if (legacy === "light" || legacy === "dark" || legacy === "system") return legacy;
  } catch {
    // Continue with the safe dark default if browser storage is unavailable.
  }

  return "dark";
};

const resolvePreference = (preference: AppThemePreference): AppThemeMode =>
  preference === "system" ? getSystemTheme() : preference === "shift" ? getShiftTheme() : preference;

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

/**
 * Shared CryBots-style theme state for future page-by-page adoption.
 * It preserves HallsChat's existing storage key and defaults to dark.
 */
export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [themePreference, setPreferenceState] = useState<AppThemePreference>(getInitialPreference);
  const [themeMode, setModeState] = useState<AppThemeMode>(() => resolvePreference(getInitialPreference()));

  useEffect(() => {
    try {
      window.localStorage.setItem(APP_THEME_STORAGE_KEY, themeMode);
      window.localStorage.setItem(APP_THEME_PREFERENCE_STORAGE_KEY, themePreference);
    } catch {
      // The in-memory theme remains usable when storage is blocked.
    }

    document.documentElement.dataset.theme = themeMode;
    document.querySelector('meta[name="theme-color"]')?.setAttribute(
      "content",
      themeMode === "light" ? "#f8f3f1" : "#19070b",
    );

    const updateAutomaticTheme = () => setModeState(resolvePreference(themePreference));

    if (themePreference === "system") {
      const media = window.matchMedia("(prefers-color-scheme: light)");
      media.addEventListener?.("change", updateAutomaticTheme);
      return () => media.removeEventListener?.("change", updateAutomaticTheme);
    }

    if (themePreference === "shift") {
      const timer = window.setInterval(updateAutomaticTheme, 60 * 1000);
      return () => window.clearInterval(timer);
    }
  }, [themeMode, themePreference]);

  const setThemeMode = (mode: AppThemeMode) => {
    setModeState(mode);
    setPreferenceState(mode);
  };

  const setThemePreference = (preference: AppThemePreference) => {
    setPreferenceState(preference);
    setModeState(resolvePreference(preference));
  };

  const value = useMemo(
    () => ({ themeMode, themePreference, setThemeMode, setThemePreference }),
    [themeMode, themePreference],
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(AppThemeContext);
  if (!context) throw new Error("useAppTheme must be used within an AppThemeProvider.");
  return context;
}

export default AppThemeProvider;
