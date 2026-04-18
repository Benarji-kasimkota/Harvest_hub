import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../utils/axios';
import { useCart } from '../context/CartContext';
import toast from 'react-hot-toast';
import './ProductPage.css';

const ProductPage = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);
  const { addToCart } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    axios.get(`/api/products/${id}`)
      .then(res => { setProduct(res.data); setLoading(false); })
      .catch(() => { setLoading(false); navigate('/shop'); });
  }, [id]);

  const handleAdd = () => {
    for (let i = 0; i < qty; i++) addToCart(product);
    toast.success(`${qty} × ${product.name} added to cart! 🛒`);
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (!product) return null;

  return (
    <div className="container product-page">
      <button onClick={() => navigate(-1)} className="back-btn">← Back</button>
      <div className="product-detail">
        <div className="product-detail-img">
          <img src={product.image} alt={product.name} />
        </div>
        <div className="product-detail-info">
          <span className="badge badge-green">{product.category}</span>
          <h1>{product.name}</h1>
          <p className="detail-farmer">🌾 {product.farmer}</p>
          <p className="detail-desc">{product.description}</p>
          <p className="detail-price">${product.price}<span>/{product.unit}</span></p>
          <div className="detail-stock">
            {product.stock > 0
              ? <span className="in-stock">✅ In Stock ({product.stock} {product.unit} available)</span>
              : <span className="out-stock">❌ Out of Stock</span>}
          </div>
          {product.stock > 0 && (
            <div className="detail-actions">
              <div className="qty-selector">
                <button onClick={() => setQty(Math.max(1, qty - 1))}>-</button>
                <span>{qty}</span>
                <button onClick={() => setQty(Math.min(product.stock, qty + 1))}>+</button>
              </div>
              <button onClick={handleAdd} className="btn-primary add-to-cart-btn">
                🛒 Add to Cart
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductPage;
