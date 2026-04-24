import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import axios from '../utils/axios';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import AddressAutocomplete from '../components/common/AddressAutocomplete';
import toast from 'react-hot-toast';
import './CheckoutPage.css';

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);

const CheckoutForm = () => {
  const stripe = useStripe();
  const elements = useElements();
  const { items, totalPrice, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState({
    street: '', city: '', state: '', zipCode: '', country: 'USA'
  });
  const [addressValidated, setAddressValidated] = useState(false);

  const shipping = totalPrice > 50 ? 0 : 5.99;
  const tax = totalPrice * 0.08;
  const total = totalPrice + shipping + tax;

  const handleAddressSelect = (addr) => {
    setAddress(addr);
    setAddressValidated(true);
    toast.success('Address verified! ✅');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!addressValidated) { toast.error('Please select a valid address from suggestions'); return; }
    if (!stripe || !elements) return;
    setLoading(true);
    try {
      const { data } = await axios.post('/api/payment/create-payment-intent', { amount: total });
      const result = await stripe.confirmCardPayment(data.clientSecret, {
        payment_method: { card: elements.getElement(CardElement) }
      });
      if (result.error) { toast.error(result.error.message); setLoading(false); return; }
      const orderData = {
        items: items.map(i => ({ product: i._id, name: i.name, image: i.image, price: i.price, quantity: i.quantity })),
        shippingAddress: address,
        subtotal: totalPrice, shippingPrice: shipping, tax, totalPrice: total
      };
      const { data: order } = await axios.post('/api/orders', orderData);
      await axios.put(`/api/orders/${order._id}/pay`, {
        id: result.paymentIntent.id, status: result.paymentIntent.status, email: user?.email || ''
      });
      clearCart();
      toast.success('Order placed! 🎉');
      navigate('/orders');
    } catch (err) {
      toast.error('Payment failed. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="checkout-form">
      <div className="checkout-layout">
        <div className="checkout-left">
          <div className="checkout-section card">
            <h3>📦 Shipping Address</h3>
            <p className="addr-hint">Type your address below and select from suggestions for validation</p>
            <AddressAutocomplete onAddressSelect={handleAddressSelect} />
            {addressValidated && (
              <div className="addr-confirmed">
                <p>✅ <strong>{address.street}</strong></p>
                <p>{address.city}, {address.state} {address.zipCode}</p>
                <p>{address.country}</p>
              </div>
            )}
          </div>
          <div className="checkout-section card">
            <h3>💳 Payment Details</h3>
            <p className="stripe-note">🔒 Secured by Stripe</p>
            <div className="card-element-wrapper">
              <CardElement options={{ style: { base: { fontSize: '16px', color: '#1b1b1b', fontFamily: 'DM Sans, sans-serif', '::placeholder': { color: '#adb5bd' } } } }} />
            </div>
          </div>
        </div>
        <div className="checkout-right">
          <div className="card order-review">
            <h3>🛒 Order Review</h3>
            {items.map(item => (
              <div key={item._id} className="review-item">
                <img src={item.image} alt={item.name} />
                <div><p>{item.name}</p><p className="review-qty">× {item.quantity}</p></div>
                <span>${(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            <div className="review-totals">
              <div className="summary-row"><span>Subtotal</span><span>${totalPrice.toFixed(2)}</span></div>
              <div className="summary-row"><span>Shipping</span><span>{shipping === 0 ? 'FREE' : `$${shipping}`}</span></div>
              <div className="summary-row"><span>Tax</span><span>${tax.toFixed(2)}</span></div>
              <div className="summary-total"><span>Total</span><span>${total.toFixed(2)}</span></div>
            </div>
            <button type="submit" className="btn-primary pay-btn" disabled={loading || !stripe}>
              {loading ? '⏳ Processing...' : `🔒 Pay $${total.toFixed(2)}`}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};

const CheckoutPage = () => (
  <div>
    <div className="page-header"><h1>Checkout</h1><p>Complete your order securely</p></div>
    <div className="container" style={{ padding: '40px 20px' }}>
      <Elements stripe={stripePromise}><CheckoutForm /></Elements>
    </div>
  </div>
);

export default CheckoutPage;
