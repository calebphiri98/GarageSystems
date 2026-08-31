import { createContext, useContext, useState } from 'react';
import api from '../api/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  async function login(email, password) {
    const res = await api.post('/auth/login', { email, password });
    const { token, user } = res.data.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    setUser(user);
    return user;
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
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
