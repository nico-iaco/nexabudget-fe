// src/pwaRegister.ts
import {registerSW} from 'virtual:pwa-register';

export const registerPWA = () => {
    const updateSW = registerSW({
        onNeedRefresh() {
            if (confirm('Nuova versione disponibile. Vuoi ricaricare?')) {
                updateSW(true);
            }
        },
        onOfflineReady() {
            console.log('App pronta per l\'uso offline');
        },
    });
};

