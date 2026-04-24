import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import HomePage from './pages/HomePage';
import ShopPage from './pages/ShopPage';
import ProductPage from './pages/ProductPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import OrdersPage from './pages/OrdersPage';
import AccountPage from './pages/AccountPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import RetailerDashboard from './pages/retailer/RetailerDashboard';
import DeliveryDashboard from './pages/delivery/DeliveryDashboard';
import PrivateRoute from './components/common/PrivateRoute';
import CustomCursor from './components/common/CustomCursor';
import AIChatbot from './components/common/AIChatbot';
import './App.css';

const RoleRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" />;
  if (!allowedRoles.includes(user?.role)) return <Navigate to="/" />;
  return children;
};

const ConsumerLayout = ({ children }) => (
  <><Navbar /><main>{children}</main><Footer /></>
);

const ChatbotWrapper = () => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <AIChatbot /> : null;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<ConsumerLayout><HomePage /></ConsumerLayout>} />
      <Route path="/shop" element={<ConsumerLayout><ShopPage /></ConsumerLayout>} />
      <Route path="/product/:id" element={<ConsumerLayout><ProductPage /></ConsumerLayout>} />
      <Route path="/cart" element={<ConsumerLayout><CartPage /></ConsumerLayout>} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/checkout" element={<ConsumerLayout><PrivateRoute><CheckoutPage /></PrivateRoute></ConsumerLayout>} />
      <Route path="/orders" element={<ConsumerLayout><PrivateRoute><OrdersPage /></PrivateRoute></ConsumerLayout>} />
      <Route path="/account" element={<ConsumerLayout><PrivateRoute><AccountPage /></PrivateRoute></ConsumerLayout>} />
      <Route path="/admin/*" element={<RoleRoute allowedRoles={['admin']}><AdminDashboard /></RoleRoute>} />
      <Route path="/retailer/*" element={<RoleRoute allowedRoles={['retailer','admin']}><RetailerDashboard /></RoleRoute>} />
      <Route path="/delivery/*" element={<RoleRoute allowedRoles={['delivery','admin']}><DeliveryDashboard /></RoleRoute>} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <Router>
          <CustomCursor />
          <Toaster position="top-right" />
          <AppRoutes />
          <ChatbotWrapper />
        </Router>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
