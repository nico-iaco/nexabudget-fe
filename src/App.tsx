// src/App.tsx
import { createBrowserRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { TransactionsPage } from './pages/transactions/TransactionsPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import type { JSX } from "react";
import {GoCardlessCallbackPage} from "./pages/gocardless/GoCardlessCallbackPage.tsx";

// 1. Layout per le pagine pubbliche (Login/Register)
const PublicLayout = () => (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Outlet />
    </div>
);

// 2. Componente per proteggere le rotte private
const PrivateRoute = ({ children }: { children: JSX.Element }) => {
    const { auth } = useAuth();
    return auth ? children : <Navigate to="/login" />;
};

// 3. Componente per reindirizzare gli utenti autenticati
const RedirectIfAuth = ({ children }: { children: JSX.Element }) => {
    const { auth } = useAuth();
    return auth ? <Navigate to="/" /> : children;
};


const router = createBrowserRouter([
    {
        path: '/',
        element: <PrivateRoute><Layout /></PrivateRoute>,
        children: [
            { index: true, element: <Navigate to="/dashboard" /> },
            {
                path: 'dashboard',
                element: <DashboardPage />,
            },
            {
                path: 'transactions',
                element: <TransactionsPage />,
            },
            {
                path: 'accounts/:accountId/transactions',
                element: <TransactionsPage />,
            },
            {
                path: 'gocardless/callback/:accountId',
                element: <GoCardlessCallbackPage />,
            },
        ],
    },
    {
        path: '/',
        element: <RedirectIfAuth><PublicLayout /></RedirectIfAuth>,
        children: [
            { path: 'login', element: <LoginPage /> },
            { path: 'register', element: <RegisterPage /> },
        ]
    }
]);

function App() {
    return <RouterProvider router={router} />;
}

export default App;
