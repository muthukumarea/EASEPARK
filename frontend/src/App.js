import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import './index.css';

import Register from './pages/auth/Register';
import Login from './pages/auth/Login';
import OtpVerify from './pages/auth/OtpVerify';

import Home from './pages/user/Home';
import ParkingDetail from './pages/user/ParkingDetail';
import BookingPage from './pages/user/BookingPage';
import PaymentPage from './pages/user/PaymentPage';
import Dashboard from './pages/user/Dashboard';

import AdminDashboard from './pages/admin/AdminDashboard';
import AdminParkings from './pages/admin/AdminParkings';
import AdminSlots from './pages/admin/AdminSlots';
import AdminBookings from './pages/admin/AdminBookings';
import AuditLogs from './pages/admin/AuditLogs';

import AppLayout from './components/common/AppLayout';

const getConnectionLabel = () => {
  if (typeof navigator === 'undefined') return '';

  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const effectiveType = connection?.effectiveType || '';

  if (effectiveType === 'slow-2g' || effectiveType === '2g') return 'Slow network detected';
  if (effectiveType === '3g') return 'Limited network speed';

  return '';
};

function NetworkStatusBanner() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [connectionHint, setConnectionHint] = useState(getConnectionLabel());

  useEffect(() => {
    const updateStatus = () => {
      setOnline(navigator.onLine);
      setConnectionHint(getConnectionLabel());
    };

    updateStatus();
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    connection?.addEventListener?.('change', updateStatus);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      connection?.removeEventListener?.('change', updateStatus);
    };
  }, []);

  if (!online) {
    return (
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        padding: '10px 16px',
        background: '#7f1d1d',
        color: '#fff7ed',
        textAlign: 'center',
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: '0.01em',
      }}>
        You are offline. Cached data may still appear, but new requests will wait for the network to return.
      </div>
    );
  }

  if (connectionHint) {
    return (
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 999,
        padding: '10px 16px',
        background: '#78350f',
        color: '#fffbeb',
        textAlign: 'center',
        fontSize: 13,
        fontWeight: 600,
      }}>
        {connectionHint}. EasePark will retry safe requests and use recent cached data when possible.
      </div>
    );
  }

  return null;
}

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--ink)' }}>
      <div style={{ color:'rgba(255,255,255,0.5)', fontSize:14 }}>Loading...</div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />;
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/verify-otp" element={<OtpVerify />} />

      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Home />} />
        <Route path="parking/:id" element={<ParkingDetail />} />
        <Route path="booking/:slotId" element={<BookingPage />} />
        <Route path="payment/:bookingId" element={<PaymentPage />} />
        <Route path="dashboard" element={<Dashboard />} />
      </Route>

      <Route path="/admin" element={<ProtectedRoute adminOnly><AppLayout isAdmin /></ProtectedRoute>}>
        <Route index element={<AdminDashboard />} />
        <Route path="parkings" element={<AdminParkings />} />
        <Route path="slots" element={<AdminSlots />} />
        <Route path="bookings" element={<AdminBookings />} />
        <Route path="audit-logs" element={<AuditLogs />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <NetworkStatusBanner />
        <AppRoutes />
        <Toaster position="top-right" toastOptions={{
          style: { borderRadius:12, fontSize:13.5, fontFamily:"'Plus Jakarta Sans',sans-serif", boxShadow:'0 8px 24px rgba(0,0,0,0.12)' },
          success: { iconTheme: { primary:'#06d6a0', secondary:'#fff' } },
          error: { iconTheme: { primary:'#ef476f', secondary:'#fff' } },
        }} />
      </AuthProvider>
    </BrowserRouter>
  );
}
