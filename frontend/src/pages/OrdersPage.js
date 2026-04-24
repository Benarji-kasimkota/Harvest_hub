import React, { useEffect, useRef, useState } from 'react';
import axios from '../utils/axios';
import toast from 'react-hot-toast';
import './OrdersPage.css';

const STATUS_STEPS = ['pending', 'processing', 'shipped', 'out_for_delivery', 'delivered'];

const STATUS_LABELS = {
  pending: 'Pending',
  processing: 'Processing',
  shipped: 'Shipped',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const STATUS_ICONS = {
  pending: '⏳',
  processing: '⚙️',
  shipped: '📦',
  out_for_delivery: '🚚',
  delivered: '✅',
  cancelled: '❌',
};

const canCancel = (status) => ['pending', 'processing'].includes(status);

const StatusTracker = ({ status }) => {
  if (status === 'cancelled') {
    return <div className="status-cancelled-banner">❌ This order was cancelled</div>;
  }
  const currentIdx = STATUS_STEPS.indexOf(status);
  return (
    <div className="status-tracker">
      {STATUS_STEPS.map((step, i) => (
        <React.Fragment key={step}>
          <div className={`tracker-step ${i <= currentIdx ? 'done' : ''} ${i === currentIdx ? 'active' : ''}`}>
            <div className="tracker-dot">{i < currentIdx ? '✓' : STATUS_ICONS[step]}</div>
            <span className="tracker-label">{STATUS_LABELS[step]}</span>
          </div>
          {i < STATUS_STEPS.length - 1 && (
            <div className={`tracker-line ${i < currentIdx ? 'done' : ''}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

const OrderCard = ({ order, onCancel }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`order-card card ${expanded ? 'expanded' : ''}`}>
      <div className="order-header" onClick={() => setExpanded(e => !e)}>
        <div>
          <p className="order-id">Order #{order._id.slice(-8).toUpperCase()}</p>
          <p className="order-date">{new Date(order.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
        </div>
        <div className="order-header-right">
          <div className="order-badges">
            <span className={`badge ${order.isPaid ? 'badge-green' : 'badge-orange'}`}>
              {order.isPaid ? '✅ Paid' : '⏳ Unpaid'}
            </span>
            <span className={`status-badge-pill status-${order.status}`}>
              {STATUS_ICONS[order.status]} {STATUS_LABELS[order.status]}
            </span>
          </div>
          <span className="order-total-preview">${order.totalPrice.toFixed(2)}</span>
          <span className="expand-icon">{expanded ? '▲' : '▼'}</span>
        </div>
      </div>

      {/* Collapsed preview */}
      {!expanded && (
        <div className="order-items-preview">
          {order.items.slice(0, 3).map((item, i) => (
            <div key={i} className="order-item-preview">
              <img src={item.image} alt={item.name} onError={e => { e.target.src = 'https://via.placeholder.com/40'; }} />
              <span>{item.name} × {item.quantity}</span>
            </div>
          ))}
          {order.items.length > 3 && <span className="more-items">+{order.items.length - 3} more</span>}
        </div>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div className="order-detail-expanded">
          <StatusTracker status={order.status} />

          <div className="order-detail-grid">
            <div className="order-items-full">
              <h4>Items Ordered</h4>
              {order.items.map((item, i) => (
                <div key={i} className="order-item-row">
                  <img src={item.image} alt={item.name} onError={e => { e.target.src = 'https://via.placeholder.com/56'; }} />
                  <div className="item-info">
                    <span className="item-name">{item.name}</span>
                    <span className="item-qty">Qty: {item.quantity}</span>
                  </div>
                  <span className="item-price">${(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>

            <div className="order-summary-col">
              <div className="order-summary-box">
                <h4>Order Summary</h4>
                <div className="summary-line">
                  <span>Subtotal</span>
                  <span>${order.subtotal?.toFixed(2) ?? (order.totalPrice - (order.shippingPrice || 0) - (order.tax || 0)).toFixed(2)}</span>
                </div>
                <div className="summary-line">
                  <span>Shipping</span>
                  <span>{order.shippingPrice === 0 ? 'Free' : `$${order.shippingPrice?.toFixed(2)}`}</span>
                </div>
                <div className="summary-line">
                  <span>Tax</span>
                  <span>${order.tax?.toFixed(2)}</span>
                </div>
                <div className="summary-line total-line">
                  <span>Total</span>
                  <span>${order.totalPrice.toFixed(2)}</span>
                </div>
              </div>

              {order.shippingAddress && (
                <div className="shipping-address-box">
                  <h4>Delivery Address</h4>
                  <p>{order.shippingAddress.street}</p>
                  <p>{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}</p>
                  <p>{order.shippingAddress.country}</p>
                </div>
              )}

              <div className="order-dates">
                <p><strong>Ordered:</strong> {new Date(order.createdAt).toLocaleString()}</p>
                {order.isPaid && order.paidAt && <p><strong>Paid:</strong> {new Date(order.paidAt).toLocaleString()}</p>}
                {order.isDelivered && order.deliveredAt && <p><strong>Delivered:</strong> {new Date(order.deliveredAt).toLocaleString()}</p>}
              </div>

              {canCancel(order.status) && (
                <button
                  className="btn-cancel-order"
                  onClick={() => onCancel(order._id)}
                >
                  Cancel Order
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const POLL_INTERVAL = 30000;

const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const ordersRef = useRef([]);

  const fetchOrders = (silent = false) => {
    if (!silent) setLoading(true);
    axios.get('/api/orders/myorders')
      .then(res => {
        ordersRef.current = res.data;
        setOrders(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(() => {
      const hasActive = ordersRef.current.some(o =>
        !['delivered', 'cancelled'].includes(o.status)
      );
      if (hasActive) fetchOrders(true);
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCancel = async (orderId) => {
    if (!window.confirm('Cancel this order?')) return;
    try {
      const res = await axios.put(`/api/orders/${orderId}/cancel`);
      setOrders(prev => prev.map(o => o._id === orderId ? res.data : o));
      toast.success('Order cancelled');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel order');
    }
  };

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);
  const getCount = (s) => orders.filter(o => o.status === s).length;

  if (loading) return <div className="loading">Loading orders...</div>;

  return (
    <div className="container orders-page">
      <h1>My Orders</h1>
      <p className="orders-subtitle">{orders.length} total order{orders.length !== 1 ? 's' : ''} &bull; Click any order to expand details</p>

      <div className="orders-filter-tabs">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
          All <span className="fc">{orders.length}</span>
        </button>
        {['pending', 'processing', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'].map(s => (
          getCount(s) > 0 && (
            <button key={s} className={filter === s ? 'active' : ''} onClick={() => setFilter(s)}>
              {STATUS_LABELS[s]} <span className="fc">{getCount(s)}</span>
            </button>
          )
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: '2rem' }}>📦</p>
          <p>{filter === 'all' ? 'No orders yet. Start shopping!' : `No ${STATUS_LABELS[filter]} orders.`}</p>
        </div>
      ) : (
        filtered.map(order => (
          <OrderCard key={order._id} order={order} onCancel={handleCancel} />
        ))
      )}
    </div>
  );
};

export default OrdersPage;
