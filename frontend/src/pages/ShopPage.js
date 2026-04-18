import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import axios from '../utils/axios';
import ProductCard from '../components/products/ProductCard';
import './ShopPage.css';

const ShopPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('');
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cat = params.get('category') || '';
    setCategory(cat);
  }, [location.search]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (search) params.append('search', search);
    if (sort) params.append('sort', sort);
    axios.get(`/api/products?${params}`)
      .then(res => { setProducts(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [category, search, sort]);

  return (
    <div>
      <div className="page-header">
        <h1>Our Products</h1>
        <p>Fresh from local farms — vegetables, meat, dairy & more</p>
      </div>
      <div className="container shop-layout">
        {/* Sidebar */}
        <aside className="shop-sidebar">
          <h3>Categories</h3>
          {['', 'vegetables', 'fruits', 'meat', 'dairy', 'grains'].map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={`cat-btn ${category === cat ? 'active' : ''}`}>
              {cat === '' ? 'All Products' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </aside>

        {/* Main */}
        <div className="shop-main">
          <div className="shop-toolbar">
            <input placeholder="🔍 Search products..." value={search}
              onChange={e => setSearch(e.target.value)} className="search-input" />
            <select value={sort} onChange={e => setSort(e.target.value)}>
              <option value="">Sort: Latest</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </div>
          {loading ? <div className="loading">Loading products...</div> : (
            <div className="products-grid">
              {products.length > 0 ? products.map(p => (
                <ProductCard key={p._id} product={p} />
              )) : (
                <div className="empty-state">No products found</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShopPage;
