// Theme-aware brand primary (NexaBudget Redesign palette). Use the oklch
// strings for raw CSS (gradients, custom backgrounds) — the browser renders
// them natively. Use the _HEX variants for AntD's `colorPrimary` token:
// AntD derives hover/active/bg shades via a color library that doesn't parse
// oklch() and silently falls back to black, so the seed must be hex/rgb.
export const PRIMARY_LIGHT = 'oklch(58% 0.15 250)';
export const PRIMARY_DARK = 'oklch(70% 0.14 250)';
export const PRIMARY_LIGHT_HEX = '#1f7dcf';
export const PRIMARY_DARK_HEX = '#53a3f2';

// Theme-aware semantic palette (NexaBudget Redesign). Light/dark pairs —
// pick the one matching the active PreferencesContext theme.
export const SEMANTIC = {
    positive: { light: 'oklch(45% 0.15 155)', dark: 'oklch(75% 0.15 155)' },
    negative: { light: 'oklch(55% 0.19 25)', dark: 'oklch(68% 0.18 25)' },
    warning: { light: 'oklch(60% 0.14 55)', dark: 'oklch(65% 0.14 55)' },
} as const;

/** Pick the semantic color set matching the active PreferencesContext theme. */
export const getSemanticColors = (isDark: boolean) => ({
    positive: isDark ? SEMANTIC.positive.dark : SEMANTIC.positive.light,
    negative: isDark ? SEMANTIC.negative.dark : SEMANTIC.negative.light,
    warning: isDark ? SEMANTIC.warning.dark : SEMANTIC.warning.light,
});

// Brand gradients (logo mark, balance/KPI panels).
export const GRADIENT_BRAND = `linear-gradient(135deg, ${PRIMARY_LIGHT}, oklch(66% 0.15 200))`;
export const GRADIENT_BRAND_DARK = `linear-gradient(135deg, ${PRIMARY_DARK}, oklch(75% 0.13 200))`;
export const GRADIENT_BALANCE = `linear-gradient(135deg, ${PRIMARY_LIGHT}, oklch(52% 0.16 270))`;
export const GRADIENT_BALANCE_DARK = 'linear-gradient(135deg, oklch(45% 0.13 255), oklch(38% 0.14 270))';

// Auth pages (Login/Register) full-bleed backdrop.
export const AUTH_BG_LIGHT = 'linear-gradient(160deg, oklch(97% 0.015 250), #eef0f3)';
export const AUTH_BG_DARK = 'linear-gradient(160deg, oklch(18% 0.012 260), oklch(14% 0.01 260))';

// Typography — heading/number face vs. body face (NexaBudget Redesign).
export const FONT_HEADING = "'Manrope', system-ui, sans-serif";
export const FONT_BODY = "'Inter', system-ui, sans-serif";

// Sider dark-mode text colours (always-dark sidebar variant).
export const SIDER_TEXT_PRIMARY = 'rgba(255, 255, 255, 0.85)';
export const SIDER_TEXT_SECONDARY = 'rgba(255, 255, 255, 0.65)';

// Dark-mode shell surfaces (NexaBudget Redesign — replaces the navy SIDER_BG).
export const SURFACE_DARK = 'oklch(19% 0.012 260)';
export const SURFACE_DARK_BORDER = 'oklch(26% 0.012 260)';

// Bar-chart series keys — kept as stable identifiers so colour-mapping
// doesn't depend on translated label strings.
export const SERIES_INCOME = 'IN';
export const SERIES_EXPENSE = 'OUT';

// Spacing scale (px). Use these instead of hardcoded values for consistent rhythm.
export const SPACING = {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
} as const;

// Page-level spacing helpers
export const PAGE_HEADER_MARGIN_BOTTOM = SPACING.md;
export const SECTION_GAP = SPACING.md;

// Font-size scale (px). Use instead of hardcoded numeric/string font sizes.
export const FONT_SIZE = {
    xxs: 10,
    xs: 11,
    sm: 12,
    md: 13,
    base: 14,
    lg: 15,
    xl: 16,
    xxl: 18,
    xxxl: 20,
    display: 24,
} as const;

// Border-radius scale (px), for radii that deviate from the global
// ConfigProvider `borderRadius` (see RADIUS_BASE below).
export const RADIUS_BASE = 8;
export const RADIUS = {
    xs: 2,
    sm: 4,
    md: 6,
    lg: RADIUS_BASE,
    card: 14,
    panel: 16,
    pill: 100,
} as const;

// Named box-shadows, deduplicated from copy-pasted inline strings.
export const SHADOW = {
    card: '0 4px 12px rgba(0,0,0,0.08)',
    floating: '0 4px 12px rgba(0,0,0,0.15)',
    header: '0 2px 8px rgba(0,0,0,0.1)',
    bottomNav: '0 -2px 8px rgba(0,0,0,0.08)',
    tooltip: '0 3px 6px -4px rgba(0,0,0,0.32), 0 6px 16px 0 rgba(0,0,0,0.16)',
    elevated: '0 6px 24px rgba(0,0,0,0.18)',
} as const;
