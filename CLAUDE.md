# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend
```bash
cd backend
npm run dev        # Start dev server with nodemon (port 5000)
npm start          # Start production server
npm run seed       # Seed DB with 18 sample products
npm run seed:api   # Seed DB from external API
```

### Frontend
```bash
cd frontend
npm start          # Start React dev server (port 3000)
npm run build      # Production build
npm test           # Run tests (React Testing Library + Jest)
```

## Architecture

HarvestHub is a MERN stack e-commerce platform for fresh produce. The repo has two independent apps: `backend/` (Express REST API) and `frontend/` (Create React App).

### Backend structure
- `server.js` — Express app setup, MongoDB connection via Mongoose, mounts all route files
- `middleware/auth.js` — JWT `protect` middleware + role guards (`admin`, `retailer`, `delivery`)
- `models/` — Mongoose schemas: User, Product, Order, SupportTicket
- `controllers/` — Business logic, one file per domain
- `routes/` — Thin route files that wire HTTP verbs to controller functions

### Frontend structure
- `src/App.js` — React Router setup, wraps everything in `AuthProvider` and `CartProvider`
- `src/context/AuthContext.js` — JWT token management; stores `token` and `user` in localStorage
- `src/context/CartContext.js` — Cart state; persists `cart` array to localStorage
- `src/utils/axios.js` — Axios instance that auto-attaches `Authorization: Bearer <token>` header
- `src/pages/` — One file per page; role-specific dashboards live in `admin/`, `retailer/`, `delivery/` subdirs
- `src/components/common/PrivateRoute.js` — Wraps protected routes; redirects unauthenticated users

### Auth & roles
JWT tokens expire in 30 days. Four roles: `consumer` (default), `retailer` (requires admin approval, status starts `pending`), `delivery`, `admin`. Role checks are enforced both in backend middleware and frontend route guards.

### API base URL
The frontend `axios` instance reads `REACT_APP_API_URL` from `.env` and falls back to auto-detecting GitHub Codespaces URLs. The backend runs on port 5000 by default.

## Environment variables

**Backend `.env`:**
```
PORT=5000
MONGO_URI=<mongodb connection string>
JWT_SECRET=<secret>
STRIPE_SECRET_KEY=<sk_test_...>
CLIENT_URL=http://localhost:3000
EMAIL_USER=<gmail address>
EMAIL_PASS=<gmail app password>
ADMIN_EMAIL=<admin notification address>
```

**Frontend `.env`:**
```
REACT_APP_API_URL=http://localhost:5000
REACT_APP_STRIPE_PUBLIC_KEY=<pk_test_...>
```

## Key data model notes
- `Order.items[].retailer` links each line item to the retailer who owns the product
- `Order.deliveryPerson` is populated when a delivery user accepts the order
- `User.status` of `pending` blocks retailer login until an admin approves them
- Product categories are strictly one of: `vegetables`, `fruits`, `meat`, `dairy`, `grains`
