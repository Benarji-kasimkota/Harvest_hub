import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import './Navbar.css';

const Navbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const { totalItems } = useCart();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = () => { logout(); navigate('/'); setDropdownOpen(false); };

  return (
    <nav className="navbar">
      <div className="container navbar-inner">
        <Link to="/" className="logo">🌿 HarvestHub</Link>
        <div className={`nav-links ${menuOpen ? 'open' : ''}`}>
          <Link to="/">Home</Link>
          <Link to="/shop">Shop</Link>
          {isAuthenticated ? (
            <div className="user-dropdown" ref={dropdownRef}>
              <button className="user-btn" onClick={() => setDropdownOpen(!dropdownOpen)}>
                <span className="user-initial">{user?.name?.charAt(0)}</span>
                {user?.name?.split(' ')[0]} ▾
              </button>
              {dropdownOpen && (
                <div className="dropdown-menu">
                  <Link to="/account" className="dropdown-item" onClick={() => setDropdownOpen(false)}>👤 My Account</Link>
                  <Link to="/orders" className="dropdown-item" onClick={() => setDropdownOpen(false)}>📦 My Orders</Link>
                  {user?.role === 'admin' && <Link to="/admin" className="dropdown-item" onClick={() => setDropdownOpen(false)}>⚙️ Admin Panel</Link>}
                  {user?.role === 'retailer' && <Link to="/retailer" className="dropdown-item" onClick={() => setDropdownOpen(false)}>🛒 Retailer Portal</Link>}
                  {user?.role === 'delivery' && <Link to="/delivery" className="dropdown-item" onClick={() => setDropdownOpen(false)}>🚚 Delivery Portal</Link>}
                  <div className="dropdown-divider" />
                  <button onClick={handleLogout} className="dropdown-item logout-item">🚪 Logout</button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="btn-nav-login">Login / Sign Up</Link>
          )}
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
