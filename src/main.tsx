// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './mobile.css'
import 'antd/dist/reset.css';
import {AuthProvider} from './contexts/AuthContext.tsx';
import {registerPWA} from './pwaRegister';

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <AuthProvider>
            <App />
        </AuthProvider>
    </React.StrictMode>,
)

// Registra il service worker per PWA
registerPWA();

