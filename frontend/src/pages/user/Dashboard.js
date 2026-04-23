import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getMyBookings, cancelBooking, endBooking } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

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

const formatMoney = (value) => `Rs.${Number(value || 0).toFixed(2)}`;

const formatCountdown = (endTime) => {
  const diff = new Date(endTime).getTime() - Date.now();

  if (diff <= 0) return 'Ending shortly';

  const totalMinutes = Math.floor(diff / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
};

export default function Dashboard() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [filter, setFilter] = useState('');
  const [graceMinutes, setGraceMinutes] = useState(10);
  const [, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMyBookings({ status: filter || undefined });
      setBookings(res.data.data.bookings);
      setGraceMinutes(res.data.data.grace_minutes || 10);
    } catch {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const handleCancel = async (id) => {
    if (!window.confirm('Cancel this booking?')) return;
    setBusyId(id);
    try {
      await cancelBooking(id, 'User requested cancellation');
      toast.success('Booking cancelled and slot released');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cancel failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleEndBooking = async (id) => {
    if (!window.confirm('End this booking and release the slot now?')) return;
    setBusyId(id);
    try {
      const res = await endBooking(id);
      const data = res.data.data;
      toast.success(
        data.overstay_amount > 0
          ? `Booking closed. Extra charge: ${formatMoney(data.overstay_amount)}`
          : 'Booking ended and slot released'
      );
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to end booking');
    } finally {
      setBusyId(null);
    }
  };

  const activeCount = bookings.filter((booking) => booking.status === 'confirmed').length;
  const completedCount = bookings.filter((booking) => ['completed', 'overstayed'].includes(booking.status)).length;
  const overstayedCount = bookings.filter((booking) => booking.status === 'overstayed').length;
  const totalSpent = bookings
    .filter((booking) => ['confirmed', 'completed', 'overstayed'].includes(booking.status))
    .reduce((sum, booking) => sum + parseFloat(booking.final_amount ?? booking.amount ?? 0), 0);

  return (
    <div className="page fade-up">
      <section className="booking-hero">
        <div>
          <div className="text-muted" style={{ color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>Account overview</div>
          <h1>{user?.name}, manage bookings with confidence</h1>
          <p>
            Active sessions update automatically, manual checkout is available, and overstay charges start only after a {graceMinutes}-minute grace period.
          </p>
        </div>
        <div className="booking-hero-stats">
          <div className="booking-stat">
            <div className="booking-stat-label">Active</div>
            <div className="booking-stat-value">{activeCount}</div>
          </div>
          <div className="booking-stat">
            <div className="booking-stat-label">Completed</div>
            <div className="booking-stat-value">{completedCount}</div>
          </div>
          <div className="booking-stat">
            <div className="booking-stat-label">Overstayed</div>
            <div className="booking-stat-value">{overstayedCount}</div>
          </div>
          <div className="booking-stat">
            <div className="booking-stat-label">Total Spend</div>
            <div className="booking-stat-value">Rs.{totalSpent.toFixed(0)}</div>
          </div>
        </div>
      </section>

      <div className="booking-toolbar">
        <div className="page-head" style={{ marginBottom: 0 }}>
          <h1>My Bookings</h1>
          <p>Live countdowns, clean summaries, and quick actions</p>
        </div>
        <div className="booking-filter-row">
          {['', 'confirmed', 'completed', 'overstayed', 'pending', 'cancelled', 'expired'].map((status) => (
            <button
              key={status}
              className={`btn btn-sm ${filter === status ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFilter(status)}
            >
              {status || 'All'}
            </button>
          ))}
        </div>
      </div>

      {loading ? <p className="text-muted">Loading...</p>
      : bookings.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">B</div>
          <h3>No bookings yet</h3>
          <p>Your parking history will appear here once you make a reservation</p>
        </div>
      ) : (
        <div className="booking-grid">
          {bookings.map((booking) => (
            <article className="booking-card" key={booking.id}>
              <div className="booking-card-top">
                <div>
                  <div className="booking-card-title">{booking.parking_name}</div>
                  <div className="booking-card-sub">{booking.address}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  <span className="booking-code">{booking.booking_ref}</span>
                  {statusBadge(booking.status)}
                </div>
              </div>

              <div className="booking-meta">
                <div className="booking-meta-card">
                  <div className="booking-meta-label">Slot</div>
                  <div className="booking-meta-value">{booking.slot_number}</div>
                </div>
                <div className="booking-meta-card">
                  <div className="booking-meta-label">Booked For</div>
                  <div className="booking-meta-value">{booking.duration_hours}h</div>
                </div>
                <div className="booking-meta-card">
                  <div className="booking-meta-label">Final Charges</div>
                  <div className="booking-meta-value">{formatMoney(booking.final_amount ?? booking.amount)}</div>
                </div>
                <div className="booking-meta-card">
                  <div className="booking-meta-label">Extra Charge</div>
                  <div className="booking-meta-value mono">{formatMoney(booking.overstay_amount)}</div>
                </div>
              </div>

              <div className="booking-timeline">
                <div className="booking-tick">
                  <div className="booking-tick-label">Start</div>
                  <div className="booking-tick-value">{new Date(booking.start_time).toLocaleString('en-IN')}</div>
                </div>
                <div className="booking-tick">
                  <div className="booking-tick-label">Scheduled End</div>
                  <div className="booking-tick-value">{new Date(booking.end_time).toLocaleString('en-IN')}</div>
                </div>
                <div className="booking-tick">
                  <div className="booking-tick-label">Release</div>
                  <div className="booking-tick-value">{booking.released_at ? new Date(booking.released_at).toLocaleString('en-IN') : 'Still active'}</div>
                </div>
              </div>

              <div className="booking-footer">
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  {booking.status === 'confirmed' && (
                    <span className="booking-countdown">{formatCountdown(booking.end_time)}</span>
                  )}
                  {parseInt(booking.overstay_minutes || 0, 10) > 0 && (
                    <span className="booking-alert">Overstay: {booking.overstay_minutes} min</span>
                  )}
                </div>

                <div className="booking-actions">
                  {booking.status === 'confirmed' && (
                    <button className="btn btn-sm btn-dark-soft" disabled={busyId === booking.id} onClick={() => handleEndBooking(booking.id)}>
                      {busyId === booking.id ? '...' : 'End Booking'}
                    </button>
                  )}
                  {['pending', 'confirmed'].includes(booking.status) && (
                    <button className="btn btn-danger-soft btn-sm" disabled={busyId === booking.id} onClick={() => handleCancel(booking.id)}>
                      {busyId === booking.id ? '...' : 'Cancel'}
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
