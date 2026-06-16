import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const AuthContext = createContext(null);
const TOKEN_KEY = 'eo.token';
const USER_KEY = 'eo.user';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '');
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const persist = (t, u) => {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
    if (u) localStorage.setItem(USER_KEY, JSON.stringify(u));
    else localStorage.removeItem(USER_KEY);
  };

  const login = useCallback((t, u) => {
    setToken(t);
    setUser(u);
    persist(t, u);
  }, []);

  const logout = useCallback(() => {
    setToken('');
    setUser(null);
    persist('', null);
  }, []);

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAuthed: Boolean(token) }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// Tiny API helper that auto-attaches the token and surfaces server error messages.
export async function api(path, { method = 'GET', body, isForm = false } = {}) {
  const headers = {};
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) headers['Authorization'] = `Bearer ${token}`;
  let payload;
  if (isForm) {
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(path, { method, headers, body: payload });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }
  if (!res.ok) {
    const msg = (data && data.error) || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data;
}
