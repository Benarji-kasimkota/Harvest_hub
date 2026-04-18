import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from '../utils/axios';
import ProductCard from '../components/products/ProductCard';
import FloatingVeggies from '../components/common/FloatingVeggies';
import './HomePage.css';

const HomePage = () => {
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/products/featured')
      .then(res => { setFeatured(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="home">
      {/* Hero */}
      <section className="hero">
        <FloatingVeggies />
        <div className="hero-content animate-slide-up">
          <span className="badge badge-green pulse">🌱 Farm Fresh Daily</span>
          <h1>Fresh From Farm<br />To Your Table</h1>
          <p>Premium vegetables, meat & dairy sourced directly from local farmers. Delivered fresh to your doorstep.</p>
          <div className="hero-btns">
            <Link to="/shop" className="btn-primary btn-animated">Shop Now</Link>
            <Link to="/shop?category=vegetables" className="btn-outline">Explore</Link>
          </div>
          <div className="hero-stats">
            <div className="stat"><span className="stat-num">500+</span><span>Products</span></div>
            <div className="stat-divider" />
            <div className="stat"><span className="stat-num">50+</span><span>Farmers</span></div>
            <div className="stat-divider" />
            <div className="stat"><span className="stat-num">24h</span><span>Delivery</span></div>
          </div>
        </div>
        <div className="hero-image animate-slide-right">
          <div className="hero-img-wrapper">
            <img src="https://images.unsplash.com/photo-1542838132-92c53300491e?w=600" alt="Fresh produce" />
            <div className="hero-img-badge">
              <span>🌿</span>
              <div><strong>100% Organic</strong><p>Certified Fresh</p></div>
            </div>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="categories">
        <div className="container">
          <div className="section-header center">
            <span className="section-tag">Browse</span>
            <h2>Shop by Category</h2>
          </div>
          <div className="categories-grid">
            {[
              { name: 'Vegetables', emoji: '🥦', color: '#d8f3dc', slug: 'vegetables', count: '120+ items' },
              { name: 'Fruits', emoji: '🍎', color: '#ffe8e0', slug: 'fruits', count: '80+ items' },
              { name: 'Meat', emoji: '🥩', color: '#ffe0e0', slug: 'meat', count: '60+ items' },
              { name: 'Dairy', emoji: '🥛', color: '#fff3cd', slug: 'dairy', count: '40+ items' },
              { name: 'Grains', emoji: '🌾', color: '#f0e6d3', slug: 'grains', count: '50+ items' },
            ].map((cat, i) => (
              <Link to={`/shop?category=${cat.slug}`} key={cat.slug}
                className="category-card" style={{ background: cat.color, animationDelay: `${i * 0.1}s` }}>
                <span className="cat-emoji">{cat.emoji}</span>
                <span className="cat-name">{cat.name}</span>
                <span className="cat-count">{cat.count}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      <section className="featured">
        <div className="container">
          <div className="section-header">
            <div>
              <span className="section-tag">Handpicked</span>
              <h2>Featured Products</h2>
            </div>
            <Link to="/shop" className="view-all">View All →</Link>
          </div>
          {loading ? (
            <div className="loading-grid">
              {[...Array(4)].map((_, i) => <div key={i} className="skeleton-card" />)}
            </div>
          ) : (
            <div className="products-grid">
              {featured.length > 0 ? featured.map((p, i) => (
                <div key={p._id} className="product-animate" style={{ animationDelay: `${i * 0.1}s` }}>
                  <ProductCard product={p} />
                </div>
              )) : (
                <div className="empty-state">
                  <p>No featured products yet. <Link to="/shop">Browse all products</Link></p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Features Banner */}
      <section className="features">
        <div className="container">
          <div className="features-grid">
            {[
              { icon: '🚚', title: 'Free Delivery', desc: 'On orders above $50' },
              { icon: '🌿', title: '100% Organic', desc: 'Certified fresh produce' },
              { icon: '⚡', title: 'Same Day', desc: 'Order before 12pm' },
              { icon: '🔒', title: 'Secure Payment', desc: 'Powered by Stripe' },
            ].map((f, i) => (
              <div key={f.title} className="feature-card" style={{ animationDelay: `${i * 0.15}s` }}>
                <span className="feature-icon">{f.icon}</span>
                <h4>{f.title}</h4>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
