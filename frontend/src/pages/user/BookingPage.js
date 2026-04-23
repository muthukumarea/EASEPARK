import React, { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { bookSlot } from '../../services/api';

export default function BookingPage() {
  const { slotId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { slot, parking } = location.state || {};
  const [duration, setDuration] = useState(1);
  const [loading, setLoading] = useState(false);

  if (!slot || !parking) { navigate('/'); return null; }

  const amount = parseFloat((parking.price_per_hour * duration).toFixed(2));
  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + duration * 3600 * 1000);

  const handleBook = async () => {
    setLoading(true);
    try {
      const res = await bookSlot({ slot_id: parseInt(slotId), duration_hours: duration });
      toast.success('Slot reserved! Proceeding to payment...');
      navigate(`/payment/${res.data.data.booking_id}`, { state: { booking: res.data.data, slot, parking } });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Booking failed. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="page fade-up" style={{ maxWidth: 540 }}>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 18 }}>← Back</button>

      <div className="page-head">
        <h1>Confirm Booking</h1>
        <p>Review details and choose your duration</p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><h3>Booking Summary</h3></div>
        <div className="card-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              ['Parking', parking.name],
              ['Address', parking.address],
              ['Slot', slot.slot_number],
              ['Rate', `₹${parking.price_per_hour}/hr`],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-muted" style={{ fontSize: 13 }}>{k}</span>
                <strong style={{ fontSize: 14 }}>{v}</strong>
              </div>
            ))}

            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

            {/* Duration picker */}
            <div>
              <span className="text-muted" style={{ fontSize: 13, display: 'block', marginBottom: 10 }}>Duration</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <button className="btn btn-ghost btn-sm" style={{ width: 36, height: 36, padding: 0, fontSize: 20 }}
                  onClick={() => setDuration(d => Math.max(0.5, d - 0.5))}>−</button>
                <div style={{ textAlign: 'center', minWidth: 80 }}>
                  <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-1px', color: 'var(--ink)' }}>{duration}h</div>
                </div>
                <button className="btn btn-ghost btn-sm" style={{ width: 36, height: 36, padding: 0, fontSize: 20 }}
                  onClick={() => setDuration(d => Math.min(24, d + 0.5))}>+</button>
              </div>
              <div className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>
                {startTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} →{' '}
                {endTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>

            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-muted" style={{ fontSize: 13 }}>Total Amount</span>
              <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent)', letterSpacing: '-1px' }}>₹{amount}</span>
            </div>
          </div>
        </div>
      </div>

      <button className={`btn btn-primary btn-lg btn-block${loading ? ' btn-load' : ''}`}
        onClick={handleBook} disabled={loading}>
        {loading ? '' : 'Proceed to Payment →'}
      </button>
    </div>
  );
}
