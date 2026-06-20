/**
 * AuthContext.jsx — Global authentication state manager.
 *
 * Features:
 * - Persists JWT + user profile in localStorage
 * - Auto-validates token on app startup (GET /api/auth/me)
 * - login(), register(), logout() methods
 * - "Stay logged in" across browser restarts
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { TOKEN_KEY } from '../utils/api';

const USER_KEY = 'neurolearn_user';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [token, setToken]     = useState(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true); // true while checking stored token

  // ── Persist helpers ─────────────────────────────────────────
  const saveSession = (accessToken, userData) => {
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    setToken(accessToken);
    setUser(userData);
  };

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  // ── On mount: validate stored token ─────────────────────────
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    if (!storedToken) {
      setLoading(false);
      return;
    }

    // Try to fetch current user (validates token server-side)
    api.get('/api/auth/me')
      .then((res) => {
        setUser(res.data.user);
      })
      .catch(() => {
        // Token invalid / expired — clear it
        clearSession();
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line

  // ── Register ─────────────────────────────────────────────────
  const register = async ({ full_name, email, password }) => {
    const res = await api.post('/api/auth/register', { full_name, email, password });
    saveSession(res.data.access_token, res.data.user);
    return res.data.user;
  };

  // ── Login ────────────────────────────────────────────────────
  const login = async ({ email, password }) => {
    const res = await api.post('/api/auth/login', { email, password });
    saveSession(res.data.access_token, res.data.user);
    return res.data.user;
  };

  // ── Logout ───────────────────────────────────────────────────
  const logout = () => {
    clearSession();
  };

  // ── Update local user cache (after profile update) ───────────
  const updateUser = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
  };

  const value = { user, token, loading, login, register, logout, updateUser };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
