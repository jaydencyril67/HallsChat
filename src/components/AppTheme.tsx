import React, { createContext, useContext, useEffect, useMemo } from "react";

export type AppThemeMode = "dark";
export type AppThemePreference = "dark";

type AppThemeContextValue = {
  themeMode: AppThemeMode;
  themePreference: AppThemePreference;
  setThemeMode: (mode: AppThemeMode) => void;
  setThemePreference: (preference: AppThemePreference) => void;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);
const keepDark = (_mode: AppThemeMode) => {
  document.documentElement.dataset.theme = "dark";
};
const keepDarkPreference = (_preference: AppThemePreference) => {
  document.documentElement.dataset.theme = "dark";
};

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    try {
      window.localStorage.setItem("hallschat-theme", "dark");
      window.localStorage.setItem("hallschat-theme-preference", "dark");
    } catch {
      // Theme stays dark even when browser storage is unavailable.
    }
    document.documentElement.dataset.theme = "dark";
    document.documentElement.style.colorScheme = "dark";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#210812");
  }, []);

  const value = useMemo(() => ({
    themeMode: "dark" as const,
    themePreference: "dark" as const,
    setThemeMode: keepDark,
    setThemePreference: keepDarkPreference,
  }), []);

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(AppThemeContext);
  if (!context) throw new Error("useAppTheme must be used within an AppThemeProvider.");
  return context;
}

export default AppThemeProvider;
