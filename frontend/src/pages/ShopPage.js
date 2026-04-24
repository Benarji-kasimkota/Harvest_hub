import React, { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import axios from '../utils/axios';
import ProductCard from '../components/products/ProductCard';
import AISearchBar from '../components/common/AISearchBar';
import { useAuth } from '../context/AuthContext';
import './ShopPage.css';

const LIMIT = 12;

const ShopPage = () => {
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('');
  const [aiProducts, setAiProducts] = useState(null);
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cat = params.get('category') || '';
    setCategory(cat);
    setPage(1);
  }, [location.search]);

  const fetchProducts = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (search) params.append('search', search);
    if (sort) params.append('sort', sort);
    params.append('page', page);
    params.append('limit', LIMIT);
    axios.get(`/api/products?${params}`)
      .then(res => {
        setProducts(res.data.products);
        setTotal(res.data.total);
        setPages(res.data.pages);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [category, search, sort, page]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleCategoryChange = (cat) => {
    setCategory(cat);
    setPage(1);
  };

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleSortChange = (e) => {
    setSort(e.target.value);
    setPage(1);
  };

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
            <button key={cat} onClick={() => handleCategoryChange(cat)}
              className={`cat-btn ${category === cat ? 'active' : ''}`}>
              {cat === '' ? 'All Products' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </aside>

        {/* Main */}
        <div className="shop-main">
          {isAuthenticated && (
            <AISearchBar
              onResults={(prods) => setAiProducts(prods)}
              onClear={() => setAiProducts(null)}
            />
          )}
          <div className="shop-toolbar">
            <input placeholder="🔍 Search products..." value={search}
              onChange={handleSearchChange} className="search-input" />
            <select value={sort} onChange={handleSortChange}>
              <option value="">Sort: Latest</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </div>

          {loading ? (
            <div className="loading">Loading products...</div>
          ) : (
            <>
              {aiProducts ? (
                <>
                  <p className="results-count">✨ {aiProducts.length} AI-matched product{aiProducts.length !== 1 ? 's' : ''}</p>
                  <div className="products-grid">
                    {aiProducts.length > 0 ? aiProducts.map(p => (
                      <ProductCard key={p._id} product={p} />
                    )) : <div className="empty-state">No matching products found</div>}
                  </div>
                </>
              ) : (
              <>
              {total > 0 && (
                <p className="results-count">{total} product{total !== 1 ? 's' : ''} found</p>
              )}
              <div className="products-grid">
                {products.length > 0 ? products.map(p => (
                  <ProductCard key={p._id} product={p} />
                )) : (
                  <div className="empty-state">No products found</div>
                )}
              </div>

              {pages > 1 && (
                <div className="pagination">
                  <button
                    className="page-btn"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    ← Prev
                  </button>
                  {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      className={`page-btn ${p === page ? 'active' : ''}`}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    className="page-btn"
                    onClick={() => setPage(p => Math.min(pages, p + 1))}
                    disabled={page === pages}
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
            )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShopPage;
