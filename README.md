# NexaBudget Frontend

NexaBudget is a modern and intuitive personal finance management application designed to help you track your income and expenses with ease. This repository contains the source code for the frontend part of the application, built with React.

## ✨ Features

- **User Authentication**: Secure registration and login system.
- **Account Management**: Create, view, update, and delete multiple financial accounts (checking, savings, investments, cash). Deleted accounts are soft-deleted and recoverable for 30 days.
- **Multi-currency Support**: Each account can have its own currency; the correct symbol is displayed throughout the app.
- **Transaction Tracking**: Log income and expenses for each account, with server-side pagination for fast loading.
- **Transfer Management**: Link transactions as transfers between accounts, with automatic currency conversion for multi-currency transfers.
- **Categorization**: Assign categories to transactions for better analysis.
- **Powerful Filtering & Sorting**: Easily find transactions by description, account, category, type, or date range.
- **Dashboard**: Interactive overview with configurable date-range presets (last week / current month / last 6 months / last year) and custom range picker.
  - Monthly income & expense totals
  - Month-end projection
  - Month-over-month comparison with selectable month
  - Income and expense breakdown by category (pie chart + table)
  - Monthly trend bar chart (6 / 12 / 24 months)
- **Budget Templates & Alerts**: Create recurring budget limits per category (monthly, quarterly, yearly) with threshold alerts.
- **Trash / Soft Delete**: Deleted transactions and accounts are moved to a recoverable trash, with a dedicated page to restore them.
- **Audit Log**: Paginated, server-side audit trail of all user actions with expandable JSON detail.
- **Bank Synchronization**: GoCardless integration to link bank accounts and import transactions automatically.
- **Crypto Portfolio**: Binance integration for read-only crypto holdings tracking.
- **Responsive Design**: Seamless experience on desktop and mobile, with mobile-optimised controls throughout.
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
- **Build Tool**: Vite 7
- **Language**: TypeScript 5.8
- **UI Library**: Ant Design 6
- **Routing**: React Router 7
- **HTTP Client**: Axios
- **State Management**: React Context API (Auth, Preferences)
- **Date & Time**: Day.js
- **Charts**: @ant-design/charts
- **PWA**: vite-plugin-pwa with Workbox
- **i18n**: i18next (Italian & English)

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or later)
- npm
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
    Vite will proxy all `/api` requests to this URL.

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
3. Open your browser at http://localhost (or the port configured in `docker-compose.yaml`).
