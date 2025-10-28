# NexaBudget Frontend
NexaBudget is a modern and intuitive personal finance management application designed to help you track your income and expenses with ease. This repository contains the source code for the frontend part of the application, built with React.
## ✨ Features
- User Authentication: Secure registration and login system.
- Account Management: Create, view, update, and delete multiple financial accounts (e.g., checking, savings, cash).
- Transaction Tracking: Log income and expenses for each account.
- Categorization: Assign categories to transactions for better analysis.
- Powerful Filtering & Sorting: Easily find transactions by description, account, category, type, or date range.
- Responsive Design: A seamless experience on both desktop and mobile devices.
- Dashboard Overview: (Future feature) Get a quick overview of your financial health.
## 🛠️ Technologies Used
- Framework: React
- Build Tool: Vite
- Language: TypeScript
- UI Library: Ant Design
- Routing: React Router
- HTTP Client: Axios for making API requests.
- State Management: React Context API for global state like authentication.
- Date & Time: Day.js for date manipulation and formatting.
## 🚀 Getting Started
Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.
### Prerequisites
- Node.js (v18 or later recommended)
- npm or another package manager like yarn or pnpm.
- A running instance of the NexaBudget Backend (You will need to set up the backend server separately).
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
3. Set up environment variables: The frontend needs to know the URL of the backend API. Create a file named .env.local in the root of the project and add the following variable. By default, the backend is expected to run on http://localhost:8080.
    ```shell
    # .env.local
    VITE_BE_BASE_URL=http://localhost:8080
   ```
    The Vite development server will proxy requests from /api to this URL.
4. Run the development server:
    ```shell
    npm run dev
   ```
5. Open the application: Open your browser and navigate to the local URL provided by Vite (usually http://localhost:5173).
#### Running with Docker Compose
As an alternative to running locally, you can start the application using Docker. This method does not require Node.js or npm dependencies to be installed on your host machine.
1. **Prerequisites**:
   - Docker and Docker Compose installed.
   - A running instance of the NexaBudget backend, accessible from the Docker network. Make sure to configure the backend URL in the `nginx.conf.template` file if it's not http://localhost:8080.
2. Start the application: Run the following command from the project's root directory to build the Docker image and start the container.
   ```shell
   docker-compose up -d --build
   ```
3. Open the application: Open your browser and go to http://localhost (or the port you configured in the docker-compose.yaml file).