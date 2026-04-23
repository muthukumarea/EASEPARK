import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getMe } from '../services/api';

const AuthContext = createContext(null);
const TOKEN_KEY = 'ep_token';
const USER_KEY = 'ep_user';

const clearStoredAuth = () => {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) { setLoading(false); return; }
    try {
      const res = await getMe();
      setUser(res.data.data.user);
    } catch {
      clearStoredAuth();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  useEffect(() => {
    // Remove previously persisted logins so reopening localhost does not auto-sign in.
    if (localStorage.getItem(TOKEN_KEY) || localStorage.getItem(USER_KEY)) {
      clearStoredAuth();
      setUser(null);
    }
  }, []);

  const login = (token, userData) => {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    clearStoredAuth();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
