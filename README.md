# NexaBudget Frontend

NexaBudget is a modern and intuitive personal finance management application designed to help you track your income and expenses with ease. This repository contains the source code for the frontend part of the application, built with React.

## 📸 Screenshots

| Dashboard | Transactions | Budgets |
|---|---|---|
| ![Dashboard light](https://raw.githubusercontent.com/nico-iaco/nexabudget-fe/main/docs/screenshots/dashboard-light.png) | ![Transactions light](https://raw.githubusercontent.com/nico-iaco/nexabudget-fe/main/docs/screenshots/transactions-light.png) | ![Budgets light](https://raw.githubusercontent.com/nico-iaco/nexabudget-fe/main/docs/screenshots/budgets-light.png) |
| ![Dashboard dark](https://raw.githubusercontent.com/nico-iaco/nexabudget-fe/main/docs/screenshots/dashboard-dark.png) | ![Transactions dark](https://raw.githubusercontent.com/nico-iaco/nexabudget-fe/main/docs/screenshots/transactions-dark.png) | ![Budgets dark](https://raw.githubusercontent.com/nico-iaco/nexabudget-fe/main/docs/screenshots/budgets-dark.png) |

| Crypto Portfolio | Settings | Trash |
|---|---|---|
| ![Crypto light](https://raw.githubusercontent.com/nico-iaco/nexabudget-fe/main/docs/screenshots/crypto-light.png) | ![Settings light](https://raw.githubusercontent.com/nico-iaco/nexabudget-fe/main/docs/screenshots/settings-light.png) | ![Trash light](https://raw.githubusercontent.com/nico-iaco/nexabudget-fe/main/docs/screenshots/trash-light.png) |
| ![Crypto dark](https://raw.githubusercontent.com/nico-iaco/nexabudget-fe/main/docs/screenshots/crypto-dark.png) | ![Settings dark](https://raw.githubusercontent.com/nico-iaco/nexabudget-fe/main/docs/screenshots/settings-dark.png) | ![Trash dark](https://raw.githubusercontent.com/nico-iaco/nexabudget-fe/main/docs/screenshots/trash-dark.png) |

| Audit Log | NexaBot Chat |
|---|---|
| ![Audit log light](https://raw.githubusercontent.com/nico-iaco/nexabudget-fe/main/docs/screenshots/audit-log-light.png) | ![Chat light](https://raw.githubusercontent.com/nico-iaco/nexabudget-fe/main/docs/screenshots/chat-light.png) |
| ![Audit log dark](https://raw.githubusercontent.com/nico-iaco/nexabudget-fe/main/docs/screenshots/audit-log-dark.png) | ![Chat dark](https://raw.githubusercontent.com/nico-iaco/nexabudget-fe/main/docs/screenshots/chat-dark.png) |

| Investments | Asset detail | Net worth |
|---|---|---|
| ![Investments light](https://raw.githubusercontent.com/nico-iaco/nexabudget-fe/main/docs/screenshots/investments-light.png) | ![Asset detail light](https://raw.githubusercontent.com/nico-iaco/nexabudget-fe/main/docs/screenshots/investment-detail-light.png) | ![Net worth light](https://raw.githubusercontent.com/nico-iaco/nexabudget-fe/main/docs/screenshots/net-worth-light.png) |
| ![Investments dark](https://raw.githubusercontent.com/nico-iaco/nexabudget-fe/main/docs/screenshots/investments-dark.png) | ![Asset detail dark](https://raw.githubusercontent.com/nico-iaco/nexabudget-fe/main/docs/screenshots/investment-detail-dark.png) | ![Net worth dark](https://raw.githubusercontent.com/nico-iaco/nexabudget-fe/main/docs/screenshots/net-worth-dark.png) |

*Shown with sample data, in light (top row) and dark (bottom row) theme.*

## ✨ Features

- **User Authentication**: Secure registration and login system.
- **Account Management**: Create, view, update, and delete multiple financial accounts (checking, savings, investments, cash). Deleted accounts are soft-deleted and recoverable for 30 days.
- **Multi-currency Support**: Each account can have its own currency; the correct symbol is displayed throughout the app.
- **Transaction Tracking**: Log income and expenses for each account, with server-side pagination for fast loading.
- **Transfer Management**: Link transactions as transfers between accounts, with automatic currency conversion for multi-currency transfers.
- **Categorization**: Assign categories to transactions for better analysis, with support for merging two categories into one.
- **Powerful Filtering & Sorting**: Easily find transactions by description, account, category, type, or date range.
- **Statement Imports**: Import transactions from CSV (with configurable column mapping) or OFX files, with a preview and duplicate detection step before anything is saved.
- **Dashboard**: Interactive overview with configurable date-range presets (last 7 days / this month / last month / last 6 months / last 12 months) and custom range picker.
  - Monthly income & expense totals
  - Month-end projection
  - Month-over-month comparison with selectable month
  - Income and expense breakdown by category (donut chart + table; progress bars on mobile)
  - Monthly trend bar chart (6 / 12 / 24 months)
  - Net-worth balance trend section
  - Net worth card (liquidity + crypto + investments) with history chart
  - Guided onboarding checklist for new users
- **Budget Templates & Alerts**: Create recurring budget limits per category (monthly, quarterly, yearly) with threshold alerts.
- **Trash / Soft Delete**: Deleted transactions and accounts are moved to a recoverable trash, with a dedicated page to restore them.
- **Audit Log**: Paginated, server-side audit trail of all user actions with expandable JSON detail.
- **Bank Synchronization**: Open Banking account linking through two interchangeable providers — **GoCardless** and **Enable Banking** — with automatic transaction import and live sync status.
- **Crypto Portfolio**: Read-only Binance and Coinbase integrations, plus manual holdings for cold wallets, aggregated into a single valuation.
- **Investments**: Track ETFs, stocks, bonds and funds through their operations (buy, sell, dividend, coupon): positions, unrealized/realized P/L, allocation, portfolio history and period performance. Prices come from the backend (manual price for bonds such as BTP). Kept separate from income and expenses.
- **AI Assistant (NexaBot)**: Chat with an AI agent about your finances, with multiple saved conversations and transparency about the data tools it used.
- **AI Insights & Automation**: On-demand AI analysis of your spending (viewable in-app or downloadable as PDF) and automatic categorization of uncategorized transactions.
- **Programmatic API Keys**: Issue and revoke personal API keys for programmatic access to your own data.
- **Responsive Design**: Seamless experience on desktop and mobile, with mobile-optimised controls, a bottom navigation bar, pull-to-refresh, and haptic feedback.
- **Progressive Web App (PWA)**: Installable on any device for an app-like experience with offline support.
- **Light / Dark theme**: Toggle between themes from the Settings page.
- **Bilingual UI**: Full Italian and English translations.

## 📱 Progressive Web App (PWA)

NexaBudget can be installed as a Progressive Web App (PWA) on your device:

### How to Install on Mobile (iOS/Android)

1. **Safari (iOS)**:
   - Open NexaBudget in Safari
   - Tap the "Share" icon (square with arrow)
   - Scroll down and select "Add to Home Screen"
   - Confirm the name and tap "Add"

2. **Chrome (Android)**:
   - Open NexaBudget in Chrome
   - You'll see a banner at the bottom "Add to Home screen"
   - Tap "Install" or "Add"
   - The app will appear on your home screen

### How to Install on Desktop

1. **Chrome/Edge/Brave**:
   - Open NexaBudget
   - Look for the install icon in the address bar (⊕)
   - Click "Install"

2. **Safari (macOS)**:
   - Native installation not supported, but you can add to favorites

### PWA Benefits

- 🚀 Quick access from Home Screen
- 📴 Basic offline functionality
- 🎨 Full-screen interface without browser UI
- ⚡ Optimized performance with caching

## 🛠️ Technologies Used

- **Framework**: React 19
- **Build Tool**: Vite 8
- **Language**: TypeScript 6
- **UI Library**: Ant Design 6
- **Routing**: React Router 7
- **HTTP Client**: Axios
- **Server State**: TanStack Query (React Query) 5
- **Client State**: React Context API (Auth, Preferences)
- **Date & Time**: Day.js
- **Charts**: hand-written SVG components (no chart library)
- **Markdown**: react-markdown + remark-gfm (AI answers and reports)
- **PWA**: vite-plugin-pwa with Workbox
- **i18n**: i18next (Italian & English)

## 🚀 Getting Started

### Prerequisites

- Node.js (v20 or later)
- npm (v10 or later)
- A running instance of the NexaBudget Backend

### Installation & Setup

#### Local Development

1. Clone the repository:
    ```shell
    git clone https://github.com/nico-iaco/nexabudget-fe.git
    cd nexabudget-fe
    ```

2. Install dependencies:
    ```shell
    npm install
    ```

3. Set up environment variables — create `.env.local` in the project root:
    ```shell
    VITE_BE_BASE_URL=http://localhost:8080
    ```
    Vite will proxy all `/api` (and `/mcp`) requests to this URL.

4. Run the development server:
    ```shell
    npm run dev
    ```

5. Open your browser at the URL shown by Vite (usually http://localhost:5173).

#### Running with Docker Compose

1. **Prerequisites**: Docker and Docker Compose installed, and the NexaBudget backend reachable from the Docker network.
2. Start the application:
   ```shell
   docker-compose up -d --build
   ```
3. Open your browser at http://localhost:3000 (or the host port configured in `docker-compose.yaml`).

## 📖 Technical Documentation

For in-depth details about the application's structure, integrations, and deployment, refer to the following documentation files:

- [Architecture & Tech Stack](docs/architecture.md): Overview of the framework, routing and code splitting, state management (React Query + contexts), the application shell, design tokens, and shared components.
- [Integrations & AI Features](docs/integrations.md): Detailed information on multi-provider Open Banking (GoCardless / Enable Banking), Crypto tracking (Binance/Coinbase/manual), CSV & OFX statement imports, and AI-powered features (financial Chat assistant, transaction categorizer, AI reports).
- [PWA Configuration](docs/pwa.md): Details on the Progressive Web App setup, Service Worker update prompts, offline capabilities, and asset caching.
- [API Client Layer](docs/api_client.md): Deep-dive into Axios configuration, authentication token injection, response handling, and endpoints mapping.
- [Development & Deployment Guide](docs/development_guide.md): Developer setup instructions, CLI scripts, i18n structure, environment configuration, the docs-to-wiki workflow, and Docker deployment.

