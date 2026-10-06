import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { visualizer } from 'rollup-plugin-visualizer'

// Il report del bundle si genera SOLO con `npm run analyze` (che imposta ANALYZE=true)
// e finisce fuori da `dist/`: prima veniva scritto a ogni build dentro l'output, dove
// pesava 2,1 MB, entrava nel precache del service worker (globPatterns include **/*.html)
// ed esponeva pubblicamente l'intero module graph dell'app.
const ANALYZE = process.env.ANALYZE === 'true';

// La compressione è a carico di Nginx (`gzip on` in nginx.conf.template).
// I due `vite-plugin-compression` che stavano qui producevano 68 file .br non servibili
// (nginx:alpine non include ngx_brotli) e zero file .gz (conflitto fra le due istanze).

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
    // Carica le variabili d'ambiente per la modalità corrente (development, production, etc.)
    const env = loadEnv(mode, process.cwd(), '');

    return {
        plugins: [
            react(),
            ...(ANALYZE
                ? [visualizer({ open: false, filename: '.stats/stats.html', gzipSize: true, brotliSize: true })]
                : []),
            VitePWA({
                registerType: 'autoUpdate',
                includeAssets: ['vite.svg', 'robots.txt'],
                manifest: {
                    name: 'NexaBudget',
                    short_name: 'NexaBudget',
                    description: 'Gestisci le tue finanze personali con facilità',
                    theme_color: '#1f7dcf',
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
                    // Report del bundle: non deve nemmeno esistere in dist (vedi ANALYZE sopra),
                    // ma lo escludiamo comunque per sicurezza.
                    globIgnores: ['stats.html'],
                    // TUTTI i chunk JS vanno nel precache, anche quelli di route e componenti
                    // lazy. Erano esclusi (servivano "al primo uso" via runtime cache) quando
                    // pesavano MB per colpa di G2; oggi sono ~270 kB non compressi. Escluderli
                    // rompeva la PWA a ogni deploy: il vecchio service worker serve ancora il
                    // vecchio index.html, che importa `DashboardPage-<hashVecchio>.js`; se quel
                    // chunk non era già in runtime cache la richiesta andava in rete, dove il
                    // nuovo container non lo ha più → 404 → "Importing a module script failed".
                    // Con il precache completo ogni versione resta autoconsistente finché il
                    // nuovo SW non prende il controllo e ricarica la pagina.
                    navigateFallback: '/index.html',
                    navigateFallbackDenylist: [/^\/api\//, /^\/mcp/, /^\/offline\.html$/],
                    runtimeCaching: [
                        {
                            // Liste transazioni paginate: MAI in cache. La query string
                            // contiene il testo di ricerca, quindi generava una voce di
                            // cache per battitura: con maxEntries: 50 una sola sessione di
                            // ricerca sfrattava ogni altra voce API, azzerando il fallback
                            // offline di account e dashboard. Questa regola precede quella
                            // generica: Workbox applica la prima che combacia.
                            urlPattern: /\/api\/transactions\/(?:account\/[^/]+\/)?paged/i,
                            handler: 'NetworkOnly',
                        },
                        {
                            // Altre chiamate API: rete prima, cache come fallback.
                            // networkTimeoutSeconds era 3: qualunque GET più lenta di 3 s
                            // veniva abbandonata a favore di una copia fino a 5 minuti
                            // vecchia, mentre React Query credeva di aver appena letto dati
                            // freschi — due nozioni di freschezza in conflitto. 10 s
                            // interviene solo quando la rete è davvero ferma, e la TTL è
                            // allineata allo staleTime di React Query (2 min).
                            urlPattern: /\/api\/.*/i,
                            handler: 'NetworkFirst',
                            options: {
                                cacheName: 'api-cache',
                                networkTimeoutSeconds: 10,
                                expiration: {
                                    maxEntries: 100,
                                    maxAgeSeconds: 2 * 60,
                                },
                                // statuses: [0] cacherebbe risposte opaque, potenzialmente
                                // inutilizzabili, bloccandole in cache.
                                cacheableResponse: { statuses: [200] },
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
            // Target esplicito invece del default implicito di Vite.
            target: 'baseline-widely-available',
            modulePreload: {
                // DashboardPage sceglie a runtime fra due moduli grafici mutuamente
                // esclusivi (`_isMobileAtLoad ? import(mobile) : import(desktop)`), ma il
                // bundler emette un unico elenco di modulepreload per il chunk, che li
                // contiene entrambi: su mobile veniva scaricato anche il modulo desktop, mai
                // eseguito (quando conteneva G2 erano 1,26 MB; oggi sono pochi kB, ma resta
                // inutile). Toglierli dal preload non impedisce il caricamento del ramo che
                // serve davvero: quello passa dall'import() normale.
                resolveDependencies: (_url, deps) =>
                    deps.filter(d => !/\/(DashboardCharts|DashboardChartsMobile)-[^/]*\.js$/.test(d)),
            },
            // Prima era 1500, cioè giusto sopra il chunk da 1232 kB: la soglia esisteva
            // ma non poteva scattare. 600 kB è abbastanza basso per fare rumore.
            chunkSizeWarningLimit: 600,
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
                            // NON raggruppare antd in un vendor chunk unico.
                            // Provato e misurato: accorpandoli il percorso critico eager passa
                            // da 1359 kB a 2868 kB, perché forzare moduli non correlati nello
                            // stesso chunk crea dipendenze circolari fra chunk e basta un solo
                            // modulo del gruppo raggiungibile dall'entry per rendere eager
                            // l'intero blocco — lo stack grafici, che era correttamente lazy,
                            // finiva in `modulepreload`. Inoltre impedirebbe di alleggerire il
                            // primo paint rendendo lazy i singoli componenti (i modali dello
                            // shell trascinano il DatePicker: se antd è un blocco unico, renderli
                            // lazy non toglie più nulla dal percorso critico).
                            // Lo splitting per componente di rolldown va lasciato fare.
                        }
                    },
                },
            },
        }
    }
})
