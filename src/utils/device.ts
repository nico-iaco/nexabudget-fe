// Rilevamento del dispositivo, valutato una volta al mount (lazy useState).

// iOS (Safari, Chrome iOS, PWA) oppure qualsiasi dispositivo con puntatore "coarse".
// iPadOS 13+ si identifica come MacIntel con touch points multipli e, con trackpad
// collegato, può riportare pointer:fine: per questo resta il controllo esplicito.
export const detectIOS = (): boolean => {
    if (typeof navigator === 'undefined') return false;
    if (/iPad|iPhone|iPod/.test(navigator.userAgent)) return true;
    return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
};

export const detectNativeDatePicker = (): boolean =>
    detectIOS() || (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches);
