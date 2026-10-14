import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';

interface AuthState {
  token: string | null;
  user: User | null;
  setToken: (token: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      setToken: (token) => {
        localStorage.setItem('jwt_token', token);
        set({ token });
      },
      setUser: (user) => set({ user }),
      logout: () => {
        localStorage.removeItem('jwt_token');
        set({ token: null, user: null });
      },
      isAuthenticated: () => !!get().token,
    }),
    { name: 'auth-storage', partialize: (state) => ({ token: state.token, user: state.user }) }
  )
);
