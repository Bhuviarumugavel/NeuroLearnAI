/**
 * api.js — Axios instance for NeurolearnAI backend
 * Uses Vite dev proxy (relative URL) so all /api/* requests are
 * forwarded to http://localhost:8000 — this avoids CORS issues in development.
 */
import axios from 'axios';

// Use relative base URL so Vite's proxy handles /api/* → localhost:8000
// In production, set VITE_API_BASE to the real backend URL.
const API_BASE = import.meta.env.VITE_API_BASE || '';
const TOKEN_KEY = 'neurolearn_token';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// ── Request Interceptor: inject JWT ───────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

// ── Response Interceptor: handle 401 ──────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('neurolearn_user');
      // Redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export { TOKEN_KEY };
export default api;
