# Development & Deployment Guide

This guide provides practical instructions for setting up the local development environment, managing internationalization, building for production, and deploying NexaBudget Frontend via Docker.

---

## 🚀 Local Development Setup

### Prerequisites

* **Node.js**: Version 20 or later.
* **npm**: Version 9 or later.
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

During development, Vite will proxy all network requests targeting `/api` to the `VITE_BE_BASE_URL`.

---

## 🛠️ CLI Script Reference

NexaBudget Frontend configures the following scripts in `package.json`:

* **`npm run dev`**: Starts the Vite local development server. Binds the server to `--host` by default to allow local network testing (e.g., testing the PWA on physical mobile devices).
* **`npm run build`**: Compiles the application for production. Executes three sequential tasks:
    1. `npm run generate-icons`: Generates device-compliant PWA icons via [scripts/generate-icons.mjs](file:///Users/nicolaiacovelli/WebstormProjects/nexabudget-fe/scripts/generate-icons.mjs).
    2. `tsc -b`: Type-checks the entire TypeScript codebase using the project build configuration.
    3. `vite build`: Bundles assets, applies compression (Brotli and Gzip), and writes static bundles into the `dist/` directory.
* **`npm run lint`**: Inspects code quality by running ESLint across all TypeScript and React components.
* **`npm run preview`**: Serves the local production build folder (`dist/`) on a local port for verification before deployment.

---

## 🌐 Localization & Translation (i18n)

NexaBudget is fully localized in **English** and **Italian**.

### Code Structure

Localization config lives in [src/i18n/index.ts](file:///Users/nicolaiacovelli/WebstormProjects/nexabudget-fe/src/i18n/index.ts) using the `i18next` framework. Translation keys are categorized into namespaces:

* `common`: Navigation tabs, action buttons (cancel, save, edit), currency defaults.
* `auth`: Username/email inputs, form validation, logins.
* `dashboard`: Time period selections, cashflow charts,MoM delta tags, budget alert warnings.
* `accounts`: Bank name, starting balances, external synchronizations.
* `transactions`: Multi-currency filters, transfer connectors.
* `budgets`: Recurrence types, limit rules, remaining budgets.
* `crypto`: Binance key inputs, API settings.
* `chat`: AI conversation sessions.
* `pwa`: Offline notifications, update prompts.

### Usage in Components

Import the `useTranslation` React hook to dynamically resolve locale text:

```typescript
import { useTranslation } from 'react-i18next';

export const SampleComponent = () => {
    const { t } = useTranslation();
    return <button>{t('common.save')}</button>;
};
```

Language state is bound to user preferences and stored inside the browser's `localStorage` to ensure continuity across reloads.

---

## 🐳 Docker Deployment

For containerized deployments, NexaBudget uses a multi-stage Docker build to build and serve static files efficiently.

### 1. Dockerfile Analysis

The [Dockerfile](file:///Users/nicolaiacovelli/WebstormProjects/nexabudget-fe/Dockerfile) separates building from hosting:

1. **Build Stage**:
    * Inherits `node:24-alpine` for dependencies installation and compilation.
    * Copies dependency definitions and executes `npm ci --legacy-peer-deps` to lock package versions.
    * Compiles static bundles via `npm run build` (outputs compilation output to `/app/dist`).
2. **Web Server Stage**:
    * Inherits the lightweight `nginx:alpine` image.
    * Copies `/app/dist` compiled files from Stage 1 into the default static root: `/usr/share/nginx/html`.
    * Copies [nginx.conf.template](file:///Users/nicolaiacovelli/WebstormProjects/nexabudget-fe/nginx.conf.template) to `/etc/nginx/templates/default.conf.template`.
    * Exposes Port `80` and runs Nginx in the foreground.

### 2. Nginx Template Configuration

The Nginx server configuration (`nginx.conf.template`) includes optimized settings for Single Page Apps and API routing:

* **Routing SPA**: `try_files $uri /index.html` redirects all non-file client requests to the single-page router.
* **API Proxy**: All `/api` routes are captured and proxy-passed to the backend server:

    ```nginx
    location /api {
        proxy_pass http://${BACKEND_URL};
    }
    ```

    `BACKEND_URL` is injected at runtime using environment variables.
* **Logging**: Custom log level can be set using the `${LOG_LEVEL}` env variable (e.g. `info`, `warn`).
* **Caching Optimization**:
  * **Vite CSS/JS**: Long-term caching is enabled (`expires 1y; immutable`) since Vite automatically hashes compiled files.
  * **Images & Web Fonts**: Cached for 1 month (`expires 1M`).

### 3. Docker Compose Orchestration

You can spin up the frontend service using [docker-compose.yaml](file:///Users/nicolaiacovelli/WebstormProjects/nexabudget-fe/docker-compose.yaml):

```yaml
version: '3.8'
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
* **Variables**: Injects `BACKEND_URL` pointing to the host's backend instance.
* **Startup**: Run the compose suite:

    ```bash
    docker-compose up -d --build
    ```
