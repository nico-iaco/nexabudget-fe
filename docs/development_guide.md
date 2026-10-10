# Development & Deployment Guide

This guide provides practical instructions for setting up the local development environment, managing internationalization, building for production, and deploying NexaBudget Frontend via Docker.

---

## 🚀 Local Development Setup

### Prerequisites

* **Node.js**: Version 20 or later (Vite 8 requires a modern LTS; the Docker build image is `node:24-alpine`).
* **npm**: Version 10 or later.
* **Backend Server**: A running instance of the NexaBudget Backend API.

### Installation

1. Clone the repository:

    ```bash
    git clone https://github.com/nico-iaco/nexabudget-fe.git
    cd nexabudget-fe
    ```

2. Install dependencies:

    ```bash
    npm install
    ```

### Environment Variables

Configure local variables by creating a `.env.local` file at the root of the project:

```ini
# Backend API Base URL
VITE_BE_BASE_URL=http://localhost:8080
```

During development, Vite proxies both `/api` and `/mcp` requests to `VITE_BE_BASE_URL`. If the variable is missing, the proxy falls back to `http://localhost:8080`.

---

## 🛠️ CLI Script Reference

NexaBudget Frontend configures the following scripts in `package.json`:

* **`npm run dev`**: Starts the Vite local development server. Binds the server to `--host` by default to allow local network testing (e.g., testing the PWA on physical mobile devices).
* **`npm run build`**: Compiles the application for production. Executes three sequential tasks:
    1. `npm run generate-icons`: Generates device-compliant PWA icons via `scripts/generate-icons.mjs`.
    2. `tsc -b`: Type-checks the entire TypeScript codebase using the project build configuration.
    3. `vite build`: Bundles assets, applies compression (Brotli and Gzip), and writes static bundles into the `dist/` directory.
* **`npm test`**: Runs the unit tests once with Vitest (`vitest.config.ts`, Node environment, `src/**/*.test.ts`). Tests cover pure functions only (formatting, request mapping, null/stale handling).
* **`npm run lint`**: Inspects code quality by running ESLint (flat config, `eslint.config.js`) across all TypeScript and React files.
* **`npm run preview`**: Serves the local production build folder (`dist/`) on a local port for verification before deployment. This is also the only way to exercise the service worker, which is disabled in dev mode.
* **`npm run analyze`**: Runs a production build and opens the `rollup-plugin-visualizer` treemap (`dist/stats.html`) to inspect bundle composition and chunk sizes.
* **`npm run generate-icons`**: Regenerates the PWA icon set on its own, without a full build.

### Verifying a change

The project has a **small unit-test suite** (Vitest, pure functions only — no component or end-to-end tests). Before opening a pull request, the expected checks are:

```bash
npm test
npm run lint
npm run build   # includes tsc -b, so it catches type errors
```

Test files sit next to the code (`src/utils/*.test.ts`); they are type-checked by `tsc -b` and linted like everything else.

Both currently pass; `npm run lint` reports warnings but exits 0. Three rules from `eslint-plugin-react-hooks` 7 (the React Compiler rule set) are configured as warnings instead of errors in `eslint.config.js`, each with the rationale inline — most notably `set-state-in-effect`, which flags the imperative fetch-on-mount pattern still used by the pages that predate the React Query migration. Treat those warnings as a migration backlog, not as noise to suppress.

The TypeScript config is strict and additionally enables `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, and `erasableSyntaxOnly` — so leftover imports, unused parameters, and type imports missing the `type` keyword fail the build rather than producing warnings.

---

## 🌐 Localization & Translation (i18n)

NexaBudget is fully localized in **English** and **Italian**, with Italian as the default.

### Code Structure

Localization config lives in `src/i18n/index.ts` using the `i18next` framework. Both locales live in that single file as two complete resource trees (`it` and `en`) under the `translation` namespace, so **a new key must be added to both**. The initial language is read synchronously from the persisted `preferences` entry in `localStorage` before React mounts, which avoids a flash of the wrong language on first paint; afterwards `PreferencesContext` drives `i18n.changeLanguage()`.

Keys are grouped by feature area:

* `common`: shared actions (save, cancel, delete), retry/error copy, generic labels.
* `nav`: sidebar and bottom-bar entries.
* `auth`: login, registration, and form validation.
* `accounts`, `transfers`: account CRUD, balances, multi-currency transfers.
* `bankLink`, `gocardlessCallback`, `enableBankingCallback`: Open Banking wizard and the two provider callbacks.
* `dashboard`, `charts`, `reports`, `onboarding`: dashboard widgets, chart labels, balance-trend reports, first-run checklist.
* `transactions`: filters, imports, AI categorization, transfer linking.
* `crypto`, `portfolio`, `binanceKeys`, `coinbaseKeys`, `manualHolding`: crypto tracking and exchange credentials.
* `budgets`, `audit`, `trash`, `chat`, `settings`, `pwa`: remaining feature areas.

Some call sites pass a `defaultValue` alongside the key as a safety net (that fallback text is Italian), but every key used in the code must exist in **both** trees — otherwise English users see the Italian fallback. Date-range preset labels live under `presets`.

### Numbers & dates

Never format amounts, numbers, percentages or dates by hand: use `formatMoney`, `formatNumber`, `formatPercent`, `formatDate` and `formatDateTime` from `src/utils/format.ts`, which follow the active language. Dates sent to the API always use `YYYY-MM-DD`. Numeric inputs that accept a comma as decimal separator use `commaDecimalParser` from `src/utils/number.ts`.

### Usage in Components

Import the `useTranslation` React hook to dynamically resolve locale text:

```typescript
import { useTranslation } from 'react-i18next';

export const SampleComponent = () => {
    const { t } = useTranslation();
    return <button>{t('common.save')}</button>;
};
```

---

## 📚 Documentation Workflow

The Markdown files in `docs/` and the root `README.md` are **published automatically to the repository's GitHub Wiki** by the `Sync Docs to Wiki` workflow (`.github/workflows/wiki-sync.yml`) on every push to `main` that touches them. The job replaces the wiki contents with the current files, so:

* Editing these documents is a public-facing change — keep them accurate and free of local paths or private URLs.
* Cross-document links should be plain relative Markdown links (e.g. `[Architecture](architecture.md)`) so they resolve both in the repository and in the wiki.

A second workflow, `docker-image.yml`, builds and publishes the container image.

Coding-agent guidance for this repository lives in `CLAUDE.md` at the root; it is not published to the wiki. Keep both `CLAUDE.md` and these documents up to date in the same change that makes them inaccurate.

---

## 🐳 Docker Deployment

For containerized deployments, NexaBudget uses a multi-stage Docker build to build and serve static files efficiently.

### 1. Dockerfile Analysis

The `Dockerfile` separates building from hosting:

1. **Build Stage**:
    * Inherits `node:24-alpine` for dependency installation and compilation.
    * Copies dependency definitions and executes `npm ci --legacy-peer-deps` to lock package versions.
    * Compiles static bundles via `npm run build` (output in `/app/dist`).
2. **Web Server Stage**:
    * Inherits the lightweight `nginx:alpine` image.
    * Copies `/app/dist` compiled files from Stage 1 into the default static root: `/usr/share/nginx/html`.
    * Copies `nginx.conf.template` to `/etc/nginx/templates/default.conf.template`, where the Nginx entrypoint expands the `${…}` variables at container start.
    * Exposes Port `80` and runs Nginx in the foreground.

### 2. Nginx Template Configuration

The Nginx server configuration (`nginx.conf.template`) includes optimized settings for Single Page Apps and API routing:

* **Routing SPA**: `try_files $uri /index.html` redirects all non-file client requests to the single-page router.
* **API Proxy**: `/api` routes are captured and proxy-passed to the backend server:

    ```nginx
    location /api {
        proxy_pass http://${BACKEND_URL};
    }
    ```

    `BACKEND_URL` is injected at runtime using environment variables. The block also sets `Host`, `X-Real-IP`, `X-Forwarded-For`, and `X-Forwarded-Proto`, and raises all proxy timeouts to 600s to accommodate long-running AI and bank-sync requests.
* **MCP Proxy**: an equivalent `location /mcp` block forwards the backend's stateless MCP server with the same headers and timeouts.
* **Logging**: Custom log level can be set using the `${LOG_LEVEL}` env variable (e.g. `info`, `warn`).
* **Caching Optimization**:
  * **Vite CSS/JS**: Long-term caching is enabled (`expires 1y; immutable`) since Vite automatically hashes compiled files.
  * **Images & Web Fonts**: Cached for 1 month (`expires 1M`).

### 3. Docker Compose Orchestration

You can spin up the frontend service using `docker-compose.yaml`:

```yaml
services:
  nexabudget-fe:
    container_name: nexabudget-fe
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:80"
    environment:
      - BACKEND_URL=192.168.86.112:8080
      - LOG_LEVEL=info
    restart: unless-stopped
```

* **Ports**: Binds host port `3000` to the container port `80`.
* **Variables**: Injects `BACKEND_URL` pointing at the backend instance — change it to match your own environment before building.
* **Startup**: Run the compose suite:

    ```bash
    docker-compose up -d --build
    ```
