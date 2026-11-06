import { createContext, useContext, useState } from 'react';
import api from '../api/api';

const AuthContext = createContext(null);

function readStoredUser() {
  const stored = localStorage.getItem('user') || sessionStorage.getItem('user');
  return stored ? JSON.parse(stored) : null;
}

function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);

  async function login(email, password, remember = true) {
    const res = await api.post('/auth/login', { email, password });
    const { token, user } = res.data.data;
    clearSession();
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem('token', token);
    storage.setItem('user', JSON.stringify(user));
    setUser(user);
    return user;
  }

  function logout() {
    clearSession();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

/** Given a role, returns the default dashboard path to redirect to after login. */
export function dashboardPathForRole(role) {
  switch (role) {
    case 'admin': return '/admin';
    case 'manager': return '/manager';
    case 'mechanic': return '/mechanic';
    default: return '/customer';
  }
}
