import React from 'react';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProductPage from '../pages/ProductPage';

// ── Mocks ──────────────────────────────────────────────────────────────────
jest.mock('../utils/axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));

jest.mock('react-hot-toast', () => ({
  success: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../context/CartContext', () => ({
  useCart: () => ({ addToCart: jest.fn() }),
}));

jest.mock('../context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: 'prod1' }),
}));

const axios = require('../utils/axios');
const toast = require('react-hot-toast');
const { useAuth } = require('../context/AuthContext');

const mockProduct = {
  _id: 'prod1', name: 'Fresh Tomatoes', description: 'Red and ripe',
  price: 2.99, unit: 'kg', category: 'vegetables', farmer: 'Green Farm',
  stock: 50, rating: 4.5, numReviews: 2, image: 'https://example.com/tomato.jpg',
};

const mockReviews = [
  { _id: 'r1', user: 'u1', userName: 'Alice', rating: 5, comment: 'Amazing tomatoes!', createdAt: '2026-01-15T10:00:00Z' },
  { _id: 'r2', user: 'u2', userName: 'Bob', rating: 4, comment: 'Pretty good', createdAt: '2026-01-10T10:00:00Z' },
];

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/product/prod1']}>
      <Routes>
        <Route path="/product/:id" element={<ProductPage />} />
      </Routes>
    </MemoryRouter>
  );

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({ isAuthenticated: false, user: null });
  axios.get.mockImplementation(url => {
    if (url.includes('/reviews')) return Promise.resolve({ data: mockReviews });
    return Promise.resolve({ data: mockProduct });
  });
  axios.post.mockResolvedValue({
    data: { _id: 'r3', user: 'u3', userName: 'Carol', rating: 5, comment: 'Fantastic!', createdAt: new Date().toISOString() }
  });
  axios.delete.mockResolvedValue({ data: { message: 'Review deleted' } });
});

// ── Product display ────────────────────────────────────────────────────────
describe('ProductPage – product display', () => {
  it('renders product name, price and farmer', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Fresh Tomatoes'));
    expect(screen.getByText('Fresh Tomatoes')).toBeInTheDocument();
    expect(screen.getByText(/\$2\.99/)).toBeInTheDocument();
    expect(screen.getByText(/Green Farm/)).toBeInTheDocument();
  });

  it('shows description', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Red and ripe'));
    expect(screen.getByText('Red and ripe')).toBeInTheDocument();
  });

  it('shows in-stock message when stock > 0', async () => {
    renderPage();
    await waitFor(() => screen.getByText(/In Stock/));
    expect(screen.getByText(/In Stock/)).toBeInTheDocument();
  });

  it('shows out-of-stock and hides Add to Cart when stock is 0', async () => {
    axios.get.mockImplementation(url => {
      if (url.includes('/reviews')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: { ...mockProduct, stock: 0 } });
    });
    renderPage();
    await waitFor(() => screen.getByText(/Out of Stock/));
    expect(screen.queryByText(/Add to Cart/)).not.toBeInTheDocument();
  });

  it('shows product category badge', async () => {
    renderPage();
    await waitFor(() => screen.getByText('vegetables'));
    expect(screen.getByText('vegetables')).toBeInTheDocument();
  });

  it('navigates back when Back button is clicked', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Fresh Tomatoes'));
    fireEvent.click(screen.getByText('← Back'));
    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  it('navigates to /shop when product is not found', async () => {
    axios.get.mockImplementation(url => {
      if (url.includes('/reviews')) return Promise.resolve({ data: [] });
      return Promise.reject(new Error('Not found'));
    });
    renderPage();
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/shop'));
  });
});

// ── Reviews display ────────────────────────────────────────────────────────
describe('ProductPage – reviews display', () => {
  it('renders the reviews section heading', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Customer Reviews'));
    expect(screen.getByText('Customer Reviews')).toBeInTheDocument();
  });

  it('renders all review comments', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Amazing tomatoes!'));
    expect(screen.getByText('Amazing tomatoes!')).toBeInTheDocument();
    expect(screen.getByText('Pretty good')).toBeInTheDocument();
  });

  it('renders reviewer names', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Alice'));
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows no-reviews message when list is empty', async () => {
    axios.get.mockImplementation(url => {
      if (url.includes('/reviews')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: { ...mockProduct, numReviews: 0, rating: 0 } });
    });
    renderPage();
    await waitFor(() => screen.getByText(/No reviews yet/));
    expect(screen.getByText(/No reviews yet/)).toBeInTheDocument();
  });

  it('shows the rating breakdown bars when reviews exist', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Amazing tomatoes!'));
    expect(screen.getByText('5 ★')).toBeInTheDocument();
    expect(screen.getByText('4 ★')).toBeInTheDocument();
  });
});

// ── Unauthenticated user ───────────────────────────────────────────────────
describe('ProductPage – unauthenticated user', () => {
  it('shows login-to-review button instead of review form', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Customer Reviews'));
    expect(screen.getByRole('button', { name: /login to write a review/i })).toBeInTheDocument();
    expect(screen.queryByText('Write a Review')).not.toBeInTheDocument();
  });

  it('login button navigates to /login', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Customer Reviews'));
    fireEvent.click(screen.getByRole('button', { name: /login to write a review/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });
});

// ── Authenticated consumer ─────────────────────────────────────────────────
describe('ProductPage – authenticated consumer (not yet reviewed)', () => {
  const consumerAuth = { isAuthenticated: true, user: { _id: 'u3', name: 'Carol', role: 'consumer' } };

  beforeEach(() => {
    useAuth.mockReturnValue(consumerAuth);
  });

  it('shows the review form', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Write a Review'));
    expect(screen.getByText('Write a Review')).toBeInTheDocument();
  });

  it('shows textarea placeholder', async () => {
    renderPage();
    await waitFor(() => screen.getByPlaceholderText(/share your experience/i));
    expect(screen.getByPlaceholderText(/share your experience/i)).toBeInTheDocument();
  });

  it('submits a review and adds it to the list', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Write a Review'));
    fireEvent.change(screen.getByPlaceholderText(/share your experience/i), { target: { value: 'Fantastic!' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /submit review/i })); });
    await waitFor(() => screen.getByText('Fantastic!'));
    expect(screen.getByText('Fantastic!')).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledWith('/api/products/prod1/reviews', expect.objectContaining({ comment: 'Fantastic!' }));
  });

  it('shows success toast after submitting', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Write a Review'));
    fireEvent.change(screen.getByPlaceholderText(/share your experience/i), { target: { value: 'Lovely!' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /submit review/i })); });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Review submitted!'));
  });

  it('hides the form and shows already-reviewed message after submitting', async () => {
    renderPage();
    await waitFor(() => screen.getByText('Write a Review'));
    fireEvent.change(screen.getByPlaceholderText(/share your experience/i), { target: { value: 'Good stuff' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /submit review/i })); });
    await waitFor(() => screen.getByText(/already reviewed/i));
    expect(screen.queryByText('Write a Review')).not.toBeInTheDocument();
  });

  it('shows error toast when API rejects a duplicate review', async () => {
    axios.post.mockRejectedValue({ response: { data: { message: 'You have already reviewed this product' } } });
    renderPage();
    await waitFor(() => screen.getByText('Write a Review'));
    fireEvent.change(screen.getByPlaceholderText(/share your experience/i), { target: { value: 'Duplicate' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /submit review/i })); });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('You have already reviewed this product'));
  });
});

// ── Already-reviewed consumer ──────────────────────────────────────────────
describe('ProductPage – authenticated consumer (already reviewed)', () => {
  it('shows already-reviewed message and hides form', async () => {
    useAuth.mockReturnValue({ isAuthenticated: true, user: { _id: 'u1', name: 'Alice', role: 'consumer' } });
    renderPage();
    await waitFor(() => screen.getByText(/already reviewed/i));
    expect(screen.getByText(/already reviewed/i)).toBeInTheDocument();
    expect(screen.queryByText('Write a Review')).not.toBeInTheDocument();
  });
});

// ── Review deletion ────────────────────────────────────────────────────────
describe('ProductPage – delete review', () => {
  it('review owner sees a delete button on their review', async () => {
    useAuth.mockReturnValue({ isAuthenticated: true, user: { _id: 'u1', name: 'Alice', role: 'consumer' } });
    renderPage();
    await waitFor(() => screen.getByText('Amazing tomatoes!'));
    const deleteButtons = screen.getAllByRole('button', { name: /🗑️/i });
    expect(deleteButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('calls delete API when owner confirms deletion', async () => {
    window.confirm = jest.fn().mockReturnValue(true);
    useAuth.mockReturnValue({ isAuthenticated: true, user: { _id: 'u1', name: 'Alice', role: 'consumer' } });
    renderPage();
    await waitFor(() => screen.getByText('Amazing tomatoes!'));
    const deleteButtons = screen.getAllByRole('button', { name: /🗑️/i });
    await act(async () => { fireEvent.click(deleteButtons[0]); });
    expect(axios.delete).toHaveBeenCalledWith('/api/products/prod1/reviews/r1');
  });

  it('removes the review from the list after deletion', async () => {
    window.confirm = jest.fn().mockReturnValue(true);
    useAuth.mockReturnValue({ isAuthenticated: true, user: { _id: 'u1', name: 'Alice', role: 'consumer' } });
    renderPage();
    await waitFor(() => screen.getByText('Amazing tomatoes!'));
    const deleteButtons = screen.getAllByRole('button', { name: /🗑️/i });
    await act(async () => { fireEvent.click(deleteButtons[0]); });
    await waitFor(() => expect(screen.queryByText('Amazing tomatoes!')).not.toBeInTheDocument());
  });

  it('does not call delete API when owner cancels confirmation dialog', async () => {
    window.confirm = jest.fn().mockReturnValue(false);
    useAuth.mockReturnValue({ isAuthenticated: true, user: { _id: 'u1', name: 'Alice', role: 'consumer' } });
    renderPage();
    await waitFor(() => screen.getByText('Amazing tomatoes!'));
    const deleteButtons = screen.getAllByRole('button', { name: /🗑️/i });
    await act(async () => { fireEvent.click(deleteButtons[0]); });
    expect(axios.delete).not.toHaveBeenCalled();
  });

  it('shows error toast when delete fails', async () => {
    window.confirm = jest.fn().mockReturnValue(true);
    axios.delete.mockRejectedValue(new Error('Server error'));
    useAuth.mockReturnValue({ isAuthenticated: true, user: { _id: 'u1', name: 'Alice', role: 'consumer' } });
    renderPage();
    await waitFor(() => screen.getByText('Amazing tomatoes!'));
    const deleteButtons = screen.getAllByRole('button', { name: /🗑️/i });
    await act(async () => { fireEvent.click(deleteButtons[0]); });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to delete review'));
  });
});
