# Progressive Web Application (PWA)

NexaBudget Frontend is built as a Progressive Web App (PWA), offering users a native-app-like experience. It can be installed directly onto iOS, Android, and Desktop platforms, providing offline support, custom application shell caching, and tactile feedback.

---

## 🛠️ PWA Configuration

The PWA capabilities are powered by `vite-plugin-pwa` in [vite.config.ts](file:///Users/nicolaiacovelli/WebstormProjects/nexabudget-fe/vite.config.ts). It generates a service worker using Google's **Workbox** library.

### 1. Web App Manifest

The manifest defines how the operating system handles the application once installed:

* **Theme Color**: `#1890ff` (Primary Brand Blue).
* **Display Mode**: `standalone` (removes standard browser navigational address bars and controls).
* **Orientation**: Forced to `portrait` for a native mobile feel.
* **Scopes & Start URL**: `/` starts at the application root.

### 2. Caching Strategies & Workbox

Workbox caches static assets and sets up runtime interceptors for backend network requests:

* **Pre-caching**:
  * Files matching `**/*.{js,css,html,ico,png,svg,woff,woff2}` are automatically cached on first load.
  * `maximumFileSizeToCacheInBytes` is raised to `6MB` to accommodate vendor bundles.
  * `navigateFallback: '/index.html'` ensures single-page routing continues to work offline (except for `/api/` routes).

* **Runtime Caching Rules**:
  * **Backend API** (`/api/.*`): Uses the `NetworkFirst` caching strategy. Requests are sent over the network, falling back to cache if the server is unreachable or responds slowly (timeout is `3 seconds`). Cache TTL is set to `5 minutes` with a maximum limit of `50 entries`.
  * **Static Media/Images**: Uses the `CacheFirst` strategy. Once images are loaded once, they are fetched directly from cache to save mobile data. Cache TTL is set to `30 days` with a maximum limit of `60 entries`.

---

## 🔄 Service Worker Lifecycle & Hot Updates

NexaBudget handles service worker updates gracefully without interrupting the user. This is configured in [src/pwaRegister.ts](file:///Users/nicolaiacovelli/WebstormProjects/nexabudget-fe/src/pwaRegister.ts) and [src/components/Layout.tsx](file:///Users/nicolaiacovelli/WebstormProjects/nexabudget-fe/src/components/Layout.tsx):

1. **Registration**: When the page loads, `main.tsx` invokes `registerPWA()`, registering the worker in the background.
2. **Detection**: If a new version of the frontend is compiled and deployed, the service worker detects the updated assets on the server.
3. **Event Dispatch**: The `onNeedRefresh()` hook catches the update and fires a browser-wide custom event:
    `window.dispatchEvent(new CustomEvent('pwa-update-available'));`
4. **UI Notification Banner**:
    Inside the main application shell (`Layout.tsx`), a React `useEffect` hook listens for the event and renders a non-intrusive Ant Design notification box:
    * Displays "Update Available" text.
    * Provides an "Update Now" action button.
5. **Activation**: Clicking the button calls `applyPWAUpdate()`, calling the service worker's activation routine and triggering a browser reload to flush old cached bundles and load the fresh assets.

---

## 🎨 Automated Icon Generation

To compile the correct format icons required by platforms (Android, iOS, Desktop), NexaBudget uses a custom build-step script [scripts/generate-icons.mjs](file:///Users/nicolaiacovelli/WebstormProjects/nexabudget-fe/scripts/generate-icons.mjs) using the `sharp` image manipulation package.

The script runs before every production build and generates assets from a single SVG vector source (`scripts/icon-source.svg`):

* **Standard Icons**: Flattens transparency over the start gradient background color (`#003a8c`) and outputs `pwa-192x192.png` and `pwa-512x512.png`.
* **Maskable Icons**: Android requires maskable icons (so the OS can clip the icon into circles, squircles, or squares). The script strips the SVG corner rounding (`rx="0"`) to generate full-bleed variants `pwa-maskable-192x192.png` and `pwa-maskable-512x512.png`.
* **Apple Touch Icons**: iOS handles home screen icons separately. The script outputs a specialized `apple-touch-icon-v2.png` (size `180x180`) with flattened alpha channels. The filename is versioned to bypass aggressive Apple device icon caching.
* **Favicon**: A standard `favicon-32x32.png` is generated for browser tabs.

---

## 📳 Haptic Feedback

To increase the native feel on mobile screens, NexaBudget includes a haptic feedback helper at [src/utils/haptic.ts](file:///Users/nicolaiacovelli/WebstormProjects/nexabudget-fe/src/utils/haptic.ts):

* **Constraint**: Standard web browser pages cannot trigger device vibrations to prevent abuse.
* **Trigger**: The utility tests if the app is currently running in standalone display mode (installed as an app) and if the host browser supports the `vibrate` API:

    ```typescript
    const isStandalone = () =>
        window.matchMedia('(display-mode: standalone)').matches ||
        ('standalone' in navigator && (navigator as any).standalone === true);
    ```

* **Feedback**: Action items (like submitting transactions, opening drawers, or tab navigation) call `haptic(10)` to emit a subtle 10-millisecond physical vibration, simulating physical button clicks.
