import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getParkingById, getSlots } from '../../services/api';

export default function ParkingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [parking, setParking] = useState(null);
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [pRes, sRes] = await Promise.all([getParkingById(id), getSlots({ parking_id: id })]);
      setParking(pRes.data.data.parking);
      setSlots(sRes.data.data.slots);
    } catch { toast.error('Failed to load parking details'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="page"><p className="text-muted">Loading...</p></div>;
  if (!parking) return <div className="page"><p>Parking not found.</p></div>;

  const available = slots.filter(s => !s.is_booked).length;
  const booked = slots.length - available;
  const media = parking.media || [];

  return (
    <div className="page fade-up">
      <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 18 }}>← Back</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px', marginBottom: 4 }}>{parking.name}</h1>
          <p className="text-muted">📍 {parking.address}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--accent)', letterSpacing: '-1px' }}>₹{parking.price_per_hour}</div>
          <div className="text-muted" style={{ fontSize: 12 }}>per hour</div>
        </div>
      </div>

      {/* Summary row */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <span className="badge badge-success">🟢 {available} Available</span>
        <span className="badge badge-danger">🔴 {booked} Booked</span>
        {selectedSlot && <span className="badge badge-info">✓ Slot {selectedSlot.slot_number} selected</span>}
      </div>

      {media.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-head">
            <h3>Photos & Videos</h3>
            <span className="text-muted" style={{ fontSize: 12 }}>{media.length} uploaded</span>
          </div>
          <div className="card-body">
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:14 }}>
              {media.map((item) => (
                <div key={item.id} style={{ overflow:'hidden', borderRadius:16, background:'#f5f7fb' }}>
                  {item.type === 'image' ? (
                    <img src={item.url} alt={`${parking.name} preview`} style={{ width:'100%', height:180, objectFit:'cover' }} />
                  ) : (
                    <video src={item.url} controls style={{ width:'100%', height:180, objectFit:'cover' }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head">
          <h3>Choose a Slot</h3>
          <span className="text-muted" style={{ fontSize: 12 }}>{slots.length} total</span>
        </div>
        <div className="card-body">
          {slots.length === 0 ? (
            <div className="empty"><div className="empty-icon">🅿️</div><h3>No slots added yet</h3></div>
          ) : (
            <div className="slots-grid">
              {slots.map(slot => (
                <div key={slot.id}
                  className={`slot ${slot.is_booked ? 'slot-booked' : selectedSlot?.id === slot.id ? 'slot-sel' : 'slot-avail'}`}
                  onClick={() => !slot.is_booked && setSelectedSlot(slot.id === selectedSlot?.id ? null : slot)}
                  title={slot.is_booked ? 'Already booked' : `Book ${slot.slot_number}`}
                >
                  <span style={{ fontSize: 18 }}>{slot.is_booked ? '🔒' : selectedSlot?.id === slot.id ? '✓' : '🅿️'}</span>
                  <span>{slot.slot_number}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedSlot && (
        <div className="card fade-up" style={{ border: '2px solid var(--accent)', background: '#fff9fa' }}>
          <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Slot {selectedSlot.slot_number} selected</div>
              <div className="text-muted" style={{ fontSize: 13, marginTop: 2 }}>₹{parking.price_per_hour}/hr · {parking.name}</div>
            </div>
            <button className="btn btn-primary"
              onClick={() => navigate(`/booking/${selectedSlot.id}`, { state: { slot: selectedSlot, parking } })}>
              Book Now →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
