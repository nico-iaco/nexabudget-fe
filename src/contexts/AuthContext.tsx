// src/contexts/AuthContext.tsx
/* eslint-disable react-refresh/only-export-components */
import {createContext, type ReactNode, useContext, useEffect, useState} from 'react';
import type {AuthResponse} from '../types/api';

interface AuthContextType {
    auth: AuthResponse | null;
    login: (authData: AuthResponse) => void;
    logout: () => void;
    updateUser: (userData: Partial<AuthResponse>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [auth, setAuth] = useState<AuthResponse | null>(() => {
        const storedAuth = localStorage.getItem('auth');
        return storedAuth ? JSON.parse(storedAuth) : null;
    });

    useEffect(() => {
        const token = auth?.token;
        if (token) {
            localStorage.setItem('authToken', token);
            localStorage.setItem('auth', JSON.stringify(auth));
        } else {
            localStorage.removeItem('authToken');
            localStorage.removeItem('auth');
        }
    }, [auth]);

    const login = (authData: AuthResponse) => {
        setAuth(authData);
    };

    const logout = () => {
        setAuth(null);
    };

    const updateUser = (userData: Partial<AuthResponse>) => {
        setAuth(prev => prev ? { ...prev, ...userData } : null);
    };

    return (
        <AuthContext.Provider value={{ auth, login, logout, updateUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
