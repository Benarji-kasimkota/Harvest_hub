import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from '../../utils/axios';
import toast from 'react-hot-toast';
import DeliveryAITools from './DeliveryAITools';
import './DeliveryDashboard.css';

// ─── Overview ───────────────────────────────────────────────
const Overview = () => {
  const [stats, setStats] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    axios.get('/api/delivery/dashboard').then(r => setStats(r.data)).catch(() => {});
  }, []);

  return (
    <div className="delivery-overview">
      <div className="delivery-welcome">
        <div>
          <h2>Hey, {user?.name}! 🚚</h2>
          <p>Here's your delivery performance</p>
        </div>
        <div className="availability-toggle">
          <span>{stats?.activeDeliveries > 0 ? '🟢 On Delivery' : '⚪ Available'}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="delivery-stats">
        <div className="d-stat green">
          <span className="d-icon">💰</span>
          <p className="d-value">${(stats?.totalEarnings || 0).toFixed(2)}</p>
          <p className="d-label">Total Earnings</p>
        </div>
        <div className="d-stat blue">
          <span className="d-icon">🚚</span>
          <p className="d-value">{stats?.totalDeliveries || 0}</p>
          <p className="d-label">Deliveries Done</p>
        </div>
        <div className="d-stat orange">
          <span className="d-icon">⭐</span>
          <p className="d-value">${(stats?.totalTips || 0).toFixed(2)}</p>
          <p className="d-label">Total Tips</p>
        </div>
        <div className="d-stat purple">
          <span className="d-icon">📦</span>
          <p className="d-value">{stats?.activeDeliveries || 0}</p>
          <p className="d-label">Active Now</p>
        </div>
      </div>

      {/* Earnings breakdown */}
      <div className="earnings-breakdown">
        <h3>💵 Earnings Breakdown</h3>
        <div className="breakdown-note">
          Base pay: <strong>$5.00 per delivery</strong> + tips from customers
        </div>
        <div className="breakdown-cards">
          <div className="breakdown-card">
            <p className="bc-label">Base Pay</p>
            <p className="bc-value">${(stats?.totalBasePay || 0).toFixed(2)}</p>
            <p className="bc-hint">{stats?.totalDeliveries || 0} × $5.00</p>
          </div>
          <div className="breakdown-plus">+</div>
          <div className="breakdown-card tips">
            <p className="bc-label">Tips Received</p>
            <p className="bc-value tips-value">${(stats?.totalTips || 0).toFixed(2)}</p>
            <p className="bc-hint">From happy customers</p>
          </div>
          <div className="breakdown-plus">=</div>
          <div className="breakdown-card total">
            <p className="bc-label">Total Earnings</p>
            <p className="bc-value total-value">${(stats?.totalEarnings || 0).toFixed(2)}</p>
            <p className="bc-hint">All time</p>
          </div>
        </div>
      </div>

      {/* Monthly Stats */}
      {stats?.monthlyStats && Object.keys(stats.monthlyStats).length > 0 && (
        <div className="monthly-section">
          <h3>📅 Monthly Breakdown</h3>
          <div className="monthly-table">
            <div className="m-header">
              <span>Month</span><span>Deliveries</span><span>Base Pay</span><span>Tips</span><span>Total</span>
            </div>
            {Object.entries(stats.monthlyStats).map(([month, data]) => (
              <div key={month} className="m-row">
                <span>{month}</span>
                <span>{data.deliveries}</span>
                <span>${(data.deliveries * 5).toFixed(2)}</span>
                <span className="tip-amount">+${data.tips.toFixed(2)}</span>
                <span className="total-amount">${data.earnings.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Deliveries */}
      {stats?.recentDeliveries?.length > 0 && (
        <div className="recent-section">
          <h3>🕐 Recent Deliveries</h3>
          <div className="recent-list">
            {stats.recentDeliveries.map(o => (
              <div key={o._id} className="recent-item">
                <div>
                  <p className="ri-id">#{o._id.slice(-6).toUpperCase()}</p>
                  <p className="ri-customer">{o.user?.name}</p>
                </div>
                <div className="ri-right">
                  <span className="ri-tip">{o.tip ? '+$' + o.tip.toFixed(2) + ' tip' : 'No tip'}</span>
                  <span className="ri-pay">$5.00 base</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!stats?.totalDeliveries && (
        <div className="no-deliveries">
          <p>🚚 No deliveries yet! Check available orders.</p>
          <Link to="/delivery" className="btn-primary">View Available Orders</Link>
        </div>
      )}
    </div>
  );
};

// ─── Available Orders ────────────────────────────────────────
const AvailableOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = () => {
    setLoading(true);
    axios.get('/api/delivery/available')
      .then(r => { setOrders(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetch_(); }, []);

  const accept = async (id) => {
    await axios.put('/api/delivery/orders/' + id + '/accept');
    toast.success('Order accepted! 🚚');
    fetch_();
  };

  if (loading) return <div className="loading">Loading available orders...</div>;

  return (
    <div>
      <div className="section-top">
        <h2>Available Orders</h2>
        <button onClick={fetch_} className="refresh-btn">🔄 Refresh</button>
      </div>
      {orders.length === 0 ? (
        <div className="empty-delivery">
          <p>🎉 No available orders right now!</p>
          <p>Check back soon or refresh.</p>
        </div>
      ) : (
        orders.map(o => (
          <div key={o._id} className="d-order-card">
            <div className="d-order-header">
              <span className="d-order-id">#{o._id.slice(-6).toUpperCase()}</span>
              <span className="d-order-amount">${o.totalPrice?.toFixed(2)}</span>
            </div>
            <div className="d-order-details">
              <p>📍 {o.shippingAddress?.street}, {o.shippingAddress?.city}, {o.shippingAddress?.state}</p>
              <p>📦 {o.items?.length} item(s)</p>
              <p>👤 {o.user?.name}</p>
            </div>
            <div className="d-order-pay">
              <span>💵 You'll earn: <strong>$5.00</strong> + tip</span>
            </div>
            <button onClick={() => accept(o._id)} className="btn-primary accept-btn">
              🚚 Accept This Delivery
            </button>
          </div>
        ))
      )}
    </div>
  );
};

// ─── My Deliveries ───────────────────────────────────────────
const MyDeliveries = () => {
  const [orders, setOrders] = useState([]);
  const [tipInputs, setTipInputs] = useState({});

  const fetch_ = () => axios.get('/api/delivery/assigned').then(r => setOrders(r.data));
  useEffect(() => { fetch_(); }, []);

  const updateStatus = async (id, status) => {
    const tip = tipInputs[id] || 0;
    await axios.put('/api/delivery/orders/' + id + '/status', { status, tip: parseFloat(tip) });
    toast.success('Status updated! ✅');
    fetch_();
  };

  const statusFlow = { shipped: 'out_for_delivery', out_for_delivery: 'delivered' };
  const statusBtnLabel = { shipped: '▶️ Start Delivery', out_for_delivery: '✅ Mark Delivered' };

  return (
    <div>
      <h2>My Deliveries</h2>
      {orders.length === 0 && (
        <div className="empty-delivery">
          <p>📦 No deliveries assigned yet</p>
          <Link to="/delivery">View Available Orders →</Link>
        </div>
      )}
      {orders.map(o => (
        <div key={o._id} className="d-order-card">
          <div className="d-order-header">
            <span className="d-order-id">#{o._id.slice(-6).toUpperCase()}</span>
            <span className={'d-status d-status-' + o.status}>{o.status.replace('_',' ')}</span>
          </div>
          <div className="d-order-details">
            <p>👤 {o.user?.name} · 📞 {o.user?.phone || 'No phone'}</p>
            <p>📍 {o.shippingAddress?.street}, {o.shippingAddress?.city}, {o.shippingAddress?.state} {o.shippingAddress?.zipCode}</p>
            <p>📦 {o.items?.length} item(s) · 💵 ${o.totalPrice?.toFixed(2)}</p>
          </div>
          {o.status !== 'delivered' && o.status !== 'cancelled' && (
            <div className="d-order-actions">
              {o.status === 'out_for_delivery' && (
                <div className="tip-input-row">
                  <label>💰 Tip received ($):</label>
                  <input type="number" step="0.01" min="0" placeholder="0.00"
                    value={tipInputs[o._id] || ''}
                    onChange={e => setTipInputs({...tipInputs, [o._id]: e.target.value})} />
                </div>
              )}
              {statusFlow[o.status] && (
                <button onClick={() => updateStatus(o._id, statusFlow[o.status])} className="btn-primary accept-btn">
                  {statusBtnLabel[o.status]}
                </button>
              )}
            </div>
          )}
          {o.status === 'delivered' && (
            <div className="delivered-info">
              ✅ Delivered! Earned: <strong>$5.00</strong>{o.tip ? ` + $${o.tip.toFixed(2)} tip` : ''}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// ─── Support ─────────────────────────────────────────────────
const Support = () => {
  const { user } = useAuth();
  const [ticket, setTicket] = useState({ subject: '', message: '', orderId: '', category: 'general' });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post('/api/delivery/support', ticket);
      setSubmitted(true);
      toast.success('Support ticket submitted! 🎉');
    } catch { toast.error('Failed to submit ticket'); }
    setLoading(false);
  };

  const faqs = [
    { q: 'How is my pay calculated?', a: 'You earn $5.00 base pay per completed delivery, plus any tips customers add at checkout.' },
    { q: 'When do I get paid?', a: 'Payments are processed every Friday for all deliveries completed that week.' },
    { q: 'What if a customer is not home?', a: 'Try calling/messaging the customer. If unavailable after 10 minutes, take a photo and mark as delivered at door.' },
    { q: 'How do I report a damaged order?', a: 'Submit a support ticket with the order ID and describe the damage. Our team will handle it within 24 hours.' },
    { q: 'Can I reject an order?', a: 'Yes, simply don\'t accept orders you don\'t want. There\'s no penalty for not accepting available orders.' },
  ];

  return (
    <div className="support-page">
      <h2>Customer Support</h2>

      {/* Profile Card */}
      <div className="support-profile">
        <div className="sp-avatar">{user?.name?.charAt(0)}</div>
        <div>
          <h3>{user?.name}</h3>
          <p>{user?.email}</p>
          <span className="sp-badge">🚚 Delivery Partner</span>
        </div>
        <div className="sp-stats">
          <div><p>Support Hours</p><p>Mon-Fri 9am-6pm</p></div>
          <div><p>Response Time</p><p>Within 24 hours</p></div>
        </div>
      </div>

      {/* FAQ */}
      <div className="faq-section">
        <h3>❓ Frequently Asked Questions</h3>
        <div className="faq-list">
          {faqs.map((f, i) => (
            <details key={i} className="faq-item">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>

      {/* Contact Support */}
      <div className="contact-support">
        <h3>📩 Submit a Support Ticket</h3>
        {submitted ? (
          <div className="ticket-success">
            <p>✅ Your ticket has been submitted!</p>
            <p>Our support team will respond to <strong>{user?.email}</strong> within 24 hours.</p>
            <button onClick={() => { setSubmitted(false); setTicket({ subject: '', message: '', orderId: '', category: 'general' }); }}
              className="btn-primary">Submit Another Ticket</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="support-form">
            <div className="form-row-2">
              <div className="sf-group">
                <label>Category</label>
                <select value={ticket.category} onChange={e => setTicket({...ticket, category: e.target.value})}>
                  <option value="general">General Question</option>
                  <option value="payment">Payment Issue</option>
                  <option value="order">Order Problem</option>
                  <option value="account">Account Issue</option>
                  <option value="technical">Technical Problem</option>
                </select>
              </div>
              <div className="sf-group">
                <label>Order ID (optional)</label>
                <input placeholder="e.g. ABC123" value={ticket.orderId}
                  onChange={e => setTicket({...ticket, orderId: e.target.value})} />
              </div>
            </div>
            <div className="sf-group">
              <label>Subject *</label>
              <input required placeholder="Brief description of your issue" value={ticket.subject}
                onChange={e => setTicket({...ticket, subject: e.target.value})} />
            </div>
            <div className="sf-group">
              <label>Message *</label>
              <textarea required rows={5} placeholder="Describe your issue in detail..."
                value={ticket.message} onChange={e => setTicket({...ticket, message: e.target.value})} />
            </div>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Submitting...' : '📩 Submit Ticket'}
            </button>
          </form>
        )}

        {/* Direct contact */}
        <div className="direct-contact">
          <h4>🆘 Need immediate help?</h4>
          <div className="contact-options">
            <a href="mailto:support@harvesthub.com" className="contact-btn email">
              📧 support@harvesthub.com
            </a>
            <a href="tel:+18005551234" className="contact-btn phone">
              📞 1-800-555-1234
            </a>
          </div>
          <p className="contact-hours">Support hours: Monday–Friday, 9:00 AM – 6:00 PM EST</p>
        </div>
      </div>
    </div>
  );
};

// ─── Main Layout ─────────────────────────────────────────────
const DeliveryDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/delivery', label: '📊 Dashboard', exact: true },
    { path: '/delivery/available', label: '📦 Available Orders' },
    { path: '/delivery/mine', label: '🚚 My Deliveries' },
    { path: '/delivery/support', label: '🆘 Support' },
    { path: '/delivery/ai', label: '✨ AI Tools' },
  ];

  return (
    <div className="delivery-layout">
      <aside className="delivery-sidebar">
        <div className="delivery-logo">
          <h2>🌿 HarvestHub</h2>
          <span className="delivery-badge">Delivery Portal</span>
        </div>
        <div className="delivery-profile">
          <div className="delivery-avatar">{user?.name?.charAt(0)}</div>
          <div>
            <p className="dp-name">{user?.name}</p>
            <p className="dp-role">🚚 Delivery Partner</p>
            <p className="dp-email">{user?.email}</p>
          </div>
        </div>
        <nav className="delivery-nav">
          {navItems.map(item => (
            <Link key={item.path} to={item.path}
              className={'nav-item ' + (location.pathname === item.path ? 'active' : '')}>
              {item.label}
            </Link>
          ))}
          <Link to="/" className="nav-item">🏠 View Store</Link>
        </nav>
        <button onClick={() => { logout(); navigate('/login'); }} className="delivery-logout">
          🚪 Logout
        </button>
      </aside>
      <main className="delivery-main">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/available" element={<AvailableOrders />} />
          <Route path="/mine" element={<MyDeliveries />} />
          <Route path="/support" element={<Support />} />
          <Route path="/ai" element={<DeliveryAITools />} />
        </Routes>
      </main>
    </div>
  );
};

export default DeliveryDashboard;
