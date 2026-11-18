import React, { createContext, useContext, useState } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('anbar_user');
    return raw ? JSON.parse(raw) : null;
  });

  async function login(username, password) {
    const res = await api.post('/auth/login', { username, password });
    localStorage.setItem('anbar_token', res.data.token);
    localStorage.setItem('anbar_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  }

  function logout() {
    localStorage.removeItem('anbar_token');
    localStorage.removeItem('anbar_user');
    setUser(null);
  }

  function can(permission) {
    return !!user?.permissions?.includes(permission);
  }

  return <AuthContext.Provider value={{ user, login, logout, can }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
