import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import axios from '../utils/axios';
import toast from 'react-hot-toast';
import './CartPage.css';

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const AICartInsights = ({ items }) => {
  const [tab, setTab] = useState(null);
  const [data, setData] = useState({});
  const [loading, setLoading] = useState('');

  const fetchInsight = async (type) => {
    if (data[type]) { setTab(type); return; }
    setLoading(type);
    try {
      const endpoint = type === 'recipes' ? '/api/ai/recipes' : '/api/ai/freshness';
      const res = await axios.post(endpoint, { items });
      setData(prev => ({ ...prev, [type]: res.data }));
      setTab(type);
    } catch (err) {
      if (err.response?.data?.demo) toast.error('AI key not configured yet');
      else toast.error('Failed to load AI insights');
    } finally { setLoading(''); }
  };

  return (
    <div className="ai-cart-insights card">
      <p className="ai-insights-title">✨ AI Cart Insights</p>
      <div className="ai-cart-tabs">
        <button className={tab === 'recipes' ? 'active' : ''} onClick={() => fetchInsight('recipes')} disabled={loading === 'recipes'}>
          {loading === 'recipes' ? '...' : '🍳 Recipe Ideas'}
        </button>
        <button className={tab === 'freshness' ? 'active' : ''} onClick={() => fetchInsight('freshness')} disabled={loading === 'freshness'}>
          {loading === 'freshness' ? '...' : '🌿 Freshness Guide'}
        </button>
      </div>

      {tab === 'recipes' && data.recipes && (
        <div className="ai-cart-content">
          {data.recipes.recipes?.map((r, i) => (
            <div key={i} className="recipe-card">
              <div className="recipe-header">
                <strong>{r.name}</strong>
                <span className="recipe-meta">{r.cookTime} · {r.difficulty}</span>
              </div>
              <p className="recipe-uses">Uses: {r.usesFromCart?.join(', ')}</p>
              {r.missingIngredients?.length > 0 && (
                <p className="recipe-missing">+ Need: {r.missingIngredients.join(', ')}</p>
              )}
              <ol className="recipe-steps">{r.steps?.slice(0,3).map((s,j) => <li key={j}>{s}</li>)}</ol>
            </div>
          ))}
        </div>
      )}

      {tab === 'freshness' && data.freshness && (
        <div className="ai-cart-content">
          {data.freshness.items?.map((item, i) => (
            <div key={i} className="freshness-row">
              <span className="freshness-name">{item.name}</span>
              <span className="freshness-days">🗓 {item.shelfLifeDays} days</span>
              <span className="freshness-tip">{item.storageMethod}</span>
            </div>
          ))}
          {data.freshness.generalTip && <p className="freshness-general">💡 {data.freshness.generalTip}</p>}
        </div>
      )}
    </div>
  );
};

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
          {isAuthenticated && <AICartInsights items={items} />}
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
