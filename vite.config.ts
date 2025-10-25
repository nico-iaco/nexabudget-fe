import {defineConfig, loadEnv} from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({mode}) => {
    // Carica le variabili d'ambiente per la modalità corrente (development, production, etc.)
    const env = loadEnv(mode, process.cwd(), '');

    return {
        plugins: [react()],
        server: {
            proxy: {
                '/api': {
                    // Usa la variabile d'ambiente VITE_API_BASE_URL come target
                    // Fornisci un fallback se la variabile non è definita durante la build della config
                    target: env.VITE_BE_BASE_URL || 'http://localhost:8080', // Sostituisci con un default sensato se necessario
                    changeOrigin: true, // Necessario per i virtual host
                    secure: false,      // Imposta a false se il tuo backend usa un certificato self-signed
                    //rewrite: (path) => path.replace(/^\/api/, ''), // Rimuove /api dal percorso prima di inviare la richiesta al backend
                },

            }
        }
    }
})
