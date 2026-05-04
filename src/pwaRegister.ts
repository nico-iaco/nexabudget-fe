import { registerSW } from 'virtual:pwa-register';

let _updateSW: ((reloadPage?: boolean) => void) | undefined;

export const applyPWAUpdate = () => _updateSW?.(true);

export const registerPWA = () => {
    _updateSW = registerSW({
        onNeedRefresh() {
            window.dispatchEvent(new CustomEvent('pwa-update-available'));
        },
        onOfflineReady() {
            // App shell is cached — no UI needed
        },
    });
};
