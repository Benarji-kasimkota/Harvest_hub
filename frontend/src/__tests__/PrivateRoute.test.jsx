import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PrivateRoute from '../components/common/PrivateRoute';

jest.mock('../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

import { useAuth } from '../context/AuthContext';

const renderRoute = (isAuthenticated) => {
  useAuth.mockReturnValue({ isAuthenticated, user: isAuthenticated ? { role: 'consumer' } : null });
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route
          path="/protected"
          element={<PrivateRoute><div>Protected Content</div></PrivateRoute>}
        />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  );
};

describe('PrivateRoute', () => {
  it('renders children when the user is authenticated', () => {
    renderRoute(true);
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  it('redirects to /login when the user is not authenticated', () => {
    renderRoute(false);
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});
