import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../utils/axios';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import './ProductPage.css';

const StarRating = ({ value, onChange, size = 'md' }) => (
  <div className={`star-row star-${size}`}>
    {[1, 2, 3, 4, 5].map(n => (
      <span
        key={n}
        className={n <= Math.round(value) ? 'star filled' : 'star'}
        onClick={() => onChange && onChange(n)}
        style={{ cursor: onChange ? 'pointer' : 'default' }}
      >★</span>
    ))}
  </div>
);

const ProductPage = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState([]);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [submitting, setSubmitting] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);
  const { addToCart } = useCart();
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    axios.get(`/api/products/${id}`)
      .then(res => { setProduct(res.data); setLoading(false); })
      .catch(() => { setLoading(false); navigate('/shop'); });
    axios.get(`/api/products/${id}/reviews`)
      .then(res => { setReviews(res.data); })
      .catch(() => {});
  }, [id, navigate]);

  useEffect(() => {
    if (user && reviews.length) {
      setHasReviewed(reviews.some(r => r.user === user._id || r.user?._id === user._id));
    }
  }, [reviews, user]);

  const handleAdd = () => {
    for (let i = 0; i < qty; i++) addToCart(product);
    toast.success(`${qty} × ${product.name} added to cart!`);
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!reviewForm.comment.trim()) return toast.error('Please write a comment');
    setSubmitting(true);
    try {
      const res = await axios.post(`/api/products/${id}/reviews`, reviewForm);
      setReviews(prev => [res.data, ...prev]);
      setHasReviewed(true);
      setReviewForm({ rating: 5, comment: '' });
      toast.success('Review submitted!');
      setProduct(prev => ({
        ...prev,
        numReviews: prev.numReviews + 1,
      }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit review');
    }
    setSubmitting(false);
  };

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm('Delete this review?')) return;
    try {
      await axios.delete(`/api/products/${id}/reviews/${reviewId}`);
      setReviews(prev => prev.filter(r => r._id !== reviewId));
      toast.success('Review deleted');
    } catch {
      toast.error('Failed to delete review');
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (!product) return null;

  const avgRating = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;

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
          {product.numReviews > 0 && (
            <div className="product-rating-row">
              <StarRating value={product.rating} />
              <span className="rating-text">{product.rating} ({product.numReviews} review{product.numReviews !== 1 ? 's' : ''})</span>
            </div>
          )}
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

      {/* Reviews Section */}
      <div className="reviews-section">
        <h2 className="reviews-title">
          Customer Reviews
          {reviews.length > 0 && (
            <span className="reviews-summary">
              <StarRating value={avgRating} />
              <span>{avgRating.toFixed(1)} out of 5 &bull; {reviews.length} review{reviews.length !== 1 ? 's' : ''}</span>
            </span>
          )}
        </h2>

        {/* Review rating breakdown */}
        {reviews.length > 0 && (
          <div className="rating-breakdown">
            {[5, 4, 3, 2, 1].map(star => {
              const count = reviews.filter(r => r.rating === star).length;
              const pct = reviews.length ? (count / reviews.length) * 100 : 0;
              return (
                <div key={star} className="rating-bar-row">
                  <span className="bar-label">{star} ★</span>
                  <div className="rating-bar">
                    <div className="rating-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="bar-count">{count}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Submit review form */}
        {isAuthenticated && !hasReviewed && user?.role === 'consumer' && (
          <form className="review-form" onSubmit={handleSubmitReview}>
            <h3>Write a Review</h3>
            <div className="review-form-rating">
              <label>Your Rating</label>
              <StarRating value={reviewForm.rating} onChange={r => setReviewForm(f => ({ ...f, rating: r }))} size="lg" />
            </div>
            <textarea
              className="review-textarea"
              placeholder="Share your experience with this product..."
              value={reviewForm.comment}
              onChange={e => setReviewForm(f => ({ ...f, comment: e.target.value }))}
              rows={4}
              required
            />
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Review'}
            </button>
          </form>
        )}

        {isAuthenticated && hasReviewed && (
          <div className="already-reviewed">✅ You have already reviewed this product</div>
        )}

        {!isAuthenticated && (
          <div className="login-to-review">
            <button className="btn-outline" onClick={() => navigate('/login')}>Login to write a review</button>
          </div>
        )}

        {/* Reviews list */}
        {reviews.length === 0 ? (
          <div className="no-reviews">No reviews yet. Be the first to review this product!</div>
        ) : (
          <div className="reviews-list">
            {reviews.map(r => (
              <div key={r._id} className="review-card">
                <div className="review-header">
                  <div className="reviewer-avatar">{r.userName?.charAt(0)}</div>
                  <div className="reviewer-info">
                    <span className="reviewer-name">{r.userName}</span>
                    <span className="review-date">{new Date(r.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                  <StarRating value={r.rating} />
                  {(user?._id === r.user || user?.role === 'admin') && (
                    <button className="delete-review-btn" onClick={() => handleDeleteReview(r._id)}>🗑️</button>
                  )}
                </div>
                <p className="review-comment">{r.comment}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductPage;
