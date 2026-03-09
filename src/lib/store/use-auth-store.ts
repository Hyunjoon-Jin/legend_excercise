import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'admin' | 'member';

export interface User {
    id: string;
    username: string;
    role: UserRole;
    avatarUrl?: string;
    tier?: string; // e.g., 'Bronze', 'Silver', 'Gold'
}

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    autoLogin: boolean;
    login: (user: User, autoLogin?: boolean) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            isAuthenticated: false,
            autoLogin: false,
            login: (user, autoLogin = false) => set({ user, isAuthenticated: true, autoLogin }),
            logout: () => set({ user: null, isAuthenticated: false, autoLogin: false }),
        }),
        {
            name: 'auth-storage', // name of the item in the storage (must be unique)
        }
    )
);
