# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev            # Vite dev server (with --host, so it's reachable from a phone on the LAN)
npm run build          # generate-icons + tsc -b + vite build
npm run lint           # ESLint (flat config) over all .ts/.tsx
npm run preview        # Serve the production build
npm run analyze        # build + open dist/stats.html (rollup-plugin-visualizer bundle report)
npm run generate-icons # PWA icon generation via sharp (also run automatically by build)
```

No test suite is configured — there is no test runner, no test files, and no way to run a single test. Verification is `npm run lint` + `tsc -b` (via `npm run build`) + manual checks in the browser. Both currently pass: lint exits 0 with ~33 warnings.

**Lint policy** (`eslint.config.js`): the react-hooks preset must be pulled from `reactHooks.configs.flat['recommended-latest']` — the non-`flat` path is the eslintrc variant and ESLint 10 refuses to load it. Three rules from react-hooks 7 (React Compiler) are deliberately set to `warn` rather than `error`, each with the reason in a comment: `set-state-in-effect` (fires on the imperative fetch-on-mount pattern in 14 files; the real fix is the React Query migration below), `purity` (flags `Date.now()` inside an event handler as if it ran during render), `preserve-manual-memoization` (compiler bailout on a correct `useMemo`). Don't silence these per-line — either fix the pattern or leave the warning. `reportUnusedDisableDirectives` is on, so a stale `eslint-disable` is itself a warning.

The backend is reached through the Vite dev proxy: both `/api` **and** `/mcp` are proxied to `VITE_BE_BASE_URL` (default `http://localhost:8080`). Set it in `.env.local`. `/mcp` is proxied but currently unused by the frontend.

## Stack

React 19 · TypeScript 6.0 · Vite 8 · Ant Design 6 · React Router 7 · `@tanstack/react-query` 5 · Axios · i18next · Day.js · `@ant-design/charts`.

`tsconfig.app.json` is strict and adds `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, and `erasableSyntaxOnly` — unused imports/params and non-`type`-prefixed type imports are build errors, not warnings.

Note: comments and JSDoc across the codebase are written in **Italian**, and the default UI language is Italian. Match the surrounding language when editing a file.

## Architecture

Personal finance management PWA.

### State & data flow

- **AuthContext** (`src/contexts/AuthContext.tsx`) — holds the `AuthResponse`; mirrors the JWT into `localStorage` under `authToken` and the full object under `auth`.
- **Token injection & auto-logout** live in the Axios interceptors in `src/services/api.ts`, *not* in AuthContext: a **403** response clears both localStorage keys and hard-navigates to `/login` (skipped for `/auth/login` and `/auth/register`). **401 is not handled.** The request interceptor also strips `Content-Type` for `FormData` bodies so the browser sets the multipart boundary.
- **PreferencesContext** (`src/contexts/PreferencesContext.tsx`) — theme (`light`/`dark`), language (`it`/`en`), and a `server` settings blob, persisted as a single `preferences` JSON key in localStorage. Language changes call `i18n.changeLanguage()`; theme selects AntD's `defaultAlgorithm`/`darkAlgorithm` in `App.tsx`.
- **API layer** (`src/services/api.ts`) — one Axios instance (`baseURL: '/api'`) and ~79 thin endpoint functions, all typed against `src/types/api.ts`. Every new endpoint goes here; components never construct URLs.
- **`@tanstack/react-query` is the server-state cache** (`QueryClient` in `src/main.tsx`: `staleTime: 2min`, `refetchOnWindowFocus: true`, `retry: 1`). No Redux/Zustand. **Query keys are centralized in `src/queryKeys.ts`** — add keys there rather than inlining arrays, so `invalidateQueries` stays consistent.
- Accounts (`src/hooks/useAccounts.ts`) and categories (`src/hooks/useCategories.ts`) are fetched once in `Layout` and shared app-wide via `Outlet` context (`src/types/outletContext.ts`). Treat these as the single source of truth; don't re-fetch accounts/categories in a page.

**Known gap — TransactionsPage bypasses React Query.** `src/pages/transactions/TransactionsPage.tsx` fetches imperatively into `useState`/`useEffect` (`fetchTransactions`, kept in a `fetchTransactionsRef` to dodge stale closures). Consequences:
- `queryKeys.transactions()` invalidations fired elsewhere (e.g. `useAccountSync` on sync completion) **do not** refresh the table.
- `outletContext.transactionRefreshKey` is **dead**: `Layout` declares it as `useState(0)` with no setter, so the `useEffect` in TransactionsPage that depends on it never re-fires. Don't add new consumers; migrating this page to `useQuery`/`useInfiniteQuery` is the real fix.

Error handling for fetches: pages surface failures with `message.error` / `notification.error` (Budgets, Crypto, Audit, Categories, and `Layout`'s account/category error banners with a Retry button). `useDashboardData` collects per-request failures into a `partialErrors` array (logged + reported once), so a backend 500 is no longer indistinguishable from "no data". Follow that pattern — never `.catch(() => fallback)` silently.

### Routing

`src/App.tsx` holds the whole route table (`createBrowserRouter`). Every page is `React.lazy`-loaded and wrapped by the `LazyRoute` helper = `ErrorBoundary` (with `resetKeys={[location.pathname]}`, so navigating away clears the error) + `Suspense`. `PrivateRoute` guards authenticated pages; `RedirectIfAuth` bounces logged-in users off `/login` and `/register`. Add new pages as lazy imports inside `LazyRoute` to keep the shell alive on a render crash.

`ConfigProvider` in `App.tsx` also sets a `getPopupContainer` that mounts AntD popups inside the nearest `.ant-drawer-body`/`.ant-modal-body` — this is why Selects/DatePickers inside modals and drawers position correctly. Don't override it per-component.

### Layout shell

`src/components/Layout.tsx` is a thin composition shell: it renders `AppSider`, `AppHeader`, `BottomNavBar`, `PWAInstallPrompt`, and hosts only the three globally-triggerable modals (`AccountModal`, `TransferModal`, `BankLinkModal`). All business logic lives in dedicated hooks: `useAccounts`, `useCategories`, `useAccountActions` (account CRUD + transfer, via `useMutation`), `useAccountSync` (bank sync polling), `useBankLink` (bank-link wizard state machine), `useConfirm`. Crypto/API-key modals are *not* hosted here — they live in `CryptoPage` and `src/pages/settings/ApiKeysCard.tsx`.

Navigation items are defined once in `src/components/layout/navItems.ts` (`NAV_ITEMS`, with `showInBottomBar` selecting the mobile subset) and consumed by both `AppSider` and `BottomNavBar`. Add a route there, not in both components.

Destructive-action confirmations go through `useConfirm()` (documented convention in `src/hooks/useConfirm.ts`); inline `Popconfirm` is for single table-row actions only.

### Key integrations

- **Multi-provider bank linking (GoCardless + Enable Banking)** — the backend exposes a unified `/banking/{provider}` API; `provider` is the slug `'gocardless' | 'enable-banking'`, derived from `Account.provider` by `api.providerSlug()`. `useBankLink` drives a 3-step wizard (provider → country → bank) rendered by `BankLinkModal`, and skips step 0 when re-linking an account that already has a provider. Two distinct callback routes exist: `/gocardless/callback/:accountId` and `/banking/enable-banking/callback` (Enable Banking has a single static redirect URL and carries `?code=…&state=<localAccountId>` in the query string). Legacy GoCardless-only endpoints still exist in `api.ts` alongside the unified ones.
- **Bank sync polling** — `useAccountSync` polls `fetchAccounts` every 10s (skipping while `document.hidden`) with a 5-minute timeout whenever any account has `synchronizing = true`, then notifies and invalidates `queryKeys.transactions()`.
- **Binance / Coinbase** — read-only API keys stored server-side (`ApiKeysCard` in Settings); holdings sync triggered from `CryptoPage`; manual holdings via `ManualHoldingModal`.
- **Budgets** — `src/pages/budgets/`: per-category budgets, threshold alerts (`BudgetAlertsDrawer`), templates (`BudgetTemplateModal`). Alerts are in-app only, no push.
- **Chat / AI** — `src/pages/chat/` (NexaBot) and `AiAnalysisCard` on the dashboard, over `/api/chat*`. AI transaction categorization is a polled job started from `TransactionsPage`.
- **Audit log & Trash** — `src/pages/audit/` and `src/pages/trash/` for the activity log and soft-delete/restore flow.
- **i18n** — `src/i18n/index.ts` is a single ~1500-line file with the full `it` and `en` resource trees. Default language is `it`, read from the persisted `preferences` key before React mounts. Add keys to **both** trees; several call sites pass an Italian `defaultValue` as a fallback.

### PWA

`vite-plugin-pwa` with `registerType: 'autoUpdate'`. `src/pwaRegister.ts` translates Workbox's `onNeedRefresh` into a `pwa-update-available` window event, which `Layout` turns into a persistent notification whose button calls `applyPWAUpdate()`. Workbox runtime caching: `/api/*` is **NetworkFirst** (3s timeout, 5-minute TTL) and images are CacheFirst (30 days) — worth remembering when debugging apparently stale API data on a built/installed app. Icons come from `scripts/generate-icons.mjs` (sharp), run before every production build.

Production build also emits `.br`/`.gz` variants and splits `vendor-react` / `vendor-i18n` manual chunks (`vite.config.ts`); `Dockerfile` + `nginx.conf.template` serve it.

### Responsive design

`src/hooks/useBreakpoints.ts` is the entry point (built on `useMediaQuery`): `isMobile` = ≤991px (matches AntD's `lg` / the Sider breakpoint), `isSmallMobile` = ≤768px. `BottomNavBar` renders only for `isSmallMobile`. Mobile-only CSS overrides live in `src/mobile.css`. `usePullToRefresh` and `utils/haptic.ts` (vibration, gated to standalone/installed PWA mode) provide app-like touch behaviour.

### Design tokens

`src/theme/tokens.ts` is the styling source of truth and is now fairly complete: `SPACING`, `FONT_SIZE`, `RADIUS`/`RADIUS_BASE`, `SHADOW`, the theme-aware brand primary (`PRIMARY_LIGHT_HEX`/`PRIMARY_DARK_HEX` — hex, because AntD's color derivation can't parse the `oklch()` variants), `SEMANTIC` + `getSemanticColors(isDark)`, brand/auth gradients, and `FONT_HEADING`/`FONT_BODY`. Wired into `ConfigProvider` in `App.tsx` (primary, radii, font family, plus Button/Menu/Card/Modal component overrides).

Import from `theme/tokens.ts` instead of adding another inline magic number, and extend the file when a token is missing. Note the old `COLOR_POSITIVE`/`COLOR_NEGATIVE`/`COLOR_ACCENT`/`COLOR_WARNING` exports no longer exist — use `getSemanticColors(isDark)`.

Fonts (Inter body / Manrope headings) load from Google Fonts in `index.html`; `src/index.css` forces Manrope onto headings and `.ant-statistic-content` with `!important` because AntD injects its own font-family via CSS-in-JS afterwards.

### Component conventions

- `src/components/common/` holds the generic primitives: `StatCard`, `EmptyState`, `PageHeader`, `AsyncBoundary`, `ErrorBoundary`, `RouteErrorFallback`, `SafeSelect`, `DatePresetPicker`, `Fab`, `AppLogo`, `AuthCard`. Put new generic primitives here.
- All shared modals live in `src/components/modals/`. Feature-specific ones stay colocated under `src/pages/**` (e.g. `BudgetAlertsDrawer`).
- Feature component folders: `dashboard/`, `reports/`, `layout/`, `banking/`, `onboarding/`.
- **`StatCard` is the single stat-card implementation** (Dashboard, `BalanceTrendSection`, `PortfolioSummary` all use it) — don't hand-roll a fourth Card+Statistic variant.
- **`AsyncBoundary` is currently unused** despite documenting the convention in its own header. It standardizes loading (Skeleton) / error (EmptyState + Retry) / empty for `useQuery`-driven views — prefer it for new such views rather than inline `Spin` + bare `<Empty>`.
- Empty states remain inconsistent: `EmptyState` (with CTA actions) is preferred, but several charts and tables still render a bare AntD `<Empty>`. Use `EmptyState` for new code.
- Prefer `theme.useToken()` (`token.colorText`, `token.colorBgContainer`) over `isDark ? '#fff' : '#000'` branching; most components already do. AntD charts take `theme: isDark ? 'dark' : undefined`.
- File naming: PascalCase with `*Page`/`*Modal`/`*Card`/`*Drawer`/`*Chart` suffixes.
- Any `InputNumber` that should accept a comma as decimal separator uses the shared `commaDecimalParser` from `src/utils/number.ts` and **must** pin the generic (`<InputNumber<number> …>`): without it TypeScript infers the value type from the `min`/`max` literal (`min={0}` → `T = 0`) and the parser no longer type-checks.
- Components are declared at module scope, never inside another component's render (that changes their identity every render and remounts the subtree) — pass what they need as props, as `ComparisonRow` in `DashboardChartsMobile.tsx` does.
- Values computed once per mount (e.g. iOS detection in `SafeSelect`/`DatePresetPicker`) use a lazy `useState(fn)` initializer, not `useRef(fn()).current`: refs may not be read during render.

## Docs

`docs/*.md` (architecture, integrations, pwa, api_client, development_guide) and `README.md` are **automatically published to the GitHub Wiki** by `.github/workflows/wiki-sync.yml` on every push to `main` that touches them — the workflow wipes and replaces the wiki contents. Editing those files is a public-facing change. `docs/architecture.md` currently predates the hook extraction and multi-provider bank linking (it still describes `GoCardlessModal` and a live `transactionRefreshKey`); treat this file as authoritative over it.

`AUDIT.md` (untracked, Italian, dated 2026-07-02) is a static-analysis audit of the frontend. Several of its findings have since been fixed (shared `StatCard`, `components/common/`, token scales, dashboard error reporting) — verify against the code before acting on it.
