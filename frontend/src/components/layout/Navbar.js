import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import './Navbar.css';

const Navbar = () => {
  const { isAuthenticated, logout } = useAuth();
  const { totalItems } = useCart();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="logo">🌿 HarvestHub</Link>
        <div className={`nav-links ${menuOpen ? 'open' : ''}`}>
          <Link to="/">Home</Link>
          <Link to="/shop">Shop</Link>
          {isAuthenticated && <Link to="/orders">My Orders</Link>}
          {isAuthenticated
            ? <button onClick={handleLogout} className="btn-nav-logout">Logout</button>
            : <Link to="/login" className="btn-nav-login">Login / Sign Up</Link>
          }
          <Link to="/cart" className="cart-icon">
            🛒 {totalItems > 0 && <span className="cart-badge">{totalItems}</span>}
          </Link>
        </div>
        <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
      </div>
    </nav>
  );
};

export default Navbar;
