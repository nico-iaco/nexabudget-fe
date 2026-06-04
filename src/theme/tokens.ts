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
} as const;

// Page-level spacing helpers
export const PAGE_HEADER_MARGIN_BOTTOM = SPACING.md;
export const SECTION_GAP = SPACING.md;
