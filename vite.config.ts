import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
    // Carica le variabili d'ambiente per la modalità corrente (development, production, etc.)
    const env = loadEnv(mode, process.cwd(), '');

    return {
        plugins: [
            react(),
            VitePWA({
                registerType: 'autoUpdate',
                includeAssets: ['vite.svg', 'robots.txt'],
                manifest: {
                    name: 'NexaBudget',
                    short_name: 'NexaBudget',
                    description: 'Gestisci le tue finanze personali con facilità',
                    theme_color: '#1890ff',
                    background_color: '#ffffff',
                    display: 'standalone',
                    scope: '/',
                    start_url: '/',
                    orientation: 'portrait',
                    icons: [
                        {
                            src: '/pwa-192x192.png',
                            sizes: '192x192',
                            type: 'image/png',
                            purpose: 'any'
                        },
                        {
                            src: '/pwa-512x512.png',
                            sizes: '512x512',
                            type: 'image/png',
                            purpose: 'any'
                        },
                        {
                            src: '/pwa-maskable-192x192.png',
                            sizes: '192x192',
                            type: 'image/png',
                            purpose: 'maskable'
                        },
                        {
                            src: '/pwa-maskable-512x512.png',
                            sizes: '512x512',
                            type: 'image/png',
                            purpose: 'maskable'
                        }
                    ]
                },
                workbox: {
                    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
                    runtimeCaching: [
                        {
                            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                            handler: 'CacheFirst',
                            options: {
                                cacheName: 'google-fonts-cache',
                                expiration: {
                                    maxEntries: 10,
                                    maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
                                },
                                cacheableResponse: {
                                    statuses: [0, 200]
                                }
                            }
                        }
                    ]
                },
                devOptions: {
                    enabled: false
                }
            })
        ],
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
