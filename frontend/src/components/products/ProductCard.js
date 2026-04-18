import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import toast from 'react-hot-toast';
import './ProductCard.css';

const ProductCard = ({ product }) => {
  const { addToCart, removeFromCart, items, updateQuantity } = useCart();
  const cartItem = items.find(i => i._id === product._id);
  const qty = cartItem ? cartItem.quantity : 0;

  const handleAdd = (e) => {
    e.preventDefault();
    addToCart(product);
    if (qty === 0) toast.success(`${product.name} added! 🛒`);
  };

  const handleRemove = (e) => {
    e.preventDefault();
    if (qty === 1) removeFromCart(product._id);
    else updateQuantity(product._id, qty - 1);
  };

  return (
    <Link to={`/product/${product._id}`} className="product-card card">
      <div className="product-img-wrapper">
        <img src={product.image} alt={product.name} />
        <span className={`badge ${product.stock > 0 ? 'badge-green' : 'badge-orange'}`}>
          {product.stock > 0 ? 'In Stock' : 'Out of Stock'}
        </span>
      </div>
      <div className="product-info">
        <span className="product-category">{product.category}</span>
        <h3>{product.name}</h3>
        <p className="product-farmer">🌾 {product.farmer}</p>
        <div className="product-footer">
          <span className="product-price">${product.price}<span className="unit">/{product.unit}</span></span>
          {product.stock > 0 && (
            qty === 0 ? (
              <button onClick={handleAdd} className="add-btn">+ Add</button>
            ) : (
              <div className="qty-control" onClick={e => e.preventDefault()}>
                <button onClick={handleRemove} className="qty-btn">−</button>
                <span className="qty-num">{qty}</span>
                <button onClick={handleAdd} className="qty-btn">+</button>
              </div>
            )
          )}
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;
