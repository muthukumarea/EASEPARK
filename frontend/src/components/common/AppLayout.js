import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

const userNav = [
  { to:'/', icon:'🗺️', label:'Find Parking', end:true },
  { to:'/dashboard', icon:'📋', label:'My Bookings' },
];
const adminNav = [
  { to:'/admin', icon:'📊', label:'Dashboard', end:true },
  { to:'/admin/parkings', icon:'🏢', label:'Parkings' },
  { to:'/admin/slots', icon:'🅿️', label:'Slots' },
  { to:'/admin/bookings', icon:'📋', label:'All Bookings' },
  { to:'/admin/audit-logs', icon:'🔐', label:'Audit Logs' },
];

export default function AppLayout({ isAdmin }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const navItems = isAdmin ? adminNav : userNav;
  const initials = (user?.name || 'U').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();

  const handleLogout = () => {
    logout();
    toast.success('Signed out');
    navigate('/login');
  };

  return (
    <div className="app-wrap">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="sidebar-logo">
            <div className="sidebar-logo-icon">🅿️</div>
            <span className="sidebar-logo-text">Ease<em>Park</em></span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-group-label">{isAdmin ? 'Administration' : 'Navigation'}</div>
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.end}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{initials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{user?.name || 'User'}</div>
              <div className="sidebar-user-role">{user?.role}</div>
            </div>
            <button className="btn-logout" onClick={handleLogout} title="Sign out">↗</button>
          </div>
        </div>
      </aside>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
