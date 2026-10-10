// src/utils/redirect.ts
// Destinazione dopo il login (`from` nello state di navigazione o in `?from=`).

/**
 * Solo percorsi interni della stessa origine: un `from` arbitrario farebbe del login un
 * open redirect. `\` è rifiutato perché il browser lo normalizza in `/` ("/\evil.com" →
 * "//evil.com"); il confronto finale sull'origine copre gli altri casi.
 */
export const safeRedirect = (from: unknown): string => {
    if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//') || from.includes('\\')) return '/';
    if (from.startsWith('/login') || from.startsWith('/register')) return '/';
    try {
        const url = new URL(from, window.location.origin);
        return url.origin === window.location.origin ? url.pathname + url.search + url.hash : '/';
    } catch {
        return '/';
    }
};
