# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Vite dev server (with --host)
npm run build        # generate-icons + tsc -b + vite build
npm run lint         # ESLint on all TypeScript files
npm run preview      # Preview production build
```

No test suite is configured.

The backend API is proxied via Vite: `/api` → `VITE_BE_BASE_URL` (default `http://localhost:8080`). Set this in `.env.local`.

## Architecture

Personal finance management PWA built with **React 19**, **TypeScript 5.8**, **Vite 7**, **Ant Design 6**, and **React Router 7**.

### State & Data Flow

- **AuthContext** (`src/contexts/AuthContext.tsx`) — JWT token stored in localStorage; injected via Axios interceptor in `src/services/api.ts`; 403 response triggers auto-logout
- **PreferencesContext** (`src/contexts/PreferencesContext.tsx`) — Theme (light/dark) and language (it/en), persisted to localStorage
- **API layer** (`src/services/api.ts`) — Single Axios instance, all endpoint functions live here; strongly typed against interfaces in `src/types/api.ts`
- No global state library — complex data aggregation is done with `useMemo` inside custom hooks (`src/hooks/useDashboardData.ts`)

### Routing

App.tsx defines all routes. `PrivateRoute` guards authenticated pages; `RedirectIfAuth` redirects logged-in users away from auth pages.

### Layout

`src/components/Layout.tsx` is the master shell: owns account list state, category list state, and all global CRUD modals (AccountModal, TransferModal, GoCardlessModal, BinanceKeysModal, ManualHoldingModal). It renders `AppHeader` and `AppSider` from `src/components/layout/`.

### Key Integrations

- **GoCardless** — Bank account linking flow: user selects bank → redirected to GoCardless → callback at `/gocardless/callback` → polling for sync status
- **Binance** — Read-only API keys stored server-side; crypto holdings sync triggered from `CryptoPage`
- **i18n** — `src/i18n/index.ts` contains all Italian & English translations (~300+ keys); language toggle in `SettingsPage`

### PWA

`vite-plugin-pwa` generates a service worker with Workbox. Icons are generated from source via `scripts/generate-icons.mjs` before every production build.

### Responsive Design

`src/hooks/useMediaQuery.ts` detects breakpoints. Mobile-specific overrides live in `src/mobile.css`. Ant Design's grid system is used throughout.
