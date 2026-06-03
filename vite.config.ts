import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import viteCompression from 'vite-plugin-compression'
import { visualizer } from 'rollup-plugin-visualizer'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
    // Carica le variabili d'ambiente per la modalità corrente (development, production, etc.)
    const env = loadEnv(mode, process.cwd(), '');

    return {
        plugins: [
            react(),
            viteCompression({ algorithm: 'brotliCompress', ext: '.br' }),
            viteCompression({ algorithm: 'gzip', ext: '.gz' }),
            visualizer({ open: false, filename: 'dist/stats.html', gzipSize: true, brotliSize: true }),
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
                    maximumFileSizeToCacheInBytes: 6000000,
                    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
                    navigateFallback: '/index.html',
                    navigateFallbackDenylist: [/^\/api\//, /^\/mcp/, /^\/offline\.html$/],
                    runtimeCaching: [
                        {
                            // API calls: try network first, fall back to cache (5 min TTL)
                            urlPattern: /\/api\/.*/i,
                            handler: 'NetworkFirst',
                            options: {
                                cacheName: 'api-cache',
                                networkTimeoutSeconds: 3,
                                expiration: {
                                    maxEntries: 50,
                                    maxAgeSeconds: 5 * 60,
                                },
                                cacheableResponse: { statuses: [0, 200] },
                            },
                        },
                        {
                            // Static images and icons: cache first, 30 days
                            urlPattern: /\.(png|jpg|jpeg|svg|gif|webp|ico)(\?.*)?$/i,
                            handler: 'CacheFirst',
                            options: {
                                cacheName: 'static-images',
                                expiration: {
                                    maxEntries: 60,
                                    maxAgeSeconds: 30 * 24 * 60 * 60,
                                },
                                cacheableResponse: { statuses: [0, 200] },
                            },
                        },
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
                '/mcp': {
                    target: env.VITE_BE_BASE_URL || 'http://localhost:8080',
                    changeOrigin: true,
                    secure: false,
                },
            }
        },
        build: {
            chunkSizeWarningLimit: 1500,
            rollupOptions: {
                output: {
                    manualChunks(id) {
                        if (id.includes('/node_modules/')) {
                            if (
                                id.includes('/react/') ||
                                id.includes('/react-dom/') ||
                                id.includes('/react-router') ||
                                id.includes('/scheduler/')
                            ) {
                                return 'vendor-react';
                            }
                            if (id.includes('/i18next') || id.includes('/react-i18next')) {
                                return 'vendor-i18n';
                            }
                        }
                    },
                },
            },
        }
    }
})
