// Semantic colors
export const COLOR_POSITIVE = '#3f8600';
export const COLOR_NEGATIVE = '#cf1322';
export const COLOR_ACCENT = '#1890ff';
export const COLOR_WARNING = '#faad14';

// Sider (dark) text colors — shared across AppSider so future theming has one source
export const SIDER_TEXT_PRIMARY = 'rgba(255, 255, 255, 0.85)';
export const SIDER_TEXT_SECONDARY = 'rgba(255, 255, 255, 0.65)';
export const SIDER_BG = '#001529';

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
