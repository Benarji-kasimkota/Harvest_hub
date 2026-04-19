import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import './CartPage.css';

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const CartPage = () => {
  const { items, removeFromCart, updateQuantity, totalPrice, clearCart } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleCheckout = () => {
    if (!isAuthenticated) { toast.error('Please login first'); navigate('/login'); return; }
    navigate('/checkout');
  };

  const handleRemove = (item) => {
    removeFromCart(item._id);
    toast.success(`${item.name} removed from cart`);
  };

  if (items.length === 0) return (
    <div className="empty-cart">
      <div className="empty-cart-icon">🛒</div>
      <h2>Your cart is empty</h2>
      <p>Add some fresh products to get started!</p>
      <Link to="/shop" className="btn-primary">Shop Now</Link>
    </div>
  );

  return (
    <div className="container cart-page">
      <h1>Shopping Cart <span className="cart-count">({items.length} items)</span></h1>
      <div className="cart-layout">
        <div className="cart-items">
          {items.map(item => (
            <div key={item._id} className="cart-item card">
              <img src={item.image} alt={item.name} />
              <div className="item-info">
                <h3>{item.name}</h3>
                <p className="item-category">{item.category}</p>
                <p className="item-price">${item.price}/{item.unit}</p>
              </div>
              <div className="item-qty">
                <button onClick={() => updateQuantity(item._id, Math.max(1, item.quantity - 1))}>−</button>
                <span>{item.quantity}</span>
                <button onClick={() => updateQuantity(item._id, item.quantity + 1)}>+</button>
              </div>
              <p className="item-total">${(item.price * item.quantity).toFixed(2)}</p>
              <button onClick={() => handleRemove(item)} className="remove-btn" title="Remove item">
                <TrashIcon />
              </button>
            </div>
          ))}
          <button onClick={() => { clearCart(); toast.success('Cart cleared!'); }} className="btn-outline clear-btn">
            🗑️ Clear Cart
          </button>
        </div>
        <div className="cart-summary card">
          <h3>Order Summary</h3>
          <div className="summary-row"><span>Subtotal</span><span>${totalPrice.toFixed(2)}</span></div>
          <div className="summary-row"><span>Shipping</span><span>{totalPrice > 50 ? '🎉 FREE' : '$5.99'}</span></div>
          <div className="summary-row"><span>Tax (8%)</span><span>${(totalPrice * 0.08).toFixed(2)}</span></div>
          {totalPrice < 50 && (
            <div className="free-shipping-bar">
              <p>Add <strong>${(50 - totalPrice).toFixed(2)}</strong> more for free shipping!</p>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${Math.min((totalPrice / 50) * 100, 100)}%` }} />
              </div>
            </div>
          )}
          <div className="summary-total">
            <span>Total</span>
            <span>${(totalPrice + (totalPrice > 50 ? 0 : 5.99) + totalPrice * 0.08).toFixed(2)}</span>
          </div>
          <button onClick={handleCheckout} className="btn-primary checkout-btn">
            Proceed to Checkout →
          </button>
          <Link to="/shop" className="continue-shopping">← Continue Shopping</Link>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
