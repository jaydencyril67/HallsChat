import React from "react";

export type HybridThemeMode = "light" | "dark";

export type HybridThemeToken = {
  mode: HybridThemeMode;
  name: string;
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  surfaceGlass: string;
  surfaceShine: string;
  border: string;
  borderStrong: string;
  borderGlass: string;
  text: string;
  textMuted: string;
  textInverse: string;
  primary: string;
  primarySoft: string;
  highlight: string;
  highlightSoft: string;
  success: string;
  warning: string;
  danger: string;
};

export const HYBRID_THEME_TOKENS: Record<HybridThemeMode, HybridThemeToken> = {
  light: {
    mode: "light",
    name: "Light",
    background: "#f8f3f1",
    surface: "#fffdfc",
    surfaceElevated: "#ffffff",
    surfaceMuted: "#f1e7e5",
    surfaceGlass: "rgba(255,253,252,0.82)",
    surfaceShine: "rgba(255,255,255,0.56)",
    border: "rgba(83,31,42,0.13)",
    borderStrong: "rgba(83,31,42,0.24)",
    borderGlass: "rgba(83,31,42,0.15)",
    text: "#32151d",
    textMuted: "#795c63",
    textInverse: "#ffffff",
    primary: "#a91f35",
    primarySoft: "rgba(169,31,53,0.10)",
    highlight: "rgba(169,31,53,0.06)",
    highlightSoft: "rgba(169,31,53,0.035)",
    success: "#168454",
    warning: "#8b570b",
    danger: "#b4233b",
  },
  dark: {
    mode: "dark",
    name: "Dark",
    background: "#19070b",
    surface: "#21090f",
    surfaceElevated: "#2b0d15",
    surfaceMuted: "#261017",
    surfaceGlass: "rgba(43,13,21,0.78)",
    surfaceShine: "rgba(255,255,255,0.035)",
    border: "rgba(255,229,232,0.09)",
    borderStrong: "rgba(255,229,232,0.18)",
    borderGlass: "rgba(255,210,219,0.13)",
    text: "#f8f0f1",
    textMuted: "#a78b91",
    textInverse: "#ffffff",
    primary: "#b82032",
    primarySoft: "rgba(184,32,50,0.20)",
    highlight: "rgba(202,49,73,0.10)",
    highlightSoft: "rgba(202,49,73,0.055)",
    success: "#42c88a",
    warning: "#f2bd69",
    danger: "#ff7185",
  },
};

export const createHybridCardStyles = (theme: HybridThemeToken) => ({
  card: {
    boxSizing: "border-box" as const,
    padding: "18px",
    borderRadius: "20px",
    border: `1px solid ${theme.borderGlass}`,
    background: theme.surfaceGlass,
    color: theme.text,
    backdropFilter: "blur(22px) saturate(1.12)",
    WebkitBackdropFilter: "blur(22px) saturate(1.12)",
  },
  cardMobile: {
    padding: "14px",
    borderRadius: "16px",
  },
  panel: {
    boxSizing: "border-box" as const,
    padding: "15px 16px",
    borderRadius: "16px",
    border: `1px solid ${theme.borderGlass}`,
    background: theme.surfaceMuted,
    color: theme.text,
  },
});

export const HYBRID_CARD_STYLES = createHybridCardStyles(HYBRID_THEME_TOKENS.dark);

type HybridThemeProps = {
  mode?: HybridThemeMode;
  children?: React.ReactNode;
  className?: string;
};

/**
 * Shared theme wrapper, intentionally not mounted around app pages yet.
 * Pages can opt in individually when we begin the page-by-page migration.
 */
export default function HybridTheme({ mode = "dark", children, className }: HybridThemeProps) {
  const theme = HYBRID_THEME_TOKENS[mode];

  return (
    <div
      className={className}
      data-theme={theme.mode}
      data-theme-name={theme.name}
      style={{
        minHeight: "100%",
        background: theme.background,
        color: theme.text,
        transition: "background-color 180ms ease, color 180ms ease",
      }}
    >
      {children}
    </div>
  );
}
