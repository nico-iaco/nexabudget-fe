// src/App.tsx
import {createBrowserRouter, Navigate, Outlet, RouterProvider} from 'react-router-dom';
import {App as AntApp} from 'antd';
import {useAuth} from './contexts/AuthContext';
import {Layout} from './components/Layout';
import {LoginPage} from './pages/auth/LoginPage';
import {RegisterPage} from './pages/auth/RegisterPage';
import {TransactionsPage} from './pages/transactions/TransactionsPage';
import {DashboardPage} from './pages/dashboard/DashboardPage';
import type {JSX} from "react";
import {GoCardlessCallbackPage} from "./pages/gocardless/GoCardlessCallbackPage.tsx";

const PublicLayout = () => (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <Outlet />
    </div>
);

const PrivateRoute = ({ children }: { children: JSX.Element }) => {
    const { auth } = useAuth();
    return auth ? children : <Navigate to="/login" />;
};

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
    return (
        <AntApp>
            <RouterProvider router={router} />
        </AntApp>
    );
}

export default App;
