import React, { useEffect, useState } from 'react';
import axios from '../utils/axios';
import './OrdersPage.css';

const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/orders/myorders')
      .then(res => { setOrders(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading orders...</div>;

  return (
    <div className="container orders-page">
      <h1>My Orders</h1>
      {orders.length === 0 ? (
        <div className="empty-state"><p>No orders yet. Start shopping!</p></div>
      ) : (
        orders.map(order => (
          <div key={order._id} className="order-card card">
            <div className="order-header">
              <div>
                <p className="order-id">Order #{order._id.slice(-8).toUpperCase()}</p>
                <p className="order-date">{new Date(order.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="order-badges">
                <span className={`badge ${order.isPaid ? 'badge-green' : 'badge-orange'}`}>
                  {order.isPaid ? '✅ Paid' : '⏳ Pending'}
                </span>
                <span className="badge badge-green">{order.status}</span>
              </div>
            </div>
            <div className="order-items">
              {order.items.map((item, i) => (
                <div key={i} className="order-item">
                  <img src={item.image} alt={item.name} />
                  <span>{item.name} × {item.quantity}</span>
                  <span>${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="order-total">
              <strong>Total: ${order.totalPrice.toFixed(2)}</strong>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default OrdersPage;
