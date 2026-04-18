import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import './CartPage.css';

const CartPage = () => {
  const { items, removeFromCart, updateQuantity, totalPrice, clearCart } = useCart();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleCheckout = () => {
    if (!isAuthenticated) { toast.error('Please login first'); navigate('/login'); return; }
    navigate('/checkout');
  };

  if (items.length === 0) return (
    <div className="empty-cart">
      <h2>🛒 Your cart is empty</h2>
      <p>Add some fresh products to get started!</p>
      <Link to="/shop" className="btn-primary">Shop Now</Link>
    </div>
  );

  return (
    <div className="container cart-page">
      <h1>Shopping Cart</h1>
      <div className="cart-layout">
        <div className="cart-items">
          {items.map(item => (
            <div key={item._id} className="cart-item card">
              <img src={item.image} alt={item.name} />
              <div className="item-info">
                <h3>{item.name}</h3>
                <p className="item-price">${item.price}/{item.unit}</p>
              </div>
              <div className="item-qty">
                <button onClick={() => updateQuantity(item._id, Math.max(1, item.quantity - 1))}>-</button>
                <span>{item.quantity}</span>
                <button onClick={() => updateQuantity(item._id, item.quantity + 1)}>+</button>
              </div>
              <p className="item-total">${(item.price * item.quantity).toFixed(2)}</p>
              <button onClick={() => removeFromCart(item._id)} className="remove-btn">✕</button>
            </div>
          ))}
          <button onClick={clearCart} className="btn-outline clear-btn">Clear Cart</button>
        </div>
        <div className="cart-summary card">
          <h3>Order Summary</h3>
          <div className="summary-row"><span>Subtotal</span><span>${totalPrice.toFixed(2)}</span></div>
          <div className="summary-row"><span>Shipping</span><span>{totalPrice > 50 ? 'FREE' : '$5.99'}</span></div>
          <div className="summary-row"><span>Tax (8%)</span><span>${(totalPrice * 0.08).toFixed(2)}</span></div>
          <div className="summary-total">
            <span>Total</span>
            <span>${(totalPrice + (totalPrice > 50 ? 0 : 5.99) + totalPrice * 0.08).toFixed(2)}</span>
          </div>
          <button onClick={handleCheckout} className="btn-primary checkout-btn">Proceed to Checkout</button>
        </div>
      </div>
    </div>
  );
};

export default CartPage;
