# Progressive Web Application (PWA)

NexaBudget Frontend is built as a Progressive Web App (PWA), offering users a native-app-like experience. It can be installed directly onto iOS, Android, and Desktop platforms, providing offline support, custom application shell caching, and tactile feedback.

---

## 🛠️ PWA Configuration

The PWA capabilities are powered by `vite-plugin-pwa` in `vite.config.ts`, using `registerType: 'autoUpdate'`. It generates a service worker using Google's **Workbox** library.

### 1. Web App Manifest

The manifest defines how the operating system handles the application once installed:

* **Theme Color**: `#1f7dcf` (the brand primary; `index.html` additionally declares its own `theme-color` meta for the browser chrome).
* **Display Mode**: `standalone` (removes standard browser navigational address bars and controls).
* **Orientation**: Forced to `portrait` for a native mobile feel.
* **Scopes & Start URL**: `/` starts at the application root.
* **Icons**: four entries — 192px and 512px in both `any` and `maskable` purposes (see *Automated Icon Generation* below).

### 2. Caching Strategies & Workbox

Workbox caches static assets and sets up runtime interceptors for backend network requests:

* **Pre-caching**:
  * Files matching `**/*.{js,css,html,ico,png,svg,woff,woff2}` are automatically cached on first load, plus the explicitly included `vite.svg` and `robots.txt`.
  * `maximumFileSizeToCacheInBytes` is raised to `6MB` to accommodate vendor bundles.
  * `navigateFallback: '/index.html'` ensures single-page routing continues to work offline. The fallback is disabled (`navigateFallbackDenylist`) for `/api/` and `/mcp` requests and for `public/offline.html`, so backend calls are never answered with the app shell.

* **Runtime Caching Rules**:
  * **Backend API** (`/api/.*`): Uses the `NetworkFirst` caching strategy. Requests are sent over the network, falling back to cache if the server is unreachable or responds slowly (timeout is `3 seconds`). Cache TTL is set to `5 minutes` with a maximum limit of `50 entries`. Keep this in mind when debugging apparently stale data in an installed build: a response can be served from this cache.
  * **Static Media/Images**: Uses the `CacheFirst` strategy. Once images are loaded once, they are fetched directly from cache to save mobile data. Cache TTL is set to `30 days` with a maximum limit of `60 entries`.

The service worker is disabled in development (`devOptions.enabled: false`), so PWA behaviour must be verified against `npm run build` + `npm run preview`, or a Docker build.

---

## 🔄 Service Worker Lifecycle & Hot Updates

NexaBudget handles service worker updates gracefully without interrupting the user. This is configured in `src/pwaRegister.ts` and `src/components/Layout.tsx`:

1. **Registration**: When the page loads, `main.tsx` invokes `registerPWA()`, registering the worker in the background.
2. **Detection**: If a new version of the frontend is compiled and deployed, the service worker detects the updated assets on the server.
3. **Event Dispatch**: The `onNeedRefresh()` hook catches the update and fires a browser-wide custom event:
    `window.dispatchEvent(new CustomEvent('pwa-update-available'));`
4. **UI Notification Banner**:
    Inside the application shell (`Layout.tsx`), a React `useEffect` hook listens for the event and renders a non-intrusive Ant Design notification box:
    * Displays "Update Available" text.
    * Provides an "Update Now" action button.
    * The notification has `duration: 0`, so it stays until the user acts on it.
5. **Activation**: Clicking the button calls `applyPWAUpdate()`, which activates the waiting service worker and reloads the page to flush old cached bundles and load the fresh assets.

Decoupling the two sides through a window event is deliberate: `pwaRegister.ts` runs before React mounts, so it cannot render UI itself.

---

## 📲 Install Prompt

`src/components/PWAInstallPrompt.tsx`, mounted in the shell, captures the browser's `beforeinstallprompt` event and replaces the default browser affordance with an in-app card offering installation. A dismissal is remembered in `localStorage` under `pwa-install-dismissed`, so the invitation is not shown again. Platforms that do not fire the event (notably iOS Safari) fall back to the manual "Add to Home Screen" flow documented in the README.

---

## 🎨 Automated Icon Generation

To compile the correct format icons required by platforms (Android, iOS, Desktop), NexaBudget uses a custom build-step script `scripts/generate-icons.mjs` using the `sharp` image manipulation package.

The script runs before every production build and generates assets from a single SVG vector source (`scripts/icon-source.svg`) into `public/`:

* **Standard Icons**: Flattens transparency over the gradient start background color (`#003a8c`) and outputs `pwa-192x192.png` and `pwa-512x512.png`.
* **Maskable Icons**: Android requires maskable icons (so the OS can clip the icon into circles, squircles, or squares). The script strips the SVG corner rounding (`rx="0"`) to generate full-bleed variants `pwa-maskable-192x192.png` and `pwa-maskable-512x512.png`.
* **Apple Touch Icons**: iOS handles home screen icons separately. The script outputs a specialized `apple-touch-icon-v2.png` (size `180x180`) from the full-bleed variant with a flattened alpha channel, since iOS applies its own rounding mask. The filename is versioned to bypass aggressive Apple device icon caching.
* **Favicon**: A standard `favicon-32x32.png` is generated for browser tabs.

---

## 📳 Haptic Feedback & Touch Gestures

To increase the native feel on mobile screens, NexaBudget includes a haptic feedback helper at `src/utils/haptic.ts`:

* **Constraint**: Standard web browser pages cannot trigger device vibrations to prevent abuse.
* **Trigger**: The utility tests if the app is currently running in standalone display mode (installed as an app) and if the host browser supports the `vibrate` API:

    ```typescript
    const isStandalone = () =>
        window.matchMedia('(display-mode: standalone)').matches ||
        ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true);
    ```

* **Feedback**: Action items call `haptic(10)` to emit a subtle 10-millisecond physical vibration, simulating physical button clicks.

The companion hook `src/hooks/usePullToRefresh.ts` implements pull-down-to-refresh: it walks up from the touch target to find the nearest scrollable container, only arms the gesture when that container is already at the top, and fires the refresh callback (with a haptic tick) past a 70px drag threshold. It is currently wired to the dashboard.
