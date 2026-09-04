// src/hooks/useMediaQuery.ts
import { useState, useEffect } from 'react';

export const useMediaQuery = (query: string): boolean => {
    // Initializer lazy: scritto come `useState(window.matchMedia(query).matches)`
    // l'espressione veniva valutata a OGNI render, non solo al mount. Con 13 file che
    // usano questo hook (alcuni due volte, via useBreakpoints) erano ~8 chiamate
    // sincrone a matchMedia — una API di risoluzione di stile — per ogni passaggio
    // di render dell'albero.
    const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

    useEffect(() => {
        const media = window.matchMedia(query);
        const listener = () => setMatches(media.matches);

        // Deprecated `addListener` for backward compatibility
        if (media.addEventListener) {
            media.addEventListener('change', listener);
        } else {
            media.addListener(listener);
        }

        return () => {
            if (media.removeEventListener) {
                media.removeEventListener('change', listener);
            } else {
                media.removeListener(listener);
            }
        };
    }, [query]);

    return matches;
};
