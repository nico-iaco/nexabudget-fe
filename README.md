# NexaBudget Frontend

NexaBudget is a modern and intuitive personal finance management application designed to help you track your income and expenses with ease. This repository contains the source code for the frontend part of the application, built with React.

## ✨ Features

- **User Authentication**: Secure registration and login system.
- **Account Management**: Create, view, update, and delete multiple financial accounts (e.g., checking, savings, cash).
- **Transaction Tracking**: Log income and expenses for each account.
- **Categorization**: Assign categories to transactions for better analysis.
- **Powerful Filtering & Sorting**: Easily find transactions by description, account, category, type, or date range.
- **Responsive Design**: A seamless experience on both desktop and mobile devices.
- **Progressive Web App (PWA)**: Install the app on your device for an app-like experience.
- **Mobile-Friendly**: Optimized UI for smartphones and tablets with touch-friendly controls.
- **Offline Support**: Basic offline functionality through service workers.
- **Dashboard Overview**: Get a quick overview of your financial health with interactive charts.
- **GoCardless Integration**: Link your bank accounts for automatic transaction synchronization.

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
- 🔔 Push notifications (future implementation)
- ⚡ Optimized performance with caching

## 🛠️ Technologies Used

- **Framework**: React 19
- **Build Tool**: Vite 7
- **Language**: TypeScript
- **UI Library**: Ant Design 5
- **Routing**: React Router 7
- **HTTP Client**: Axios for making API requests
- **State Management**: React Context API for global state like authentication
- **Date & Time**: Day.js for date manipulation and formatting
- **Charts**: @ant-design/charts for data visualization
- **PWA**: vite-plugin-pwa with Workbox for service worker generation

## 🚀 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

- Node.js (v18 or later recommended)
- npm or another package manager like yarn or pnpm
- A running instance of the NexaBudget Backend (You will need to set up the backend server separately)

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

3. Generate PWA icons (optional, they are auto-generated during build):
    ```shell
    npm run generate-icons
    ```

4. Set up environment variables: The frontend needs to know the URL of the backend API. Create a file named `.env.local` in the root of the project and add the following variable. By default, the backend is expected to run on http://localhost:8080.
    ```shell
    # .env.local
    VITE_BE_BASE_URL=http://localhost:8080
   ```
    The Vite development server will proxy requests from `/api` to this URL.

5. Run the development server:
    ```shell
    npm run dev
   ```

6. Open the application: Open your browser and navigate to the local URL provided by Vite (usually http://localhost:5173).

#### Running with Docker Compose

As an alternative to running locally, you can start the application using Docker. This method does not require Node.js or npm dependencies to be installed on your host machine.

1. **Prerequisites**:
   - Docker and Docker Compose installed
   - A running instance of the NexaBudget backend, accessible from the Docker network. Make sure to configure the backend URL in the `nginx.conf.template` file if it's not http://localhost:8080.
2. Start the application: Run the following command from the project's root directory to build the Docker image and start the container.
   ```shell
   docker-compose up -d --build
   ```
3. Open the application: Open your browser and go to http://localhost (or the port you configured in the docker-compose.yaml file).