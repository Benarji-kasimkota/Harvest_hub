import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from '../../utils/axios';
import toast from 'react-hot-toast';
import './AdminDashboard.css';

const StatCard = ({ icon, label, value, color, sub }) => (
  <div className="stat-card" style={{ borderColor: color }}>
    <span className="stat-icon">{icon}</span>
    <div>
      <p className="stat-value">{value}</p>
      <p className="stat-label">{label}</p>
      {sub && <p className="stat-sub">{sub}</p>}
    </div>
  </div>
);

const Overview = () => {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    axios.get('/api/admin/dashboard').then(r => setStats(r.data)).catch(() => {});
  }, []);

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div className="admin-overview">
      <h2>Dashboard Overview</h2>
      <div className="stats-grid">
        <StatCard icon="👥" label="Total Users" value={stats?.totalUsers || 0} color="#2d6a4f" />
        <StatCard icon="📦" label="Total Orders" value={stats?.totalOrders || 0} color="#f4845f" />
        <StatCard icon="🛒" label="Products" value={stats?.totalProducts || 0} color="#52b788" />
        <StatCard icon="⏳" label="Pending Retailers" value={stats?.pendingRetailers || 0} color="#ffd166" />
        <StatCard icon="💰" label="Total Revenue" value={"$" + (stats?.revenue || 0).toFixed(2)} color="#06d6a0" sub="From paid orders only" />
      </div>

      {stats?.pendingRetailers > 0 && (
        <div className="alert-banner">
          ⚠️ <strong>{stats.pendingRetailers}</strong> retailer(s) waiting for approval!
          <Link to="/admin/users">Review Now →</Link>
        </div>
      )}

      {stats?.revenueByMonth?.length > 0 && (
        <div className="revenue-section">
          <h3>📊 Revenue Breakdown</h3>
          <div className="revenue-note">
            💡 Revenue is calculated from <strong>paid orders only</strong> (Stripe confirmed payments)
          </div>
          <div className="revenue-table">
            <div className="rev-header">
              <span>Month</span><span>Orders</span><span>Revenue</span>
            </div>
            {stats.revenueByMonth.map((r, i) => (
              <div key={i} className="rev-row">
                <span>{months[r._id.month - 1]} {r._id.year}</span>
                <span>{r.count} orders</span>
                <span className="rev-amount">${r.total.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <h3>🕐 Recent Orders</h3>
      <div className="recent-orders">
        {!stats?.recentOrders?.length && <p className="no-data">No orders yet</p>}
        {stats?.recentOrders?.map(o => (
          <div key={o._id} className="order-row">
            <span className="order-id">#{o._id.slice(-6).toUpperCase()}</span>
            <span>{o.user?.name || 'Unknown'}</span>
            <span>${o.totalPrice?.toFixed(2)}</span>
            <span className={"status-badge status-" + o.status}>{o.status}</span>
            <span className={o.isPaid ? 'paid-tag' : 'unpaid-tag'}>{o.isPaid ? '✅ Paid' : '⏳ Unpaid'}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const Users = () => {
  const [allUsers, setAllUsers] = useState([]);
  const [filter, setFilter] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'consumer', phone: '' });
  const [adding, setAdding] = useState(false);

  const fetchUsers = async () => {
    const res = await axios.get('/api/admin/users');
    setAllUsers(res.data);
  };

  useEffect(() => { fetchUsers(); }, []);

  const displayedUsers = filter === 'all' ? allUsers : allUsers.filter(u => u.role === filter);
  const getRoleCount = (role) => allUsers.filter(u => u.role === role).length;

  const handleAddUser = async (e) => {
    e.preventDefault();
    setAdding(true);
    try {
      await axios.post('/api/admin/users', newUser);
      toast.success("✅ " + newUser.role + " account created for " + newUser.email + "!");
      setShowAddForm(false);
      setNewUser({ name: '', email: '', password: '', role: 'consumer', phone: '' });
      fetchUsers();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to create user'); }
    setAdding(false);
  };

  const updateUser = async (id, data) => {
    try {
      await axios.put("/api/admin/users/" + id, data);
      toast.success('User updated!');
      fetchUsers();
    } catch { toast.error('Failed to update'); }
  };

  const deleteUser = async (id) => {
    if (!window.confirm('Delete this user permanently?')) return;
    await axios.delete("/api/admin/users/" + id);
    toast.success('User deleted');
    fetchUsers();
  };

  const roleColors = { consumer: '#d8f3dc', retailer: '#fff3cd', delivery: '#cce5ff', admin: '#f8d7da' };
  const roleTextColors = { consumer: '#2d6a4f', retailer: '#856404', delivery: '#004085', admin: '#721c24' };

  return (
    <div className="admin-users">
      <div className="section-header-row">
        <h2>Manage Users ({allUsers.length} total)</h2>
        <button className="btn-add-user" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? '✕ Cancel' : '+ Add User'}
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleAddUser} className="add-user-form">
          <h3>➕ Create New User</h3>
          <div className="add-user-grid">
            <div className="form-group">
              <label>Full Name *</label>
              <input required placeholder="John Doe" value={newUser.name}
                onChange={e => setNewUser({...newUser, name: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Email *</label>
              <input type="email" required placeholder="john@example.com" value={newUser.email}
                onChange={e => setNewUser({...newUser, email: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Password (default: HarvestHub@123)</label>
              <input type="password" placeholder="Leave empty for default" value={newUser.password}
                onChange={e => setNewUser({...newUser, password: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input placeholder="+1 (555) 000-0000" value={newUser.phone}
                onChange={e => setNewUser({...newUser, phone: e.target.value})} />
            </div>
            <div className="form-group">
              <label>Role *</label>
              <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                <option value="consumer">🛒 Consumer</option>
                <option value="retailer">🏪 Retailer</option>
                <option value="delivery">🚚 Delivery Person</option>
                <option value="admin">⚙️ Admin</option>
              </select>
            </div>
          </div>
          <div className="add-user-note">ℹ️ The user will be created as Active with immediate access.</div>
          <button type="submit" className="btn-primary" disabled={adding}>
            {adding ? 'Creating...' : 'Create ' + newUser.role + ' Account'}
          </button>
        </form>
      )}

      <div className="filter-tabs">
        {['all','consumer','retailer','delivery','admin'].map(r => (
          <button key={r} className={filter === r ? 'active' : ''} onClick={() => setFilter(r)}>
            {r.charAt(0).toUpperCase() + r.slice(1)} <span className="fc">{r === 'all' ? allUsers.length : getRoleCount(r)}</span>
          </button>
        ))}
      </div>

      <div className="users-table">
        <div className="table-header">
          <span>Name</span><span>Email</span><span>Role</span><span>Status</span><span>Actions</span>
        </div>
        {displayedUsers.length === 0 && <div className="no-data">No users found</div>}
        {displayedUsers.map(u => (
          <div key={u._id} className="table-row">
            <span className="user-name-cell">
              <span className="user-avatar-sm">{u.name?.charAt(0)}</span>
              {u.name}
            </span>
            <span className="email-cell">{u.email}</span>
            <span>
              <span className="role-pill" style={{ background: roleColors[u.role], color: roleTextColors[u.role] }}>
                {u.role}
              </span>
            </span>
            <span>
              <select value={u.status} onChange={e => updateUser(u._id, { status: e.target.value })}
                className={"status-select status-" + u.status}>
                <option value="active">✅ Active</option>
                <option value="pending">⏳ Pending</option>
                <option value="suspended">🚫 Suspended</option>
              </select>
            </span>
            <span className="action-btns">
              <select value={u.role} onChange={e => updateUser(u._id, { role: e.target.value })} className="role-select">
                <option value="consumer">Consumer</option>
                <option value="retailer">Retailer</option>
                <option value="delivery">Delivery</option>
                <option value="admin">Admin</option>
              </select>
              {u.status === 'pending' && (
                <button className="btn-approve" onClick={() => updateUser(u._id, { status: 'active' })}>✅</button>
              )}
              <button className="btn-delete" onClick={() => deleteUser(u._id)}>🗑️</button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => { axios.get('/api/admin/orders').then(r => setOrders(r.data)); }, []);

  const updateStatus = async (id, status) => {
    await axios.put("/api/admin/orders/" + id + "/status", { status });
    setOrders(orders.map(o => o._id === id ? { ...o, status } : o));
    toast.success('Order updated!');
  };

  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);
  const getStatusCount = (s) => orders.filter(o => o.status === s).length;

  return (
    <div className="admin-orders">
      <h2>All Orders ({orders.length} total)</h2>
      <div className="filter-tabs">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
          All <span className="fc">{orders.length}</span>
        </button>
        {['pending','processing','shipped','out_for_delivery','delivered','cancelled'].map(s => (
          <button key={s} className={filter === s ? 'active' : ''} onClick={() => setFilter(s)}>
            {s.replace('_',' ')} <span className="fc">{getStatusCount(s)}</span>
          </button>
        ))}
      </div>
      <div className="users-table">
        <div className="table-header orders-header">
          <span>Order ID</span><span>Customer</span><span>Total</span>
          <span>Payment</span><span>Status</span><span>Update</span>
        </div>
        {filtered.length === 0 && <div className="no-data">No orders found</div>}
        {filtered.map(o => (
          <div key={o._id} className="table-row orders-row">
            <span className="order-id">#{o._id.slice(-6).toUpperCase()}</span>
            <span>{o.user?.name || 'Deleted User'}</span>
            <span>${o.totalPrice?.toFixed(2)}</span>
            <span className={o.isPaid ? 'paid-tag' : 'unpaid-tag'}>{o.isPaid ? '✅ Paid' : '⏳ Unpaid'}</span>
            <span className={"status-badge status-" + o.status}>{o.status?.replace('_',' ')}</span>
            <span>
              <select value={o.status} onChange={e => updateStatus(o._id, e.target.value)} className="status-select-sm">
                {['pending','processing','shipped','out_for_delivery','delivered','cancelled'].map(s => (
                  <option key={s} value={s}>{s.replace('_',' ')}</option>
                ))}
              </select>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const PRIORITY_COLORS = { high: '#f8d7da', medium: '#fff3cd', low: '#d8f3dc' };
const PRIORITY_TEXT = { high: '#721c24', medium: '#856404', low: '#2d6a4f' };
const TICKET_STATUS_COLORS = { open: '#cce5ff', in_progress: '#fff3cd', resolved: '#d8f3dc', closed: '#f0f0f0' };

const Tickets = () => {
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('all');
  const [response, setResponse] = useState('');
  const [updating, setUpdating] = useState(false);

  const fetchTickets = async () => {
    try {
      const res = await axios.get('/api/support/all');
      setTickets(res.data);
    } catch { toast.error('Failed to load tickets'); }
  };

  useEffect(() => { fetchTickets(); }, []);

  const filtered = filter === 'all' ? tickets : tickets.filter(t => t.status === filter);
  const getCount = (s) => tickets.filter(t => t.status === s).length;

  const handleUpdate = async (status, adminNotes) => {
    if (!selected) return;
    setUpdating(true);
    try {
      const payload = { status };
      if (adminNotes) payload.adminNotes = adminNotes;
      if (response.trim()) payload.response = response.trim();
      const res = await axios.put(`/api/support/${selected._id}`, payload);
      setTickets(prev => prev.map(t => t._id === selected._id ? res.data : t));
      setSelected(res.data);
      setResponse('');
      toast.success('Ticket updated!');
    } catch { toast.error('Failed to update ticket'); }
    setUpdating(false);
  };

  return (
    <div className="admin-tickets">
      <h2>Support Tickets ({tickets.length} total)</h2>

      <div className="filter-tabs">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
          All <span className="fc">{tickets.length}</span>
        </button>
        {['open','in_progress','resolved','closed'].map(s => (
          <button key={s} className={filter === s ? 'active' : ''} onClick={() => setFilter(s)}>
            {s.replace('_',' ')} <span className="fc">{getCount(s)}</span>
          </button>
        ))}
      </div>

      <div className="tickets-layout">
        <div className="tickets-list">
          {filtered.length === 0 && <div className="no-data">No tickets found</div>}
          {filtered.map(t => (
            <div
              key={t._id}
              className={`ticket-item ${selected?._id === t._id ? 'selected' : ''}`}
              onClick={() => setSelected(t)}
            >
              <div className="ticket-item-header">
                <span
                  className="ticket-priority"
                  style={{ background: PRIORITY_COLORS[t.priority], color: PRIORITY_TEXT[t.priority] }}
                >
                  {t.priority}
                </span>
                <span
                  className="ticket-status-tag"
                  style={{ background: TICKET_STATUS_COLORS[t.status] || '#f0f0f0' }}
                >
                  {t.status?.replace('_', ' ')}
                </span>
              </div>
              <p className="ticket-subject">{t.subject}</p>
              <p className="ticket-meta">
                {t.userName} &bull; {t.userRole} &bull; {t.category}
              </p>
              <p className="ticket-date">{new Date(t.createdAt).toLocaleDateString()}</p>
            </div>
          ))}
        </div>

        <div className="ticket-detail">
          {!selected ? (
            <div className="ticket-placeholder">
              <p style={{ fontSize: '2.5rem' }}>🎫</p>
              <p>Select a ticket to view details</p>
            </div>
          ) : (
            <>
              <div className="ticket-detail-header">
                <div>
                  <h3>{selected.subject}</h3>
                  <p className="ticket-detail-meta">
                    From: <strong>{selected.userName}</strong> ({selected.userEmail}) &bull; Role: {selected.userRole}
                    {selected.orderId && <> &bull; Order: #{selected.orderId.slice(-6).toUpperCase()}</>}
                  </p>
                </div>
                <div className="ticket-badges">
                  <span className="ticket-priority" style={{ background: PRIORITY_COLORS[selected.priority], color: PRIORITY_TEXT[selected.priority] }}>
                    {selected.priority} priority
                  </span>
                  <span className="ticket-category-tag">{selected.category}</span>
                </div>
              </div>

              <div className="ticket-message-box">
                <p className="ticket-message-label">Customer Message</p>
                <p className="ticket-message-text">{selected.message}</p>
                <p className="ticket-timestamp">{new Date(selected.createdAt).toLocaleString()}</p>
              </div>

              {selected.responses?.length > 0 && (
                <div className="ticket-responses">
                  <p className="ticket-message-label">Response History</p>
                  {selected.responses.map((r, i) => (
                    <div key={i} className={`response-bubble ${r.from}`}>
                      <p>{r.message}</p>
                      <span>{new Date(r.createdAt).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}

              {selected.adminNotes && (
                <div className="admin-notes-box">
                  <p className="ticket-message-label">Admin Notes</p>
                  <p>{selected.adminNotes}</p>
                </div>
              )}

              <div className="ticket-actions">
                <div className="form-group">
                  <label>Reply to Customer (sends email)</label>
                  <textarea
                    className="ticket-reply-input"
                    rows={3}
                    placeholder="Type your response..."
                    value={response}
                    onChange={e => setResponse(e.target.value)}
                  />
                </div>
                <div className="ticket-action-buttons">
                  <button
                    className="btn-ticket-action open"
                    onClick={() => handleUpdate('open')}
                    disabled={updating}
                  >Open</button>
                  <button
                    className="btn-ticket-action progress"
                    onClick={() => handleUpdate('in_progress')}
                    disabled={updating}
                  >In Progress</button>
                  <button
                    className="btn-ticket-action resolve"
                    onClick={() => handleUpdate('resolved')}
                    disabled={updating}
                  >Resolve</button>
                  <button
                    className="btn-ticket-action close"
                    onClick={() => handleUpdate('closed')}
                    disabled={updating}
                  >Close</button>
                </div>
                {response.trim() && (
                  <p className="reply-hint">💬 A reply email will be sent to the customer when you update the status above.</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Products Management ───────────────────────────────────────────────────────
const Products = () => {
  const [products, setProducts] = useState([]);
  const [filter, setFilter] = useState('all');
  const categories = ['vegetables','fruits','meat','dairy','grains'];

  const fetchProducts = async () => {
    const res = await axios.get('/api/admin/products');
    setProducts(res.data);
  };
  useEffect(() => { fetchProducts(); }, []);

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}" permanently?`)) return;
    try {
      await axios.delete(`/api/admin/products/${id}`);
      toast.success('Product deleted');
      fetchProducts();
    } catch { toast.error('Failed to delete product'); }
  };

  const displayed = filter === 'all' ? products : products.filter(p => p.category === filter);

  return (
    <div className="admin-products">
      <h2>All Products ({products.length} total)</h2>
      <div className="filter-tabs">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
          All <span className="fc">{products.length}</span>
        </button>
        {categories.map(c => (
          <button key={c} className={filter === c ? 'active' : ''} onClick={() => setFilter(c)}>
            {c} <span className="fc">{products.filter(p => p.category === c).length}</span>
          </button>
        ))}
      </div>
      <div className="users-table">
        <div className="table-header products-header">
          <span>Product</span><span>Retailer</span><span>Category</span>
          <span>Price</span><span>Stock</span><span>Action</span>
        </div>
        {displayed.length === 0 && <div className="no-data">No products found</div>}
        {displayed.map(p => (
          <div key={p._id} className="table-row products-row">
            <span className="product-name-cell">
              {p.image && <img src={p.image} alt={p.name} className="product-thumb" onError={e => { e.target.style.display='none'; }} />}
              <span>{p.name}</span>
            </span>
            <span>{p.retailer?.name || 'Unknown'}<br/><small>{p.retailer?.email}</small></span>
            <span><span className="role-pill">{p.category}</span></span>
            <span>${p.price?.toFixed(2)}</span>
            <span className={p.stock < 10 ? 'low-stock-cell' : ''}>{p.stock} {p.unit}</span>
            <span>
              <button className="btn-delete" onClick={() => handleDelete(p._id, p.name)}>🗑️ Remove</button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Delivery Oversight ─────────────────────────────────────────────────────────
const Delivery = () => {
  const [data, setData] = useState(null);
  const [reassigning, setReassigning] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState('');

  const fetchData = async () => {
    const res = await axios.get('/api/admin/delivery');
    setData(res.data);
  };
  useEffect(() => { fetchData(); }, []);

  const handleReassign = async (orderId) => {
    if (!selectedDriver) return toast.error('Select a driver first');
    try {
      await axios.put(`/api/admin/orders/${orderId}/reassign`, { deliveryPersonId: selectedDriver });
      toast.success('Order reassigned!');
      setReassigning(null);
      setSelectedDriver('');
      fetchData();
    } catch (err) { toast.error(err.response?.data?.message || 'Reassignment failed'); }
  };

  if (!data) return <div className="loading-state">Loading delivery data...</div>;

  return (
    <div className="admin-delivery">
      <h2>Delivery Oversight</h2>
      <div className="delivery-grid">
        <div className="delivery-panel">
          <h3>🚚 Delivery Drivers ({data.drivers.length})</h3>
          {data.drivers.length === 0 && <p className="no-data">No delivery drivers registered</p>}
          {data.drivers.map(d => (
            <div key={d._id} className="driver-card">
              <div className="driver-avatar">{d.name?.charAt(0)}</div>
              <div className="driver-info">
                <p className="driver-name">{d.name}</p>
                <p className="driver-email">{d.email}</p>
              </div>
              <div className="driver-stats">
                <span className={`avail-badge ${d.isAvailable ? 'available' : 'unavailable'}`}>
                  {d.isAvailable ? '🟢 Available' : '🔴 Busy'}
                </span>
                <span className="driver-stat">✅ {d.deliveredCount} delivered</span>
                <span className="driver-stat">🚚 {d.activeCount} active</span>
              </div>
            </div>
          ))}
        </div>
        <div className="delivery-panel">
          <h3>⏳ Unassigned Orders ({data.unassignedOrders.length})</h3>
          {data.unassignedOrders.length === 0 && <p className="no-data">All orders are assigned</p>}
          {data.unassignedOrders.map(o => (
            <div key={o._id} className="unassigned-order-card">
              <div className="unassigned-order-info">
                <span className="order-id">#{o._id.slice(-6).toUpperCase()}</span>
                <span>{o.user?.name}</span>
                <span>${o.totalPrice?.toFixed(2)}</span>
                <span className="order-date">{new Date(o.createdAt).toLocaleDateString()}</span>
              </div>
              {reassigning === o._id ? (
                <div className="reassign-row">
                  <select value={selectedDriver} onChange={e => setSelectedDriver(e.target.value)} className="driver-select">
                    <option value="">-- Select Driver --</option>
                    {data.drivers.map(d => (
                      <option key={d._id} value={d._id}>{d.name} ({d.activeCount} active)</option>
                    ))}
                  </select>
                  <button className="btn-approve" onClick={() => handleReassign(o._id)}>Assign</button>
                  <button className="btn-delete" onClick={() => setReassigning(null)}>✕</button>
                </div>
              ) : (
                <button className="btn-outline-sm" onClick={() => { setReassigning(o._id); setSelectedDriver(''); }}>
                  Assign Driver
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <h3 style={{ marginTop: '2rem' }}>📋 Active Deliveries ({data.assignedOrders.length})</h3>
      <div className="users-table">
        <div className="table-header" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr' }}>
          <span>Order</span><span>Customer</span><span>Driver</span><span>Status</span><span>Reassign</span>
        </div>
        {data.assignedOrders.length === 0 && <div className="no-data">No active deliveries</div>}
        {data.assignedOrders.map(o => (
          <div key={o._id} className="table-row" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr' }}>
            <span className="order-id">#{o._id.slice(-6).toUpperCase()}</span>
            <span>{o.user?.name}</span>
            <span>{o.deliveryPerson?.name}</span>
            <span className={"status-badge status-" + o.status}>{o.status?.replace('_',' ')}</span>
            <span>
              {reassigning === o._id ? (
                <div className="reassign-row">
                  <select value={selectedDriver} onChange={e => setSelectedDriver(e.target.value)} className="driver-select">
                    <option value="">-- Select --</option>
                    {data.drivers.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                  </select>
                  <button className="btn-approve" onClick={() => handleReassign(o._id)}>✓</button>
                  <button className="btn-delete" onClick={() => setReassigning(null)}>✕</button>
                </div>
              ) : (
                <button className="btn-outline-sm" onClick={() => { setReassigning(o._id); setSelectedDriver(''); }}>Reassign</button>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Retailer Analytics ─────────────────────────────────────────────────────────
const Analytics = () => {
  const [data, setData] = useState([]);
  useEffect(() => { axios.get('/api/admin/analytics').then(r => setData(r.data)).catch(() => {}); }, []);

  const totalRevenue = data.reduce((s, r) => s + r.revenue, 0);
  const totalProducts = data.reduce((s, r) => s + r.productCount, 0);

  return (
    <div className="admin-analytics">
      <h2>Retailer Analytics</h2>
      <div className="stats-grid" style={{ marginBottom: '2rem' }}>
        <StatCard icon="🏪" label="Total Retailers" value={data.length} color="#2d6a4f" />
        <StatCard icon="🛒" label="Total Products" value={totalProducts} color="#52b788" />
        <StatCard icon="💰" label="Combined Revenue" value={`$${totalRevenue.toFixed(2)}`} color="#f4845f" />
        <StatCard icon="⚠️" label="Low Stock Alerts" value={data.reduce((s, r) => s + r.lowStockCount, 0)} color="#ffd166" />
      </div>
      <div className="users-table">
        <div className="table-header analytics-header">
          <span>Retailer</span><span>Status</span><span>Products</span>
          <span>Orders</span><span>Items Sold</span><span>Revenue</span><span>Low Stock</span>
        </div>
        {data.length === 0 && <div className="no-data">No retailer data yet</div>}
        {data.map((r, i) => (
          <div key={r.retailer.id} className="table-row analytics-row">
            <span>
              <span className="rank-badge">#{i + 1}</span>
              <strong>{r.retailer.name}</strong>
              <br /><small>{r.retailer.email}</small>
            </span>
            <span>
              <span className={`status-badge status-${r.retailer.status}`}>{r.retailer.status}</span>
            </span>
            <span>{r.productCount}</span>
            <span>{r.orderCount}</span>
            <span>{r.itemsSold}</span>
            <span className="rev-amount">${r.revenue.toFixed(2)}</span>
            <span className={r.lowStockCount > 0 ? 'low-stock-cell' : ''}>{r.lowStockCount}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => { logout(); navigate('/login'); };

  const navItems = [
    { path: '/admin', label: '📊 Overview' },
    { path: '/admin/users', label: '👥 Users' },
    { path: '/admin/orders', label: '📦 Orders' },
    { path: '/admin/products', label: '🛒 Products' },
    { path: '/admin/delivery', label: '🚚 Delivery' },
    { path: '/admin/analytics', label: '📈 Analytics' },
    { path: '/admin/tickets', label: '🎫 Support' },
  ];

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <h2>🌿 HarvestHub</h2>
          <span className="admin-badge">Admin Panel</span>
        </div>
        <div className="admin-profile">
          <div className="admin-avatar">{user?.name?.charAt(0)}</div>
          <div><p className="admin-name">{user?.name}</p><p className="admin-role">Administrator</p></div>
        </div>
        <nav className="admin-nav">
          {navItems.map(item => (
            <Link key={item.path} to={item.path}
              className={"nav-item " + (location.pathname === item.path ? 'active' : '')}>
              {item.label}
            </Link>
          ))}
          <Link to="/" className="nav-item">🏠 View Store</Link>
        </nav>
        <button onClick={handleLogout} className="admin-logout">🚪 Logout</button>
      </aside>
      <main className="admin-main">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/users" element={<Users />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/products" element={<Products />} />
          <Route path="/delivery" element={<Delivery />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/tickets" element={<Tickets />} />
        </Routes>
      </main>
    </div>
  );
};

export default AdminDashboard;
