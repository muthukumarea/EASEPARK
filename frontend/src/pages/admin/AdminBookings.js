import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getAllBookings, cancelBooking, endBooking } from '../../services/api';

const statusBadge = (status) => {
  const classes = {
    confirmed: 'badge-success',
    completed: 'badge-teal',
    overstayed: 'badge-warning',
    pending: 'badge-warning',
    cancelled: 'badge-danger',
    expired: 'badge-gray',
  };

  return <span className={`badge ${classes[status] || 'badge-gray'}`}>{status}</span>;
};

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getAllBookings({ status: filter || undefined });
      setBookings(r.data.data.bookings);
    } catch {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this booking and release the slot?')) return;
    setBusyId(id);
    try {
      await cancelBooking(id, 'Admin cancelled');
      toast.success('Booking cancelled');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleEndBooking = async (id) => {
    if (!window.confirm('End this active booking now?')) return;
    setBusyId(id);
    try {
      await endBooking(id);
      toast.success('Booking ended and slot released');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setBusyId(null);
    }
  };

  const activeCount = bookings.filter((booking) => booking.status === 'confirmed').length;
  const overstayedCount = bookings.filter((booking) => booking.status === 'overstayed').length;
  const totalRevenue = bookings.reduce((sum, booking) => sum + parseFloat(booking.final_amount ?? booking.amount ?? 0), 0);

  return (
    <div className="page fade-up">
      <div className="page-head-row">
        <div className="page-head" style={{ marginBottom: 0 }}>
          <h1>All Bookings</h1>
          <p>Professional overview of active, completed, and overstayed sessions</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={load}>Refresh</button>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '18px 0' }}>
        {['', 'confirmed', 'completed', 'overstayed', 'pending', 'cancelled', 'expired'].map((status) => (
          <button key={status} className={`btn btn-sm ${filter === status ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(status)}>
            {status || 'All'}
          </button>
        ))}
      </div>

      <section className="admin-booking-shell">
        <div className="admin-booking-head">
          <div>
            <div className="admin-booking-title">Booking Operations Desk</div>
            <div className="admin-booking-sub">Track active stays, close sessions manually, and spot overstays quickly.</div>
          </div>
          <div className="admin-booking-stats">
            <div className="admin-mini-stat">
              <div className="admin-mini-stat-label">Active</div>
              <div className="admin-mini-stat-value">{activeCount}</div>
            </div>
            <div className="admin-mini-stat">
              <div className="admin-mini-stat-label">Overstayed</div>
              <div className="admin-mini-stat-value">{overstayedCount}</div>
            </div>
            <div className="admin-mini-stat">
              <div className="admin-mini-stat-label">Shown Revenue</div>
              <div className="admin-mini-stat-value">Rs.{totalRevenue.toFixed(0)}</div>
            </div>
          </div>
        </div>

        <div className="tbl-wrap">
          {loading ? <p style={{ padding: 24 }} className="text-muted">Loading...</p> : (
            <table>
              <thead>
                <tr><th>Ref</th><th>User</th><th>Parking / Slot</th><th>Booked For</th><th>Charges</th><th>Payment</th><th>Status</th><th>Timing</th><th></th></tr>
              </thead>
              <tbody>
                {bookings.length === 0
                  ? <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>No bookings found</td></tr>
                  : bookings.map((booking) => (
                    <tr key={booking.id}>
                      <td><code style={{ fontSize: 11, background: 'var(--bg)', padding: '2px 6px', borderRadius: 4 }}>{booking.booking_ref}</code></td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{booking.user_name}</div>
                        <div className="text-muted" style={{ fontSize: 11 }}>{booking.user_email}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{booking.parking_name}</div>
                        <span className="badge badge-teal" style={{ marginTop: 2 }}>{booking.slot_number}</span>
                      </td>
                      <td className="text-muted">{booking.duration_hours}h</td>
                      <td>
                        <div><strong>Rs.{booking.final_amount ?? booking.amount}</strong></div>
                        {parseFloat(booking.overstay_amount || 0) > 0 && (
                          <div className="text-muted" style={{ fontSize: 11 }}>Extra: Rs.{booking.overstay_amount}</div>
                        )}
                      </td>
                      <td>
                        {booking.payment_status
                          ? <span className={`badge ${booking.payment_status === 'success' ? 'badge-success' : 'badge-warning'}`}>{booking.payment_status}</span>
                          : <span className="badge badge-gray">-</span>}
                      </td>
                      <td>{statusBadge(booking.status)}</td>
                      <td className="text-muted" style={{ fontSize: 12 }}>
                        <div>Start: {new Date(booking.start_time).toLocaleString('en-IN')}</div>
                        <div>End: {new Date(booking.end_time).toLocaleString('en-IN')}</div>
                        {booking.released_at && <div>Released: {new Date(booking.released_at).toLocaleString('en-IN')}</div>}
                        {parseInt(booking.overstay_minutes || 0, 10) > 0 && <div>Overstay: {booking.overstay_minutes} min</div>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {booking.status === 'confirmed' && (
                            <button className="btn btn-sm btn-dark-soft" disabled={busyId === booking.id} onClick={() => handleEndBooking(booking.id)}>
                              {busyId === booking.id ? '...' : 'End'}
                            </button>
                          )}
                          {['pending', 'confirmed'].includes(booking.status) && (
                            <button className="btn btn-danger-soft btn-sm" disabled={busyId === booking.id} onClick={() => handleCancel(booking.id)}>
                              {busyId === booking.id ? '...' : 'Cancel'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}
