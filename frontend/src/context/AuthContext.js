import React, { createContext, useContext, useReducer } from 'react';
import axios from '../utils/axios';

const AuthContext = createContext();

const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN': return { ...state, user: action.payload, isAuthenticated: true, loading: false };
    case 'LOGOUT': return { ...state, user: null, isAuthenticated: false, loading: false };
    default: return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, {
    user: JSON.parse(localStorage.getItem('user')) || null,
    isAuthenticated: !!localStorage.getItem('token'),
    loading: false
  });

  const login = async (email, password) => {
    const { data } = await axios.post('/api/auth/login', { email, password }, { withCredentials: true });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data));
    dispatch({ type: 'LOGIN', payload: data });
    return data;
  };

  const register = async (name, email, password, role = 'consumer') => {
    const { data } = await axios.post('/api/auth/register', { name, email, password, role });
    if (data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data));
      dispatch({ type: 'LOGIN', payload: data });
    }
    return data;
  };

  const logout = async () => {
    try { await axios.post('/api/auth/logout'); } catch {}
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    dispatch({ type: 'LOGOUT' });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
