import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getDashboard } from '../../services/api';

const statusBadge = (s) => {
  const m = { confirmed:'badge-success', pending:'badge-warning', cancelled:'badge-danger', expired:'badge-gray' };
  return <span className={`badge ${m[s]||'badge-gray'}`}>{s}</span>;
};

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { const r = await getDashboard(); setData(r.data.data); }
    catch { toast.error('Failed to load dashboard'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="page"><p className="text-muted">Loading...</p></div>;
  if (!data) return null;
  const { stats, recentBookings } = data;

  return (
    <div className="page fade-up">
      <div className="page-head">
        <h1>Dashboard</h1>
        <p>EasePark operations overview</p>
      </div>

      <div className="stats">
        <div className="stat s-green"><div className="stat-icon">💰</div><div className="stat-label">Total Revenue</div><div className="stat-val">₹{Number(stats.totalRevenue).toLocaleString('en-IN')}</div><div className="stat-sub">Today: ₹{Number(stats.todayRevenue).toLocaleString('en-IN')}</div></div>
        <div className="stat s-blue"><div className="stat-icon">📋</div><div className="stat-label">Bookings</div><div className="stat-val">{stats.totalBookings}</div><div className="stat-sub">{stats.confirmedBookings} confirmed</div></div>
        <div className="stat s-orange"><div className="stat-icon">🏢</div><div className="stat-label">Parking Lots</div><div className="stat-val">{stats.totalParkings}</div></div>
        <div className="stat"><div className="stat-icon">🅿️</div><div className="stat-label">Slots</div><div className="stat-val">{stats.totalSlots}</div><div className="stat-sub">{stats.availableSlots} available</div></div>
        <div className="stat s-red"><div className="stat-icon">👤</div><div className="stat-label">Users</div><div className="stat-val">{stats.totalUsers}</div></div>
      </div>

      <div className="card">
        <div className="card-head"><h3>Recent Bookings</h3></div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Ref</th><th>User</th><th>Parking</th><th>Slot</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {recentBookings.length === 0
                ? <tr><td colSpan={7} style={{ textAlign:'center', color:'var(--muted)', padding:32 }}>No bookings yet</td></tr>
                : recentBookings.map(b => (
                  <tr key={b.id}>
                    <td><code style={{ fontSize:11 }}>{b.booking_ref}</code></td>
                    <td style={{ fontWeight:500 }}>{b.user_name}</td>
                    <td>{b.parking_name}</td>
                    <td><span className="badge badge-teal">{b.slot_number}</span></td>
                    <td><strong>₹{b.amount}</strong></td>
                    <td>{statusBadge(b.status)}</td>
                    <td className="text-muted" style={{ fontSize:12 }}>{new Date(b.created_at).toLocaleDateString('en-IN')}</td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
