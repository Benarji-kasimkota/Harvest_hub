import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';
import toast from 'react-hot-toast';

jest.mock('react-hot-toast', () => ({
  success: jest.fn(),
  error: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const mockLogin = jest.fn();
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin, isAuthenticated: false, user: null }),
}));

const renderLogin = () =>
  render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );

beforeEach(() => {
  jest.clearAllMocks();
});

describe('LoginPage', () => {
  it('renders email and password fields plus sign-in button', () => {
    renderLogin();
    expect(screen.getByPlaceholderText(/you@example\.com/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/••••••••/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('renders a link to the register page', () => {
    renderLogin();
    expect(screen.getByRole('link', { name: /register/i })).toBeInTheDocument();
  });

  it('shows loading text while submitting', async () => {
    mockLogin.mockImplementation(() => new Promise(() => {})); // never resolves
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText(/you@example\.com/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/), { target: { value: 'pass' } });
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form'));
    expect(await screen.findByText(/signing in/i)).toBeInTheDocument();
  });

  it('navigates to /admin for admin role', async () => {
    mockLogin.mockResolvedValue({ name: 'Admin', role: 'admin' });
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText(/you@example\.com/i), { target: { value: 'admin@test.com' } });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/), { target: { value: 'pass' } });
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/admin'));
  });

  it('navigates to /retailer for retailer role', async () => {
    mockLogin.mockResolvedValue({ name: 'Retailer', role: 'retailer' });
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText(/you@example\.com/i), { target: { value: 'ret@test.com' } });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/), { target: { value: 'pass' } });
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/retailer'));
  });

  it('navigates to /delivery for delivery role', async () => {
    mockLogin.mockResolvedValue({ name: 'Driver', role: 'delivery' });
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText(/you@example\.com/i), { target: { value: 'd@test.com' } });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/), { target: { value: 'pass' } });
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/delivery'));
  });

  it('navigates to / for consumer role', async () => {
    mockLogin.mockResolvedValue({ name: 'Consumer', role: 'consumer' });
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText(/you@example\.com/i), { target: { value: 'c@test.com' } });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/), { target: { value: 'pass' } });
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form'));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'));
  });

  it('shows error toast when login fails', async () => {
    mockLogin.mockRejectedValue({ response: { data: { message: 'Invalid credentials' } } });
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText(/you@example\.com/i), { target: { value: 'bad@test.com' } });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/), { target: { value: 'wrong' } });
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Invalid credentials'));
  });

  it('shows fallback error message when no server message', async () => {
    mockLogin.mockRejectedValue(new Error('Network Error'));
    renderLogin();
    fireEvent.change(screen.getByPlaceholderText(/you@example\.com/i), { target: { value: 'a@b.com' } });
    fireEvent.change(screen.getByPlaceholderText(/••••••••/), { target: { value: 'pass' } });
    fireEvent.submit(screen.getByRole('button', { name: /sign in/i }).closest('form'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Login failed'));
  });

  it('toggles password field visibility', () => {
    renderLogin();
    const passwordInput = screen.getByPlaceholderText(/••••••••/);
    expect(passwordInput).toHaveAttribute('type', 'password');
    const eyeBtn = screen.getByRole('button', { name: '' });
    fireEvent.click(eyeBtn);
    expect(passwordInput).toHaveAttribute('type', 'text');
    fireEvent.click(eyeBtn);
    expect(passwordInput).toHaveAttribute('type', 'password');
  });
});
