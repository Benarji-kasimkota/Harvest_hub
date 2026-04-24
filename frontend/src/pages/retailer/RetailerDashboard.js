import React, { useState, useEffect } from 'react';
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axios from '../../utils/axios';
import toast from 'react-hot-toast';
import AIAssistant from './AIAssistant';
import RetailerAITools from './RetailerAITools';
import './RetailerDashboard.css';

const categories = ['vegetables','fruits','meat','dairy','grains'];

const Overview = () => {
  const [stats, setStats] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    axios.get('/api/retailer/dashboard').then(r => setStats(r.data)).catch(() => {});
  }, []);

  return (
    <div className="retailer-overview">
      <h2>Welcome back, {user?.name}! 🌱</h2>
      <p className="overview-sub">Here's how your store is performing</p>

      <div className="retailer-stats">
        <div className="r-stat-card green">
          <span className="r-stat-icon">💰</span>
          <p className="r-stat-value">${(stats?.totalRevenue || 0).toFixed(2)}</p>
          <p className="r-stat-label">Total Revenue</p>
          <p className="r-stat-hint">From paid orders only</p>
        </div>
        <div className="r-stat-card blue">
          <span className="r-stat-icon">📦</span>
          <p className="r-stat-value">{stats?.totalOrders || 0}</p>
          <p className="r-stat-label">Total Orders</p>
        </div>
        <div className="r-stat-card orange">
          <span className="r-stat-icon">🛒</span>
          <p className="r-stat-value">{stats?.productCount || 0}</p>
          <p className="r-stat-label">My Products</p>
        </div>
        <div className="r-stat-card red">
          <span className="r-stat-icon">📊</span>
          <p className="r-stat-value">{stats?.totalItemsSold || 0}</p>
          <p className="r-stat-label">Items Sold</p>
        </div>
      </div>

      {stats?.lowStock > 0 && (
        <div className="low-stock-alert">
          ⚠️ You have <strong>{stats.lowStock}</strong> product(s) with low stock (less than 10 units)!
          <Link to="/retailer/products"> Manage Products →</Link>
        </div>
      )}

      {/* Top Products */}
      {stats?.topProducts?.length > 0 && (
        <div className="retailer-section">
          <h3>🏆 Top Selling Products</h3>
          <div className="top-products">
            <div className="top-header">
              <span>Product</span><span>Units Sold</span><span>Revenue</span>
            </div>
            {stats.topProducts.map((p, i) => (
              <div key={i} className="top-row">
                <span>
                  <span className="top-rank">#{i+1}</span> {p.name}
                </span>
                <span>{p.sold} units</span>
                <span className="top-revenue">${p.revenue.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monthly Revenue */}
      {stats?.monthlyRevenue && Object.keys(stats.monthlyRevenue).length > 0 && (
        <div className="retailer-section">
          <h3>📅 Monthly Revenue</h3>
          <div className="monthly-table">
            <div className="top-header"><span>Month</span><span>Revenue</span></div>
            {Object.entries(stats.monthlyRevenue).map(([month, rev]) => (
              <div key={month} className="top-row">
                <span>{month}</span>
                <span className="top-revenue">${rev.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Orders */}
      {stats?.recentOrders?.length > 0 && (
        <div className="retailer-section">
          <h3>🕐 Recent Orders</h3>
          <div className="top-products">
            <div className="top-header">
              <span>Order</span><span>Customer</span><span>Items</span><span>Status</span>
            </div>
            {stats.recentOrders.map((o, i) => (
              <div key={i} className="top-row">
                <span>#{o.id?.slice(-6).toUpperCase()}</span>
                <span>{o.customer}</span>
                <span>{o.items?.length} item(s)</span>
                <span className={"r-status r-status-" + o.status}>{o.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!stats?.totalOrders && (
        <div className="no-sales">
          <p>🌱 No sales yet! Add products to start selling.</p>
          <Link to="/retailer/products" className="btn-primary">Add Products</Link>
        </div>
      )}
    </div>
  );
};

const Products = () => {
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:'', description:'', price:'', category:'vegetables', image:'', stock:'', unit:'kg', featured: false });
  const [editing, setEditing] = useState(null);

  const fetchProducts = () => axios.get('/api/retailer/products').then(r => setProducts(r.data));
  useEffect(() => { fetchProducts(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await axios.put('/api/retailer/products/' + editing, form);
        toast.success('Product updated! ✅');
      } else {
        await axios.post('/api/retailer/products', form);
        toast.success('Product added! 🎉');
      }
      setShowForm(false); setEditing(null);
      setForm({ name:'', description:'', price:'', category:'vegetables', image:'', stock:'', unit:'kg', featured: false });
      fetchProducts();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const handleEdit = (p) => {
    setForm({ name: p.name, description: p.description, price: p.price, category: p.category, image: p.image, stock: p.stock, unit: p.unit, featured: p.featured });
    setEditing(p._id); setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product?')) return;
    await axios.delete('/api/retailer/products/' + id);
    toast.success('Product deleted');
    fetchProducts();
  };

  return (
    <div className="retailer-products">
      <div className="section-toolbar">
        <h2>My Products ({products.length})</h2>
        <button className="btn-primary" onClick={() => { setShowForm(!showForm); setEditing(null); }}>
          {showForm ? '✕ Cancel' : '+ Add Product'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="product-form card">
          <h3>{editing ? '✏️ Edit Product' : '➕ Add New Product'}</h3>
          <div className="form-grid-2">
            <div className="form-group"><label>Product Name *</label>
              <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Fresh Tomatoes" /></div>
            <div className="form-group"><label>Category *</label>
              <select value={form.category} onChange={e => setForm({...form, category: e.target.value})}>
                {categories.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
              </select></div>
            <div className="form-group"><label>Price ($) *</label>
              <input type="number" step="0.01" required value={form.price} onChange={e => setForm({...form, price: e.target.value})} placeholder="0.00" /></div>
            <div className="form-group"><label>Stock *</label>
              <input type="number" required value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} placeholder="100" /></div>
            <div className="form-group"><label>Unit</label>
              <select value={form.unit} onChange={e => setForm({...form, unit: e.target.value})}>
                {['kg','lb','bunch','piece','litre','dozen','bag'].map(u => <option key={u} value={u}>{u}</option>)}
              </select></div>
            <div className="form-group"><label>Product Image</label>
              <div className="image-input-group">
                <input value={form.image} onChange={e => setForm({...form, image: e.target.value})} placeholder="Paste URL or upload below" />
                <label className="upload-btn">
                  📁 Upload
                  <input type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={async e => {
                      const file = e.target.files[0];
                      if (!file) return;
                      const data = new FormData();
                      data.append('image', file);
                      try {
                        const res = await axios.post('/api/upload', data, { headers: { 'Content-Type': 'multipart/form-data' } });
                        setForm(f => ({ ...f, image: res.data.url }));
                        toast.success('Image uploaded!');
                      } catch { toast.error('Upload failed'); }
                    }}
                  />
                </label>
              </div>
              {form.image && <img src={form.image} alt="preview" className="image-preview" onError={e => e.target.style.display='none'} />}
            </div>
            <div className="form-group full-width"><label>Description</label>
              <textarea rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Describe your product..." /></div>
            <div className="form-group checkbox-group">
              <label><input type="checkbox" checked={form.featured} onChange={e => setForm({...form, featured: e.target.checked})} /> Feature on homepage</label>
            </div>
          </div>
          <button type="submit" className="btn-primary">{editing ? 'Update Product' : 'Add Product'}</button>
        </form>
      )}

      <div className="products-list">
        {products.length === 0 && <div className="empty-state"><p>No products yet. Add your first product! 🌱</p></div>}
        {products.map(p => (
          <div key={p._id} className="product-row card">
            <img src={p.image} alt={p.name} onError={e => e.target.src='https://via.placeholder.com/70'} />
            <div className="product-row-info">
              <h4>{p.name}</h4>
              <span className="category-tag">{p.category}</span>
              {p.featured && <span className="featured-tag">⭐ Featured</span>}
            </div>
            <div className="product-row-stats">
              <span className="price">${p.price}/{p.unit}</span>
              <span className={'stock ' + (p.stock < 10 ? 'low' : '')}>
                {p.stock < 10 ? '⚠️' : '✅'} Stock: {p.stock}
              </span>
            </div>
            <div className="product-row-actions">
              <button onClick={() => handleEdit(p)} className="btn-edit">✏️ Edit</button>
              <button onClick={() => handleDelete(p._id)} className="btn-del">🗑️</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const RetailerDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="retailer-layout">
      <aside className="retailer-sidebar">
        <div className="retailer-logo">
          <h2>🌿 HarvestHub</h2>
          <span className="retailer-badge">Retailer Portal</span>
        </div>
        <div className="retailer-profile">
          <div className="retailer-avatar">{user?.name?.charAt(0)}</div>
          <div><p className="retailer-name">{user?.name}</p><p className="retailer-role">Retailer</p></div>
        </div>
        <nav className="retailer-nav">
          <Link to="/retailer" className={'nav-item ' + (location.pathname === '/retailer' ? 'active' : '')}>📊 Dashboard</Link>
          <Link to="/retailer/products" className={'nav-item ' + (location.pathname.includes('products') ? 'active' : '')}>🛒 My Products</Link>
          <Link to="/retailer/ai" className={'nav-item ai-nav-item ' + (location.pathname === '/retailer/ai' ? 'active' : '')}>📦 Inventory AI</Link>
          <Link to="/retailer/ai-tools" className={'nav-item ai-nav-item ' + (location.pathname.includes('ai-tools') ? 'active' : '')}>✨ AI Tools</Link>
          <Link to="/" className="nav-item">🏠 View Store</Link>
        </nav>
        <button onClick={() => { logout(); navigate('/login'); }} className="retailer-logout">🚪 Logout</button>
      </aside>
      <main className="retailer-main">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/products" element={<Products />} />
          <Route path="/ai" element={<AIAssistant />} />
          <Route path="/ai-tools" element={<RetailerAITools />} />
        </Routes>
      </main>
    </div>
  );
};

export default RetailerDashboard;
