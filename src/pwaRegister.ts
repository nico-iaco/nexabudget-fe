import { registerSW } from 'virtual:pwa-register';

let _updateSW: ((reloadPage?: boolean) => void) | undefined;
let _reloadDeferred = false;

// Route di ritorno dai provider bancari: portano in URL parametri monouso (es. il `code` di
// Enable Banking). Con registerType 'autoUpdate' il plugin ricarica la pagina appena il nuovo
// service worker si attiva — tipicamente alla prima visita dopo un deploy — e il reload
// ripostava lo stesso code al backend, che lo rifiutava.
const isBankCallbackPath = (pathname: string) =>
    pathname.startsWith('/banking/') || pathname.startsWith('/gocardless/callback/');

export const applyPWAUpdate = () => {
    if (_reloadDeferred) {
        window.location.reload();
        return;
    }
    _updateSW?.(true);
};

export const registerPWA = () => {
    _updateSW = registerSW({
        onNeedRefresh() {
            window.dispatchEvent(new CustomEvent('pwa-update-available'));
        },
        onNeedReload() {
            if (!isBankCallbackPath(window.location.pathname)) {
                window.location.reload();
                return;
            }
            // Sulle callback bancarie il reload viene rimandato: l'utente lo applica dalla
            // notifica di aggiornamento quando ha finito il collegamento.
            _reloadDeferred = true;
            window.dispatchEvent(new CustomEvent('pwa-update-available'));
        },
        onOfflineReady() {
            // App shell is cached — no UI needed
        },
    });
};
