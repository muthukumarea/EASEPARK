import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getParkings, createParking, deleteParking } from '../../services/api';

const EMPTY = { name:'', address:'', lat:'', lng:'', price_per_hour:'' };
const MAX_MEDIA_ITEMS = 5;
const ACCEPTED_MEDIA_TYPES = ['image/', 'video/'];

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Failed to read file'));
  reader.readAsDataURL(file);
});

export default function AdminParkings() {
  const [parkings, setParkings] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { const r = await getParkings(); setParkings(r.data.data.parkings); }
    catch { toast.error('Failed to load parkings'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const set = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleMediaChange = async (e) => {
    const pickedFiles = Array.from(e.target.files || []);
    e.target.value = '';

    if (!pickedFiles.length) return;

    const nextFiles = pickedFiles.filter((file) =>
      ACCEPTED_MEDIA_TYPES.some((type) => file.type.startsWith(type))
    );

    if (!nextFiles.length) {
      toast.error('Select image or video files only');
      return;
    }

    if (mediaFiles.length + nextFiles.length > MAX_MEDIA_ITEMS) {
      toast.error(`You can upload up to ${MAX_MEDIA_ITEMS} files`);
      return;
    }

    try {
      const encodedFiles = await Promise.all(
        nextFiles.map(async (file) => ({
          name: file.name,
          type: file.type.startsWith('video/') ? 'video' : 'image',
          mime_type: file.type,
          url: await fileToDataUrl(file),
        }))
      );
      setMediaFiles((current) => [...current, ...encodedFiles]);
    } catch {
      toast.error('Failed to load selected files');
    }
  };

  const removeMedia = (index) => {
    setMediaFiles((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.name || !form.address || !form.lat || !form.lng) { toast.error('Fill all required fields'); return; }
    setSaving(true);
    try {
      await createParking({
        ...form,
        lat: parseFloat(form.lat),
        lng: parseFloat(form.lng),
        price_per_hour: parseFloat(form.price_per_hour || 0),
        media: mediaFiles.map(({ type, mime_type, url }) => ({ type, mime_type, url })),
      });
      toast.success('Parking created!');
      setForm(EMPTY); setMediaFiles([]); setShowForm(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Deactivate "${name}"?`)) return;
    try { await deleteParking(id); toast.success('Parking deactivated'); load(); }
    catch { toast.error('Failed to delete'); }
  };

  return (
    <div className="page fade-up">
      <div className="page-head-row">
        <div className="page-head" style={{ marginBottom:0 }}>
          <h1>Parking Locations</h1>
          <p>Manage all parking lots across the platform</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? '✕ Cancel' : '+ Add Parking'}
        </button>
      </div>

      {showForm && (
        <div className="card fade-up" style={{ marginTop:20, marginBottom:20 }}>
          <div className="card-head"><h3>New Parking Location</h3></div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <div className="field">
                  <label className="field-label">Name *</label>
                  <div className="field-wrap"><span className="field-icon">🏢</span><input className="input" name="name" value={form.name} onChange={set} placeholder="Central Park Parking" /></div>
                </div>
                <div className="field">
                  <label className="field-label">Price/hr (₹) *</label>
                  <div className="field-wrap"><span className="field-icon">💰</span><input className="input" name="price_per_hour" type="number" min="0" step="0.5" value={form.price_per_hour} onChange={set} placeholder="50" /></div>
                </div>
              </div>
              <div className="field">
                <label className="field-label">Address *</label>
                <div className="field-wrap"><span className="field-icon">📍</span><input className="input" name="address" value={form.address} onChange={set} placeholder="Full address" /></div>
              </div>
              <div className="input-group">
                <div className="field">
                  <label className="field-label">Latitude *</label>
                  <div className="field-wrap"><span className="field-icon">🌐</span><input className="input" name="lat" type="number" step="any" value={form.lat} onChange={set} placeholder="13.0827" /></div>
                </div>
                <div className="field">
                  <label className="field-label">Longitude *</label>
                  <div className="field-wrap"><span className="field-icon">🌐</span><input className="input" name="lng" type="number" step="any" value={form.lng} onChange={set} placeholder="80.2707" /></div>
                </div>
              </div>
              <div className="field">
                <label className="field-label">Photos / Videos</label>
                <div className="field-wrap" style={{ padding:'10px 12px' }}>
                  <input
                    className="input"
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={handleMediaChange}
                    style={{ border:'none', padding:0, background:'transparent' }}
                  />
                </div>
                <p className="text-muted" style={{ fontSize:12, marginTop:8 }}>
                  Upload up to {MAX_MEDIA_ITEMS} images or videos to help users preview this parking.
                </p>
              </div>
              {mediaFiles.length > 0 && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:12, marginBottom:18 }}>
                  {mediaFiles.map((item, index) => (
                    <div key={`${item.name}-${index}`} className="card" style={{ overflow:'hidden' }}>
                      <div style={{ aspectRatio:'4 / 3', background:'#f5f7fb' }}>
                        {item.type === 'image' ? (
                          <img src={item.url} alt={item.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        ) : (
                          <video src={item.url} style={{ width:'100%', height:'100%', objectFit:'cover' }} muted />
                        )}
                      </div>
                      <div className="card-body" style={{ padding:10 }}>
                        <div style={{ fontSize:12, fontWeight:600, marginBottom:8, wordBreak:'break-word' }}>{item.name}</div>
                        <button type="button" className="btn btn-danger-soft btn-sm" onClick={() => removeMedia(index)}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button type="submit" className={`btn btn-primary${saving?' btn-load':''}`} disabled={saving}>
                {saving?'':'Create Parking'}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: showForm ? 0 : 20 }}>
        <div className="tbl-wrap">
          {loading ? <p style={{ padding:24 }} className="text-muted">Loading...</p> : (
            <table>
              <thead><tr><th>Name</th><th>Address</th><th>Slots</th><th>Available</th><th>Rate</th><th>Action</th></tr></thead>
              <tbody>
                {parkings.length === 0
                  ? <tr><td colSpan={6} style={{ textAlign:'center', color:'var(--muted)', padding:32 }}>No parkings yet</td></tr>
                  : parkings.map(p => (
                    <tr key={p.id}>
                      <td>
                        <strong style={{ fontSize:13, display:'block' }}>{p.name}</strong>
                        <span className="text-muted" style={{ fontSize:12 }}>{p.media?.length || 0} media</span>
                      </td>
                      <td className="text-muted" style={{ maxWidth:200, fontSize:12 }}>{p.address}</td>
                      <td>{p.total_slots}</td>
                      <td><span className={`badge ${p.available_slots>0?'badge-success':'badge-danger'}`}>{p.available_slots}</span></td>
                      <td><strong>₹{p.price_per_hour}/hr</strong></td>
                      <td><button className="btn btn-danger-soft btn-sm" onClick={() => handleDelete(p.id, p.name)}>Delete</button></td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
