import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api';
import toast from 'react-hot-toast';
import { getParkings } from '../../services/api';

const mapStyle = { width: '100%', height: '400px' };
const defaultCenter = { lat: 13.0827, lng: 80.2707 };
const getPrimaryMedia = (parking) => parking.media?.[0] || null;

export default function Home() {
  const [parkings, setParkings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();
  const googleMapsApiKey = process.env.REACT_APP_GOOGLE_MAPS_KEY || '';
  const { isLoaded: isMapLoaded, loadError } = useJsApiLoader({
    id: 'easepark-google-map-script',
    googleMapsApiKey,
  });

  const load = useCallback(async () => {
    try {
      const res = await getParkings();
      setParkings(res.data.data.parkings);
    } catch {
      toast.error('Failed to load parkings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (loadError) toast.error('Google Maps failed to load');
  }, [loadError]);

  const filtered = parkings.filter((parking) =>
    parking.name.toLowerCase().includes(search.toLowerCase())
    || parking.address.toLowerCase().includes(search.toLowerCase())
  );

  const mappedParkings = useMemo(
    () =>
      filtered
        .map((parking) => {
          const lat = Number.parseFloat(parking.lat);
          const lng = Number.parseFloat(parking.lng);

          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

          return { ...parking, position: { lat, lng } };
        })
        .filter(Boolean),
    [filtered]
  );

  const mapCenter = mappedParkings.length ? mappedParkings[0].position : defaultCenter;
  const selectedPosition = selected
    ? { lat: Number.parseFloat(selected.lat), lng: Number.parseFloat(selected.lng) }
    : null;
  const hasValidSelectedPosition = selectedPosition
    && Number.isFinite(selectedPosition.lat)
    && Number.isFinite(selectedPosition.lng);

  return (
    <div className="page fade-up">
      <div className="page-head-row">
        <div className="page-head">
          <h1>Find Parking</h1>
          <p>Select a location to browse available slots</p>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ position: 'relative', maxWidth: 380 }}>
          <input
            className="input"
            placeholder="Search parking by name or address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 22 }}>
        {!googleMapsApiKey ? (
          <div className="empty">
            <h3>Google Maps key missing</h3>
            <p>Add `REACT_APP_GOOGLE_MAPS_KEY` in `frontend/.env` to show the map.</p>
          </div>
        ) : !isMapLoaded ? (
          <p className="text-muted">Loading map...</p>
        ) : (
          <GoogleMap mapContainerStyle={mapStyle} center={mapCenter} zoom={13}>
            {mappedParkings.map((parking) => (
              <Marker
                key={parking.id}
                position={parking.position}
                onClick={() => setSelected(parking)}
                icon={{
                  url:
                    parking.available_slots > 0
                      ? 'http://maps.google.com/mapfiles/ms/icons/green-dot.png'
                      : 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
                }}
              />
            ))}
            {selected && hasValidSelectedPosition && (
              <InfoWindow position={selectedPosition} onCloseClick={() => setSelected(null)}>
                <div style={{ padding: 4, minWidth: 160 }}>
                  <strong style={{ fontSize: 14 }}>{selected.name}</strong>
                  <p style={{ fontSize: 12, color: '#555', margin: '4px 0' }}>{selected.address}</p>
                  <p style={{ fontSize: 12 }}>
                    Available: {selected.available_slots}/{selected.total_slots} free | Rs.{selected.price_per_hour}/hr
                  </p>
                  <button
                    style={{
                      marginTop: 8,
                      background: '#ff4d6d',
                      color: '#fff',
                      border: 'none',
                      padding: '6px 14px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                    onClick={() => navigate(`/parking/${selected.id}`)}
                  >
                    View Slots
                  </button>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
        {loading ? <p className="text-muted">Loading...</p>
        : filtered.length === 0 ? (
          <div className="empty"><div className="empty-icon">P</div><h3>No parkings found</h3><p>Try a different search</p></div>
        ) : filtered.map((parking) => (
          <div key={parking.id} className="card card-hover" onClick={() => navigate(`/parking/${parking.id}`)}>
            {getPrimaryMedia(parking) && (
              <div style={{ height: 170, borderBottom: '1px solid var(--border)', background: '#eef2f7', overflow: 'hidden' }}>
                {getPrimaryMedia(parking).type === 'image' ? (
                  <img
                    src={getPrimaryMedia(parking).url}
                    alt={parking.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <video
                    src={getPrimaryMedia(parking).url}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    muted
                  />
                )}
              </div>
            )}
            <div className="card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{parking.name}</h3>
                  <p style={{ fontSize: 12.5, color: 'var(--muted)' }}>{parking.address}</p>
                </div>
                <span className={`badge ${parking.available_slots > 0 ? 'badge-success' : 'badge-danger'}`}>
                  {parking.available_slots > 0 ? `${parking.available_slots} free` : 'Full'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <span className="text-muted">{parking.total_slots} total slots</span>
                <strong style={{ fontSize: 16, color: 'var(--accent)' }}>Rs.{parking.price_per_hour}/hr</strong>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
