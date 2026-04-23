import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getParkings, getSlots, createSlot, deleteSlot } from '../../services/api';

export default function AdminSlots() {
  const [parkings, setParkings] = useState([]);
  const [slots, setSlots] = useState([]);
  const [selectedParking, setSelectedParking] = useState('');
  const [slotNumber, setSlotNumber] = useState('');
  const [bulkCount, setBulkCount] = useState(5);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { getParkings().then(r => setParkings(r.data.data.parkings)).catch(() => {}); }, []);

  const loadSlots = useCallback(async () => {
    if (!selectedParking) return;
    setLoading(true);
    try { const r = await getSlots({ parking_id: selectedParking }); setSlots(r.data.data.slots); }
    catch { toast.error('Failed to load slots'); }
    finally { setLoading(false); }
  }, [selectedParking]);

  useEffect(() => { loadSlots(); }, [loadSlots]);

  const handleAdd = async e => {
    e.preventDefault();
    if (!selectedParking || !slotNumber) { toast.error('Select parking and enter slot number'); return; }
    setSaving(true);
    try {
      await createSlot({ parking_id: parseInt(selectedParking), slot_number: slotNumber.trim() });
      toast.success(`Slot ${slotNumber} added`);
      setSlotNumber(''); loadSlots();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to add slot'); }
    finally { setSaving(false); }
  };

  const handleBulk = async () => {
    if (!selectedParking) { toast.error('Select a parking first'); return; }
    const existing = slots.length;
    setSaving(true);
    let added = 0;
    for (let i = 1; i <= bulkCount; i++) {
      try { await createSlot({ parking_id: parseInt(selectedParking), slot_number: `S${String(existing+i).padStart(3,'0')}` }); added++; }
      catch {}
    }
    toast.success(`${added} slot(s) added`);
    setSaving(false); loadSlots();
  };

  const handleDelete = async (id, num) => {
    if (!window.confirm(`Delete slot ${num}?`)) return;
    try { await deleteSlot(id); toast.success('Slot deleted'); loadSlots(); }
    catch (err) { toast.error(err.response?.data?.message || 'Cannot delete'); }
  };

  const avail = slots.filter(s => !s.is_booked).length;

  return (
    <div className="page fade-up">
      <div className="page-head">
        <h1>Slot Management</h1>
        <p>Add and manage slots for each parking location</p>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-head"><h3>Configure Slots</h3></div>
        <div className="card-body">
          <div className="field">
            <label className="field-label">Select Parking *</label>
            <div className="field-wrap">
              <span className="field-icon">🏢</span>
              <select className="input" value={selectedParking} onChange={e => setSelectedParking(e.target.value)}>
                <option value="">— Choose a parking —</option>
                {parkings.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          {selectedParking && (
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, flex: 1, minWidth: 220 }}>
                <div className="field-wrap" style={{ flex: 1, marginBottom: 0 }}>
                  <span className="field-icon">🅿️</span>
                  <input className="input" placeholder="Slot number e.g. A01" value={slotNumber} onChange={e => setSlotNumber(e.target.value)} />
                </div>
                <button type="submit" className={`btn btn-primary${saving?' btn-load':''}`} disabled={saving}>
                  {saving?'':'+ Add'}
                </button>
              </form>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span className="text-muted" style={{ fontSize:13, whiteSpace:'nowrap' }}>Bulk add</span>
                <input type="number" className="input input-no-icon" min={1} max={50} value={bulkCount} onChange={e => setBulkCount(parseInt(e.target.value)||1)} style={{ width:64 }} />
                <button className="btn btn-ghost btn-sm" onClick={handleBulk} disabled={saving}>Auto-generate</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedParking && (
        <div className="card">
          <div className="card-head">
            <h3>Slots Overview</h3>
            <div style={{ display:'flex', gap:8 }}>
              <span className="badge badge-success">🟢 {avail} free</span>
              <span className="badge badge-danger">🔴 {slots.length - avail} booked</span>
            </div>
          </div>
          <div className="card-body">
            {loading ? <p className="text-muted">Loading...</p>
            : slots.length === 0 ? (
              <div className="empty"><div className="empty-icon">🅿️</div><h3>No slots yet</h3><p>Add slots above</p></div>
            ) : (
              <div className="slots-grid">
                {slots.map(slot => (
                  <div key={slot.id} style={{ position:'relative' }}>
                    <div className={`slot ${slot.is_booked?'slot-booked':'slot-avail'}`} style={{ cursor:'default' }}>
                      <span style={{ fontSize:16 }}>{slot.is_booked?'🔒':'🅿️'}</span>
                      <span style={{ fontSize:12 }}>{slot.slot_number}</span>
                    </div>
                    {!slot.is_booked && (
                      <button onClick={() => handleDelete(slot.id, slot.slot_number)}
                        style={{ position:'absolute', top:3, right:3, width:18, height:18, background:'var(--danger)', border:'none', color:'#fff', borderRadius:4, fontSize:9, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>✕</button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
