import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { CartProvider, useCart } from '../context/CartContext';

const apple = { _id: 'p1', name: 'Apple', price: 1.99, image: 'apple.jpg', stock: 10 };
const banana = { _id: 'p2', name: 'Banana', price: 0.99, image: 'banana.jpg', stock: 5 };

const TestCart = () => {
  const { items, addToCart, removeFromCart, updateQuantity, clearCart, totalItems, totalPrice } = useCart();
  return (
    <div>
      <span data-testid="count">{totalItems}</span>
      <span data-testid="total">{totalPrice.toFixed(2)}</span>
      {items.map(item => (
        <div key={item._id}>
          <span data-testid={`item-${item._id}`}>{item.name} x{item.quantity}</span>
          <button onClick={() => removeFromCart(item._id)}>Remove {item.name}</button>
          <button onClick={() => updateQuantity(item._id, item.quantity + 1)}>More {item.name}</button>
          <button onClick={() => updateQuantity(item._id, item.quantity - 1)}>Less {item.name}</button>
        </div>
      ))}
      <button onClick={() => addToCart(apple)}>Add Apple</button>
      <button onClick={() => addToCart(banana)}>Add Banana</button>
      <button onClick={clearCart}>Clear</button>
    </div>
  );
};

beforeEach(() => localStorage.clear());

describe('CartContext', () => {
  it('initialises with an empty cart', () => {
    render(<CartProvider><TestCart /></CartProvider>);
    expect(screen.getByTestId('count')).toHaveTextContent('0');
    expect(screen.getByTestId('total')).toHaveTextContent('0.00');
  });

  it('adds an item and shows it in the cart', async () => {
    render(<CartProvider><TestCart /></CartProvider>);
    await act(async () => { screen.getByRole('button', { name: 'Add Apple' }).click(); });
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(screen.getByTestId('item-p1')).toHaveTextContent('Apple x1');
  });

  it('increments quantity when the same item is added twice', async () => {
    render(<CartProvider><TestCart /></CartProvider>);
    await act(async () => { screen.getByRole('button', { name: 'Add Apple' }).click(); });
    await act(async () => { screen.getByRole('button', { name: 'Add Apple' }).click(); });
    expect(screen.getByTestId('item-p1')).toHaveTextContent('Apple x2');
    expect(screen.getByTestId('count')).toHaveTextContent('2');
  });

  it('removes an item completely', async () => {
    render(<CartProvider><TestCart /></CartProvider>);
    await act(async () => { screen.getByRole('button', { name: 'Add Apple' }).click(); });
    await act(async () => { screen.getByRole('button', { name: 'Remove Apple' }).click(); });
    expect(screen.getByTestId('count')).toHaveTextContent('0');
    expect(screen.queryByTestId('item-p1')).not.toBeInTheDocument();
  });

  it('updateQuantity increases item count', async () => {
    render(<CartProvider><TestCart /></CartProvider>);
    await act(async () => { screen.getByRole('button', { name: 'Add Apple' }).click(); });
    await act(async () => { screen.getByRole('button', { name: 'More Apple' }).click(); });
    expect(screen.getByTestId('item-p1')).toHaveTextContent('Apple x2');
    expect(screen.getByTestId('count')).toHaveTextContent('2');
  });

  it('updateQuantity decreases item count', async () => {
    render(<CartProvider><TestCart /></CartProvider>);
    await act(async () => { screen.getByRole('button', { name: 'Add Apple' }).click(); });
    await act(async () => { screen.getByRole('button', { name: 'More Apple' }).click(); });
    await act(async () => { screen.getByRole('button', { name: 'Less Apple' }).click(); });
    expect(screen.getByTestId('item-p1')).toHaveTextContent('Apple x1');
  });

  it('calculates total price correctly for multiple items', async () => {
    render(<CartProvider><TestCart /></CartProvider>);
    await act(async () => { screen.getByRole('button', { name: 'Add Apple' }).click(); });
    await act(async () => { screen.getByRole('button', { name: 'Add Banana' }).click(); });
    expect(screen.getByTestId('total')).toHaveTextContent((1.99 + 0.99).toFixed(2));
  });

  it('clearCart removes all items', async () => {
    render(<CartProvider><TestCart /></CartProvider>);
    await act(async () => { screen.getByRole('button', { name: 'Add Apple' }).click(); });
    await act(async () => { screen.getByRole('button', { name: 'Add Banana' }).click(); });
    await act(async () => { screen.getByRole('button', { name: 'Clear' }).click(); });
    expect(screen.getByTestId('count')).toHaveTextContent('0');
    expect(screen.getByTestId('total')).toHaveTextContent('0.00');
  });

  it('persists cart to localStorage on change', async () => {
    render(<CartProvider><TestCart /></CartProvider>);
    await act(async () => { screen.getByRole('button', { name: 'Add Apple' }).click(); });
    const stored = JSON.parse(localStorage.getItem('cart'));
    expect(stored).toHaveLength(1);
    expect(stored[0]._id).toBe('p1');
    expect(stored[0].quantity).toBe(1);
  });

  it('loads cart from localStorage on mount', () => {
    localStorage.setItem('cart', JSON.stringify([{ ...apple, quantity: 3 }]));
    render(<CartProvider><TestCart /></CartProvider>);
    expect(screen.getByTestId('count')).toHaveTextContent('3');
    expect(screen.getByTestId('item-p1')).toHaveTextContent('Apple x3');
  });
});
