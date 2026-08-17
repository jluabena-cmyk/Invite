/**
 * Semantic design tokens — Warm Social / Style D (Full Bleed) palette.
 *
 * Primary:  Terracotta  #C2410C
 * Accent:   Warm Violet #7C3AED
 * Bg:       Cream       #FAF5EF
 * Text:     Stone       #1C1917
 */

const colors = {
  light: {
    // Legacy aliases
    text: "#1C1917",
    tint: "#C2410C",

    // Core surfaces
    background: "#FAF5EF",
    foreground: "#1C1917",

    // Cards / elevated surfaces
    card: "#FFFFFF",
    cardForeground: "#1C1917",

    // Primary action color (buttons, links, active states)
    primary: "#C2410C",
    primaryForeground: "#ffffff",

    // Secondary / less-emphasis interactive surfaces
    secondary: "#F5F0EB",
    secondaryForeground: "#1C1917",

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: "#F5F0EB",
    mutedForeground: "#78716C",

    // Accent highlights (badges, selected items, focus rings)
    accent: "#7C3AED",
    accentForeground: "#ffffff",

    // Destructive actions (delete, error states)
    destructive: "#DC2626",
    destructiveForeground: "#ffffff",

    // Warning / caution states (retry failures, amber alerts)
    warning: "#D97706",
    warningForeground: "#ffffff",

    // Success states
    success: "#16A34A",
    successForeground: "#ffffff",

    // Coral / warm accent (cancelled, owed states)
    coral: "#F97316",
    coralForeground: "#ffffff",

    // Borders and input outlines
    border: "#F0EAE2",
    input: "#F0EAE2",
  },

  // Border radius (in px)
  radius: 12,
};

export default colors;
