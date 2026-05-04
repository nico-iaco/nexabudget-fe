import { useEffect, useRef } from 'react';
import { haptic } from '../utils/haptic';

const THRESHOLD = 70;

const getScrollTop = (el: EventTarget | null): number => {
    let node = el as HTMLElement | null;
    while (node && node !== document.body) {
        const { overflow, overflowY } = window.getComputedStyle(node);
        if (overflow.includes('auto') || overflow.includes('scroll') ||
            overflowY.includes('auto') || overflowY.includes('scroll')) {
            return node.scrollTop;
        }
        node = node.parentElement;
    }
    return window.scrollY;
};

export const usePullToRefresh = (onRefresh: () => void, enabled = true) => {
    const onRefreshRef = useRef(onRefresh);
    useEffect(() => { onRefreshRef.current = onRefresh; });

    useEffect(() => {
        if (!enabled) return;

        let startY = 0;
        let canPull = false;

        const onTouchStart = (e: TouchEvent) => {
            canPull = getScrollTop(e.target) <= 1;
            if (canPull) startY = e.touches[0].clientY;
        };

        const onTouchEnd = (e: TouchEvent) => {
            if (!canPull) return;
            const dy = (e.changedTouches[0]?.clientY ?? startY) - startY;
            if (dy >= THRESHOLD) {
                onRefreshRef.current();
                haptic(15);
            }
            canPull = false;
            startY = 0;
        };

        document.addEventListener('touchstart', onTouchStart, { passive: true });
        document.addEventListener('touchend', onTouchEnd, { passive: true });

        return () => {
            document.removeEventListener('touchstart', onTouchStart);
            document.removeEventListener('touchend', onTouchEnd);
        };
    }, [enabled]);
};
