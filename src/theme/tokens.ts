// Brand / primary colour — used as ConfigProvider seed and for chart accents.
// Change this single value to re-skin the whole app.
export const BRAND_PRIMARY = '#1677ff';

// Semantic colors (used in charts and contexts where theme tokens aren't available)
export const COLOR_POSITIVE = '#3f8600';
export const COLOR_NEGATIVE = '#cf1322';
export const COLOR_ACCENT = '#1677ff';
export const COLOR_WARNING = '#faad14';

// Sider dark-mode text colours (always-dark sidebar variant).
export const SIDER_TEXT_PRIMARY = 'rgba(255, 255, 255, 0.85)';
export const SIDER_TEXT_SECONDARY = 'rgba(255, 255, 255, 0.65)';
export const SIDER_BG = '#001529';

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
