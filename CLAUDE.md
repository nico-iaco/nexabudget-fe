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

- **AuthContext** (`src/contexts/AuthContext.tsx`) — JWT token stored in localStorage; injected via Axios interceptor in `src/services/api.ts`; 403 response triggers auto-logout (401 is currently *not* handled by the interceptor)
- **PreferencesContext** (`src/contexts/PreferencesContext.tsx`) — Theme (light/dark) and language (it/en), persisted to localStorage
- **API layer** (`src/services/api.ts`) — Single Axios instance, all endpoint functions live here; strongly typed against interfaces in `src/types/api.ts`
- **`@tanstack/react-query`** is the de-facto global server-state cache (`QueryClient` set up in `src/main.tsx`, `staleTime: 2min`, `refetchOnWindowFocus: true`; query keys centralized in `src/queryKeys.ts`). No Redux/Zustand. Accounts (`src/hooks/useAccounts.ts`) and categories (`src/hooks/useCategories.ts`) are fetched once via `useQuery` and shared app-wide through `Layout` → `Outlet` context — treat these as the single source of truth rather than re-fetching directly.
- **Known gap**: `src/pages/transactions/TransactionsPage.tsx` does *not* go through React Query — it fetches transactions imperatively into local state (`fetchTransactions`, `useState`/`useEffect`). This means `queryKeys.transactions()` invalidations fired elsewhere (e.g. `useAccountActions` after a transfer, `useAccountSync` after a GoCardless sync) don't actually refresh the transactions table — it stays stale until the user manually changes a filter or page. Migrating this page to `useQuery`/`useInfiniteQuery` would fix it.
- **Known gap**: `src/hooks/useDashboardData.ts` wraps every request in an internal `safe()` helper that does `.catch(() => fallback)` with no logging or user-facing error — a failed backend request currently renders identically to "no data yet" on the dashboard. The same silent-catch pattern exists in `TransactionsPage.tsx`'s fetch (`.catch(console.error)`, no `message.error`). Most other pages (Budgets, Crypto, Audit, Categories) correctly surface fetch errors via `message.error`; follow that pattern for new code, and prefer wiring these two spots up to it too when touched.

### Routing

App.tsx defines all routes. `PrivateRoute` guards authenticated pages; `RedirectIfAuth` redirects logged-in users away from auth pages.

### Layout

`src/components/Layout.tsx` is the master shell that renders `AppHeader` and `AppSider` from `src/components/layout/` and hosts the global CRUD modals (AccountModal, TransferModal, GoCardlessModal, BinanceKeysModal, CoinbaseKeysModal, ManualHoldingModal). It is no longer a god component — account/category state and actions have been extracted into dedicated hooks (`useAccounts`, `useCategories`, `useAccountActions`, `useAccountSync`, `useGoCardlessLink`, `useConfirm`); Layout itself mostly wires these together and passes data down via `Outlet` context (`src/types/outletContext.ts`). Note: `outletContext.transactionRefreshKey` is dead/deprecated (its setter is never called) — don't rely on it to trigger refreshes.

Destructive-action confirmations should go through `useConfirm()` (documented convention in `src/hooks/useConfirm.ts`); use inline `Popconfirm` only for single-row actions. `src/components/AsyncBoundary.tsx` exists to standardize loading/error/empty states for `useQuery`-driven views — prefer it for new views, though most existing pages predate it.

### Key Integrations

- **GoCardless** — Bank account linking flow: user selects bank → redirected to GoCardless → callback at `/gocardless/callback` → polling for sync status
- **Binance / Coinbase** — Read-only API keys stored server-side; crypto holdings sync triggered from `CryptoPage`; manual holdings also supported via `ManualHoldingModal`
- **Budgets** — `src/pages/budgets/` supports per-category budgets with threshold alerts (`BudgetAlertsDrawer`) and templates (`BudgetTemplateModal`); no push notifications yet, alerts are only visible in-app
- **Chat / AI analysis** — `src/pages/chat/` (NexaBot) and `AiAnalysisCard` on the dashboard surface AI-generated insights over `/api/chat` endpoints
- **Audit log & Trash** — `src/pages/audit/` and `src/pages/trash/` expose an activity log and a soft-delete/restore flow
- **i18n** — `src/i18n/index.ts` contains all Italian & English translations (~300+ keys); language toggle in `SettingsPage`

### PWA

`vite-plugin-pwa` generates a service worker with Workbox. Icons are generated from source via `scripts/generate-icons.mjs` before every production build.

### Responsive Design

`src/hooks/useMediaQuery.ts` detects breakpoints. Mobile-specific overrides live in `src/mobile.css`. Ant Design's grid system is used throughout.

### Design Tokens

`src/theme/tokens.ts` defines the brand color, semantic colors (`COLOR_POSITIVE/NEGATIVE/ACCENT/WARNING`), and a `SPACING` scale, wired into the global `ConfigProvider` in `App.tsx` (`colorPrimary` + `borderRadius: 8`; no font-size or radius scale is defined yet). Adoption is currently thin — most spacing/font-size/border-radius/shadow values across the codebase are still inline magic numbers rather than references to these tokens. When touching styling, prefer importing from `theme/tokens.ts` (and extend it if a needed token is missing) over adding another hardcoded value.

Known duplication to be aware of when adding similar UI:
- Three different "stat card" implementations exist (`DashboardPage.tsx`, `BalanceTrendSection.tsx`, `PortfolioSummary.tsx`) with no shared `StatCard` component — don't add a fourth variant; reuse or extract one instead.
- Empty states are inconsistent: `src/components/EmptyState.tsx` (with CTA buttons) is the preferred component, but many charts/tables still render a bare Ant Design `<Empty>` — prefer `EmptyState` for new empty states.
- Chart components (`DashboardCharts.tsx`, `TrendDualChart.tsx`, `DashboardChartsMobile.tsx`, `BalanceTrendChart.tsx`) mix manual `isDark ? '#fff' : '#000'` branching with proper `theme.useToken()` usage — prefer `theme.useToken()` (`token.colorText`, `token.colorBgContainer`) for any new dark/light-aware styling.
- Modal components are split across three locations with no single rule: `src/components/modals/`, loose `*Modal.tsx` files directly under `src/components/`, and feature-colocated modals under `src/pages/**/`. Follow whichever convention the nearest existing feature uses; there is no `components/common/`/`ui/` folder yet for generic primitives.
