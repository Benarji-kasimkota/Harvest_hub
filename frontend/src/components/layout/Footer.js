import React from 'react';
import { Link } from 'react-router-dom';
import './Footer.css';

const Footer = () => (
  <footer className="footer">
    <div className="container footer-inner">
      <div className="footer-brand">
        <h3>🌿 HarvestHub</h3>
        <p>Fresh from farm to your table. Quality vegetables, meat & dairy delivered to your door.</p>
      </div>
      <div className="footer-links">
        <h4>Quick Links</h4>
        <Link to="/">Home</Link>
        <Link to="/shop">Shop</Link>
        <Link to="/cart">Cart</Link>
      </div>
      <div className="footer-links">
        <h4>Categories</h4>
        <Link to="/shop?category=vegetables">Vegetables</Link>
        <Link to="/shop?category=meat">Meat</Link>
        <Link to="/shop?category=dairy">Dairy</Link>
        <Link to="/shop?category=fruits">Fruits</Link>
      </div>
      <div className="footer-links">
        <h4>Account</h4>
        <Link to="/login">Login</Link>
        <Link to="/register">Register</Link>
        <Link to="/orders">My Orders</Link>
      </div>
    </div>
    <div className="footer-bottom">
      <p>© 2024 HarvestHub. Built with 💚 by Benarji</p>
    </div>
  </footer>
);

export default Footer;
