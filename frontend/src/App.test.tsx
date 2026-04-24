import React from 'react';
import { render, screen } from '@testing-library/react';

// Minimal smoke test — heavy page components are tested in their own files.
// Mock everything that would make a network call or rely on external SDKs.
jest.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  CardElement: () => <div data-testid="card-element" />,
  useStripe: () => null,
  useElements: () => null,
}));

jest.mock('@stripe/stripe-js', () => ({ loadStripe: jest.fn(() => Promise.resolve(null)) }));

jest.mock('./context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({ isAuthenticated: false, user: null, login: jest.fn(), logout: jest.fn() }),
}));

jest.mock('./context/CartContext', () => ({
  CartProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useCart: () => ({ items: [], totalItems: 0, totalPrice: 0, addToCart: jest.fn(), clearCart: jest.fn() }),
}));

jest.mock('./components/common/CustomCursor', () => () => null);

import App from './App';

test('app renders without crashing', () => {
  render(<App />);
  // The home or login page should mount without throwing
  expect(document.body).toBeTruthy();
});
