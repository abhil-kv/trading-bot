import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import apiClient from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [clientId, setClientId] = useState(null);
  const [checking, setChecking] = useState(true);

  const checkSession = useCallback(async () => {
    try {
      const { data } = await apiClient.get('/auth/session');
      setAuthenticated(!!data.authenticated);
      setClientId(data.clientId || null);
    } catch {
      setAuthenticated(false);
      setClientId(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const login = useCallback(async (credentials) => {
    const { data } = await apiClient.post('/auth/login', credentials);
    setAuthenticated(true);
    setClientId(data.clientId);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      setAuthenticated(false);
      setClientId(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ authenticated, clientId, checking, login, logout, checkSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
