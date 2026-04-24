import React from 'react';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import OrdersPage from '../pages/OrdersPage';

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

const axios = require('../utils/axios');
const toast = require('react-hot-toast');

const renderPage = () =>
  render(<MemoryRouter><OrdersPage /></MemoryRouter>);

const makeOrder = (overrides = {}) => ({
  _id: 'ord111aabbcc',
  createdAt: '2026-01-20T10:00:00Z',
  isPaid: true,
  paidAt: '2026-01-20T10:05:00Z',
  status: 'pending',
  subtotal: 5.98,
  shippingPrice: 0,
  tax: 0.48,
  totalPrice: 6.46,
  items: [
    { name: 'Tomatoes', image: 'https://example.com/tom.jpg', price: 2.99, quantity: 2 },
    { name: 'Broccoli', image: 'https://example.com/brc.jpg', price: 3.00, quantity: 1 },
  ],
  shippingAddress: { street: '123 Main St', city: 'Austin', state: 'TX', zipCode: '78701', country: 'USA' },
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  // default: return one pending order
  axios.get.mockResolvedValue({ data: [makeOrder()] });
  axios.put.mockResolvedValue({ data: makeOrder({ status: 'cancelled' }) });
});

// ── Loading & empty ────────────────────────────────────────────────────────
describe('OrdersPage – loading and empty states', () => {
  it('shows loading state initially', () => {
    axios.get.mockImplementation(() => new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/loading orders/i)).toBeInTheDocument();
  });

  it('shows empty state message when user has no orders', async () => {
    axios.get.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => screen.getByText(/no orders yet/i));
    expect(screen.getByText(/no orders yet/i)).toBeInTheDocument();
  });

  it('shows correct total order count in subtitle', async () => {
    axios.get.mockResolvedValue({ data: [makeOrder(), makeOrder({ _id: 'ord222' })] });
    renderPage();
    await waitFor(() => screen.getByText(/2 total orders/i));
    expect(screen.getByText(/2 total orders/i)).toBeInTheDocument();
  });
});

// ── Order card rendering ───────────────────────────────────────────────────
describe('OrdersPage – order card', () => {
  it('shows the order ID', async () => {
    renderPage();
    await waitFor(() => screen.getByText(/AABBCC/i));
    expect(screen.getByText(/AABBCC/i)).toBeInTheDocument();
  });

  it('shows paid badge when order is paid', async () => {
    renderPage();
    await waitFor(() => screen.getByText(/✅ Paid/));
    expect(screen.getByText(/✅ Paid/)).toBeInTheDocument();
  });

  it('shows unpaid badge when order is not paid', async () => {
    axios.get.mockResolvedValue({ data: [makeOrder({ isPaid: false })] });
    renderPage();
    await waitFor(() => screen.getByText(/⏳ Unpaid/));
    expect(screen.getByText(/⏳ Unpaid/)).toBeInTheDocument();
  });

  it('shows order total in header', async () => {
    renderPage();
    await waitFor(() => screen.getByText('$6.46'));
    expect(screen.getByText('$6.46')).toBeInTheDocument();
  });

  it('shows item preview in collapsed state', async () => {
    renderPage();
    await waitFor(() => screen.getByText(/Tomatoes × 2/));
    expect(screen.getByText(/Tomatoes × 2/)).toBeInTheDocument();
  });
});

// ── Expand / collapse ──────────────────────────────────────────────────────
describe('OrdersPage – expand order details', () => {
  const expandOrder = async () => {
    await waitFor(() => screen.getByText(/AABBCC/i));
    fireEvent.click(screen.getByText(/AABBCC/i).closest('.order-header'));
    await waitFor(() => screen.getByText('Items Ordered'));
  };

  it('expands on header click and shows shipping address', async () => {
    renderPage();
    await expandOrder();
    expect(screen.getByText('123 Main St')).toBeInTheDocument();
  });

  it('shows order summary breakdown when expanded', async () => {
    renderPage();
    await expandOrder();
    expect(screen.getByText('Order Summary')).toBeInTheDocument();
    expect(screen.getByText('Subtotal')).toBeInTheDocument();
    expect(screen.getByText('Shipping')).toBeInTheDocument();
    expect(screen.getByText('Tax')).toBeInTheDocument();
  });

  it('shows item list with quantities when expanded', async () => {
    renderPage();
    await expandOrder();
    expect(screen.getByText('Tomatoes')).toBeInTheDocument();
    expect(screen.getByText('Broccoli')).toBeInTheDocument();
  });

  it('collapses again on second click', async () => {
    renderPage();
    await expandOrder();
    fireEvent.click(screen.getByText(/AABBCC/i).closest('.order-header'));
    await waitFor(() => expect(screen.queryByText('Items Ordered')).not.toBeInTheDocument());
  });
});

// ── Status tracker ─────────────────────────────────────────────────────────
describe('OrdersPage – status tracker', () => {
  const expandOrder = async () => {
    await waitFor(() => screen.getByText(/AABBCC/i));
    fireEvent.click(screen.getByText(/AABBCC/i).closest('.order-header'));
    await waitFor(() => screen.getByText('Items Ordered'));
  };

  it('shows tracker steps for a non-cancelled order', async () => {
    axios.get.mockResolvedValue({ data: [makeOrder({ status: 'processing' })] });
    renderPage();
    await expandOrder();
    // Multiple elements may contain "Processing" (filter tab + tracker label)
    expect(screen.getAllByText('Processing').length).toBeGreaterThanOrEqual(1);
    // "Shipped" only appears in the tracker
    expect(screen.getByText('Shipped')).toBeInTheDocument();
  });

  it('shows cancelled banner instead of tracker for cancelled orders', async () => {
    axios.get.mockResolvedValue({ data: [makeOrder({ status: 'cancelled' })] });
    renderPage();
    await expandOrder();
    await waitFor(() => screen.getByText(/This order was cancelled/i));
    expect(screen.getByText(/This order was cancelled/i)).toBeInTheDocument();
  });
});

// ── Cancel order ───────────────────────────────────────────────────────────
describe('OrdersPage – cancel order', () => {
  const expandOrder = async () => {
    await waitFor(() => screen.getByText(/AABBCC/i));
    fireEvent.click(screen.getByText(/AABBCC/i).closest('.order-header'));
    await waitFor(() => screen.getByText('Items Ordered'));
  };

  it('shows Cancel button for pending orders when expanded', async () => {
    renderPage();
    await expandOrder();
    expect(screen.getByText('Cancel Order')).toBeInTheDocument();
  });

  it('shows Cancel button for processing orders when expanded', async () => {
    axios.get.mockResolvedValue({ data: [makeOrder({ status: 'processing' })] });
    renderPage();
    await expandOrder();
    expect(screen.getByText('Cancel Order')).toBeInTheDocument();
  });

  it('does NOT show Cancel button for shipped orders', async () => {
    axios.get.mockResolvedValue({ data: [makeOrder({ status: 'shipped' })] });
    renderPage();
    await expandOrder();
    expect(screen.queryByText('Cancel Order')).not.toBeInTheDocument();
  });

  it('does NOT show Cancel button for delivered orders', async () => {
    axios.get.mockResolvedValue({ data: [makeOrder({ status: 'delivered' })] });
    renderPage();
    await expandOrder();
    expect(screen.queryByText('Cancel Order')).not.toBeInTheDocument();
  });

  it('calls cancel API and shows success toast when confirmed', async () => {
    window.confirm = jest.fn().mockReturnValue(true);
    renderPage();
    await expandOrder();
    await act(async () => { fireEvent.click(screen.getByText('Cancel Order')); });
    expect(axios.put).toHaveBeenCalledWith('/api/orders/ord111aabbcc/cancel');
    expect(toast.success).toHaveBeenCalledWith('Order cancelled');
  });

  it('does not call cancel API when user cancels the confirmation', async () => {
    window.confirm = jest.fn().mockReturnValue(false);
    renderPage();
    await expandOrder();
    await act(async () => { fireEvent.click(screen.getByText('Cancel Order')); });
    expect(axios.put).not.toHaveBeenCalled();
  });

  it('shows error toast if cancel API fails', async () => {
    window.confirm = jest.fn().mockReturnValue(true);
    axios.put.mockRejectedValue({ response: { data: { message: 'Cannot cancel shipped order' } } });
    renderPage();
    await expandOrder();
    await act(async () => { fireEvent.click(screen.getByText('Cancel Order')); });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Cannot cancel shipped order'));
  });
});

// ── Polling for order status updates ──────────────────────────────────────
describe('OrdersPage — polling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('polls the API every 30 seconds when active orders exist', async () => {
    renderPage();
    await waitFor(() => screen.getByText(/AABBCC/i));

    const callsBefore = axios.get.mock.calls.length;

    await act(async () => { jest.advanceTimersByTime(30000); });
    await waitFor(() => expect(axios.get.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it('does not poll when all orders are delivered', async () => {
    axios.get.mockResolvedValue({ data: [makeOrder({ status: 'delivered' })] });
    renderPage();
    await waitFor(() => screen.getByText(/AABBCC/i));

    const callsBefore = axios.get.mock.calls.length;
    act(() => { jest.advanceTimersByTime(60000); });

    // No additional calls because all orders are terminal
    expect(axios.get.mock.calls.length).toBe(callsBefore);
  });

  it('does not poll when all orders are cancelled', async () => {
    axios.get.mockResolvedValue({ data: [makeOrder({ status: 'cancelled' })] });
    renderPage();
    await waitFor(() => screen.getByText(/AABBCC/i));

    const callsBefore = axios.get.mock.calls.length;
    act(() => { jest.advanceTimersByTime(60000); });

    expect(axios.get.mock.calls.length).toBe(callsBefore);
  });
});

// ── Filter tabs ────────────────────────────────────────────────────────────
describe('OrdersPage – filter tabs', () => {
  it('shows All tab', async () => {
    renderPage();
    await waitFor(() => screen.getByText(/AABBCC/i));
    expect(screen.getByRole('button', { name: /^All/ })).toBeInTheDocument();
  });

  it('filters to show only delivered orders', async () => {
    axios.get.mockResolvedValue({
      data: [
        makeOrder({ _id: 'ord111aabbcc', status: 'pending' }),
        makeOrder({ _id: 'ord222ddeeff', status: 'delivered' }),
      ]
    });
    renderPage();
    await waitFor(() => screen.getAllByText(/Order #/i));
    fireEvent.click(screen.getByRole('button', { name: /^Delivered/ }));
    await waitFor(() => expect(screen.queryByText(/AABBCC/i)).not.toBeInTheDocument());
    expect(screen.getByText(/DDEEFF/i)).toBeInTheDocument();
  });

  it('shows filter tab only for statuses that have at least one order', async () => {
    renderPage();
    await waitFor(() => screen.getByText(/AABBCC/i));
    // Only Pending tab should appear (other statuses have 0 orders)
    expect(screen.queryByRole('button', { name: /^Delivered/ })).not.toBeInTheDocument();
  });
});
