const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true);

export const haptic = (pattern: number | number[] = 10) => {
    if (isStandalone() && navigator.vibrate) {
        navigator.vibrate(pattern);
    }
};
