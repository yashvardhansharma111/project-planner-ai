'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { apiFetch, getAccessToken, setAccessToken } from './api';

export interface User {
  id: string;
  fullName: string;
  email: string;
  role: 'client' | 'admin' | 'tech';
  isActive: boolean;
  theme?: 'light' | 'dark';
}

interface AuthResponse {
  accessToken: string;
  user: User;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // On first load, try to restore the session: the refresh cookie can mint a
  // fresh access token even after a page reload (when the JS-held token is gone).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<AuthResponse>('/auth/refresh', { method: 'POST' });
        if (!cancelled) {
          setAccessToken(data.accessToken);
          setUser(data.user);
        }
      } catch {
        // No valid refresh cookie. If we still hold a token, validate it via /me.
        if (getAccessToken()) {
          try {
            const me = await apiFetch<{ user: User }>('/auth/me');
            if (!cancelled) setUser(me.user);
          } catch {
            setAccessToken(null);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAccessToken(data.accessToken);
    setUser(data.user);
  }, []);

  const register = useCallback(
    async (fullName: string, email: string, password: string) => {
      const data = await apiFetch<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ fullName, email, password }),
      });
      setAccessToken(data.accessToken);
      setUser(data.user);
    },
    [],
  );

  const loginWithGoogle = useCallback(async (idToken: string) => {
    const data = await apiFetch<AuthResponse>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ idToken }),
    });
    setAccessToken(data.accessToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      /* ignore — clear locally regardless */
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((u: User) => setUser(u), []);

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, loginWithGoogle, logout, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}

/** Where a user should land after auth, based on their role. Clients land
 *  straight in the AI chat intake; they can switch to other methods from there. */
export function homePathForRole(role: User['role']): string {
  if (role === 'admin') return '/admin/dashboard';
  if (role === 'tech') return '/tech/dashboard';
  return '/dashboard/new/chat';
}
