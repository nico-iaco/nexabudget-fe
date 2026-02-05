// src/App.tsx
import {createBrowserRouter, Navigate, Outlet, RouterProvider} from 'react-router-dom';
import {App as AntApp, ConfigProvider, theme as antTheme} from 'antd';
import {useAuth} from './contexts/AuthContext';
import {Layout} from './components/Layout';
import {LoginPage} from './pages/auth/LoginPage';
import {RegisterPage} from './pages/auth/RegisterPage';
import {TransactionsPage} from './pages/transactions/TransactionsPage';
import {DashboardPage} from './pages/dashboard/DashboardPage';
import type {JSX} from "react";
import {GoCardlessCallbackPage} from "./pages/gocardless/GoCardlessCallbackPage.tsx";
import {CryptoPage} from "./pages/crypto/CryptoPage";
import {SettingsPage} from "./pages/settings/SettingsPage";
import {usePreferences} from './contexts/PreferencesContext';

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
            {
                path: 'crypto',
                element: <CryptoPage />,
            },
            {
                path: 'settings',
                element: <SettingsPage />,
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
    const { preferences } = usePreferences();
    const algorithm = preferences.theme === 'dark' ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm;

    return (
        <ConfigProvider theme={{ algorithm }}>
            <AntApp>
                <RouterProvider router={router} />
            </AntApp>
        </ConfigProvider>
    );
}

export default App;
