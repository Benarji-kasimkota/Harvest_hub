import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../context/AuthContext';

jest.mock('../utils/axios', () => ({
  post: jest.fn(),
}));

const axios = require('../utils/axios');

const TestComponent = () => {
  const { user, isAuthenticated, logout } = useAuth();
  return (
    <div>
      <span data-testid="status">{isAuthenticated ? 'in' : 'out'}</span>
      <span data-testid="name">{user?.name || 'none'}</span>
      <span data-testid="role">{user?.role || 'none'}</span>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

const LoginComponent = () => {
  const { login, isAuthenticated, user } = useAuth();
  return (
    <div>
      <span data-testid="status">{isAuthenticated ? 'in' : 'out'}</span>
      <span data-testid="name">{user?.name || 'none'}</span>
      <button onClick={() => login('test@test.com', 'pass')}>Login</button>
    </div>
  );
};

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
});

describe('AuthContext', () => {
  it('starts unauthenticated when localStorage is empty', () => {
    render(<AuthProvider><TestComponent /></AuthProvider>);
    expect(screen.getByTestId('status')).toHaveTextContent('out');
    expect(screen.getByTestId('name')).toHaveTextContent('none');
  });

  it('restores session from localStorage on mount', () => {
    localStorage.setItem('token', 'saved-token');
    localStorage.setItem('user', JSON.stringify({ name: 'Saved User', role: 'consumer' }));
    render(<AuthProvider><TestComponent /></AuthProvider>);
    expect(screen.getByTestId('status')).toHaveTextContent('in');
    expect(screen.getByTestId('name')).toHaveTextContent('Saved User');
  });

  it('login sets state and persists to localStorage', async () => {
    axios.post.mockResolvedValue({
      data: { token: 'tok123', name: 'Alice', role: 'consumer', _id: 'u1' }
    });
    render(<AuthProvider><LoginComponent /></AuthProvider>);
    expect(screen.getByTestId('status')).toHaveTextContent('out');

    await act(async () => { screen.getByRole('button', { name: 'Login' }).click(); });

    expect(screen.getByTestId('status')).toHaveTextContent('in');
    expect(screen.getByTestId('name')).toHaveTextContent('Alice');
    expect(localStorage.getItem('token')).toBe('tok123');
  });

  it('logout clears state and localStorage', async () => {
    localStorage.setItem('token', 'tok123');
    localStorage.setItem('user', JSON.stringify({ name: 'Alice', role: 'consumer' }));
    axios.post.mockResolvedValue({ data: { message: 'Logged out' } });
    render(<AuthProvider><TestComponent /></AuthProvider>);
    expect(screen.getByTestId('status')).toHaveTextContent('in');

    await act(async () => { screen.getByRole('button', { name: 'Logout' }).click(); });

    expect(screen.getByTestId('status')).toHaveTextContent('out');
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('logout calls the /api/auth/logout endpoint', async () => {
    localStorage.setItem('token', 'tok123');
    localStorage.setItem('user', JSON.stringify({ name: 'Alice', role: 'consumer' }));
    axios.post.mockResolvedValue({ data: { message: 'Logged out' } });
    render(<AuthProvider><TestComponent /></AuthProvider>);

    await act(async () => { screen.getByRole('button', { name: 'Logout' }).click(); });

    expect(axios.post).toHaveBeenCalledWith('/api/auth/logout');
  });

  it('logout clears state even if the API call fails', async () => {
    localStorage.setItem('token', 'tok123');
    localStorage.setItem('user', JSON.stringify({ name: 'Alice', role: 'consumer' }));
    axios.post.mockRejectedValue(new Error('network error'));
    render(<AuthProvider><TestComponent /></AuthProvider>);

    await act(async () => { screen.getByRole('button', { name: 'Logout' }).click(); });

    expect(screen.getByTestId('status')).toHaveTextContent('out');
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('register without token (retailer pending) does not update auth state', async () => {
    axios.post.mockResolvedValue({
      data: { message: 'Retailer account created! Awaiting admin approval.' }
    });
    const RegisterComponent = () => {
      const { register, isAuthenticated } = useAuth();
      return (
        <div>
          <span data-testid="status">{isAuthenticated ? 'in' : 'out'}</span>
          <button onClick={() => register('Bob', 'bob@test.com', 'pass', 'retailer')}>Register</button>
        </div>
      );
    };
    render(<AuthProvider><RegisterComponent /></AuthProvider>);
    await act(async () => { screen.getByRole('button', { name: 'Register' }).click(); });
    expect(screen.getByTestId('status')).toHaveTextContent('out');
  });
});
