import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { CartProvider } from '../context/CartContext';
import ShopPage from '../pages/ShopPage';

jest.mock('../utils/axios', () => ({
  get: jest.fn(),
}));

const axios = require('../utils/axios');

const makePage = (products, total = products.length, page = 1, pages = 1) => ({
  data: { products, total, page, pages },
});

const makeProduct = (id, name = 'Tomatoes', category = 'vegetables') => ({
  _id: id,
  name,
  description: 'Fresh produce',
  price: 2.99,
  category,
  image: 'https://example.com/img.jpg',
  stock: 10,
  unit: 'kg',
  farmer: 'Test Farm',
  rating: 0,
  numReviews: 0,
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <AuthProvider>
        <CartProvider>
          <ShopPage />
        </CartProvider>
      </AuthProvider>
    </MemoryRouter>
  );

beforeEach(() => {
  jest.clearAllMocks();
  axios.get.mockResolvedValue(makePage([makeProduct('p1')]));
});

// ── Loading & empty ────────────────────────────────────────────────────────
describe('ShopPage — loading and empty states', () => {
  it('shows loading state initially', () => {
    axios.get.mockImplementation(() => new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/loading products/i)).toBeInTheDocument();
  });

  it('shows empty state when no products returned', async () => {
    axios.get.mockResolvedValue(makePage([], 0));
    renderPage();
    await waitFor(() => screen.getByText(/no products found/i));
    expect(screen.getByText(/no products found/i)).toBeInTheDocument();
  });

  it('renders products when data loads', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Tomatoes'));
    expect(screen.getByText('Tomatoes')).toBeInTheDocument();
  });
});

// ── Results count ──────────────────────────────────────────────────────────
describe('ShopPage — results count', () => {
  it('shows total product count when results exist', async () => {
    axios.get.mockResolvedValue(makePage([makeProduct('p1'), makeProduct('p2')], 25));
    renderPage();
    await waitFor(() => screen.getByText(/25 products found/i));
    expect(screen.getByText(/25 products found/i)).toBeInTheDocument();
  });

  it('shows singular "product" when total is 1', async () => {
    axios.get.mockResolvedValue(makePage([makeProduct('p1')], 1));
    renderPage();
    await waitFor(() => screen.getByText(/1 product found/i));
    expect(screen.getByText(/1 product found/i)).toBeInTheDocument();
  });
});

// ── Pagination controls ────────────────────────────────────────────────────
describe('ShopPage — pagination', () => {
  it('does not render pagination when only one page', async () => {
    axios.get.mockResolvedValue(makePage([makeProduct('p1')], 1, 1, 1));
    renderPage();
    await waitFor(() => screen.getByText('Tomatoes'));
    expect(screen.queryByText(/← Prev/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Next →/)).not.toBeInTheDocument();
  });

  it('renders Prev / Next buttons and page numbers when pages > 1', async () => {
    axios.get.mockResolvedValue(makePage([makeProduct('p1')], 36, 1, 3));
    renderPage();
    await waitFor(() => screen.getByText(/← Prev/));
    expect(screen.getByText(/← Prev/)).toBeInTheDocument();
    expect(screen.getByText(/Next →/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument();
  });

  it('Prev button is disabled on the first page', async () => {
    axios.get.mockResolvedValue(makePage([makeProduct('p1')], 24, 1, 2));
    renderPage();
    await waitFor(() => screen.getByText(/← Prev/));
    expect(screen.getByText(/← Prev/).closest('button')).toBeDisabled();
  });

  it('Next button is disabled on the last page', async () => {
    axios.get.mockResolvedValue(makePage([makeProduct('p1')], 24, 1, 2));
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: '2' }));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() => {
      expect(screen.getByText(/Next →/).closest('button')).toBeDisabled();
    });
  });

  it('clicking a page number triggers a new API request with the correct page', async () => {
    axios.get.mockResolvedValue(makePage([makeProduct('p1')], 36, 1, 3));
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: '2' }));

    fireEvent.click(screen.getByRole('button', { name: '2' }));

    await waitFor(() => {
      const lastCall = axios.get.mock.calls[axios.get.mock.calls.length - 1][0];
      expect(lastCall).toContain('page=2');
    });
  });

  it('clicking Next goes to page 2', async () => {
    axios.get.mockResolvedValue(makePage([makeProduct('p1')], 24, 1, 2));
    renderPage();
    await waitFor(() => screen.getByText(/Next →/));

    fireEvent.click(screen.getByText(/Next →/));

    await waitFor(() => {
      const calls = axios.get.mock.calls;
      const lastUrl = calls[calls.length - 1][0];
      expect(lastUrl).toContain('page=2');
    });
  });

  it('changing category resets to page 1', async () => {
    axios.get.mockResolvedValue(makePage([makeProduct('p1')], 24, 1, 2));
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: '2' }));

    // Go to page 2
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    await waitFor(() => {
      const lastUrl = axios.get.mock.calls[axios.get.mock.calls.length - 1][0];
      expect(lastUrl).toContain('page=2');
    });

    // Change category — should reset to page 1
    fireEvent.click(screen.getByRole('button', { name: 'Fruits' }));
    await waitFor(() => {
      const lastUrl = axios.get.mock.calls[axios.get.mock.calls.length - 1][0];
      expect(lastUrl).toContain('page=1');
    });
  });
});

// ── Category filter ────────────────────────────────────────────────────────
describe('ShopPage — category sidebar', () => {
  it('renders all category buttons', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Tomatoes'));
    expect(screen.getByRole('button', { name: 'All Products' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vegetables' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fruits' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Meat' })).toBeInTheDocument();
  });

  it('clicking a category appends it to the API request', async () => {
    renderPage();
    await waitFor(() => screen.getByRole('button', { name: 'Fruits' }));
    fireEvent.click(screen.getByRole('button', { name: 'Fruits' }));

    await waitFor(() => {
      const lastUrl = axios.get.mock.calls[axios.get.mock.calls.length - 1][0];
      expect(lastUrl).toContain('category=fruits');
    });
  });
});
