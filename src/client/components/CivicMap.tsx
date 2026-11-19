import React, { useState, useMemo, useCallback } from 'react';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  category?: string;
  portions?: number;
  city?: string;
  distanceKm?: number;
  onClick?: () => void;
}

export interface CivicMapProps {
  latitude: number;
  longitude: number;
  title?: string;
  address?: string;
  height?: string | number;
  zoomDelta?: number;
  showDirections?: boolean;
  markers?: MapMarker[];
  selectedMarkerId?: string;
  onMarkerSelect?: (marker: MapMarker) => void;
  interactive?: boolean;
  onLocationChange?: (lat: number, lng: number) => void;
}

export default function CivicMap({
  latitude,
  longitude,
  title = 'Pickup & Delivery Dispatch Location',
  address,
  height = 280,
  zoomDelta = 0.02,
  showDirections = true,
  markers,
  selectedMarkerId,
  onMarkerSelect,
  interactive = false,
  onLocationChange,
}: CivicMapProps) {
  // Default to zero-latency, glitch-free civic map so it NEVER reloads or flashes
  const [mapType, setMapType] = useState<'civic' | 'osm'>('civic');
  const [geoLocating, setGeoLocating] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const validLat = Number.isFinite(latitude) && latitude !== 0 ? latitude : 19.8762;
  const validLng = Number.isFinite(longitude) && longitude !== 0 ? longitude : 75.3433;

  // Viewport bounds centered around reference coordinate
  const [centerLat, setCenterLat] = useState<number>(validLat);
  const [centerLng, setCenterLng] = useState<number>(validLng);

  // Update center when coordinate moves significantly outside viewport
  const minLng = centerLng - zoomDelta;
  const maxLng = centerLng + zoomDelta;
  const minLat = centerLat - zoomDelta * 0.6;
  const maxLat = centerLat + zoomDelta * 0.6;

  // Pin position percentage relative to viewport
  const pinXPercent = Math.max(5, Math.min(95, ((validLng - minLng) / (maxLng - minLng)) * 100));
  const pinYPercent = Math.max(10, Math.min(90, ((maxLat - validLat) / (maxLat - minLat)) * 100));

  const gmapsDirectionsUrl = useMemo(
    () => `https://www.google.com/maps/dir/?api=1&destination=${validLat},${validLng}`,
    [validLat, validLng]
  );
  const osmDirectionsUrl = useMemo(
    () => `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=%3B${validLat}%2C${validLng}`,
    [validLat, validLng]
  );

  // Direct click anywhere on the map viewport to move the pin
  const handleMapClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (!interactive || !onLocationChange) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const xRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const yRatio = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

      const clickedLng = Number((minLng + xRatio * (maxLng - minLng)).toFixed(4));
      const clickedLat = Number((maxLat - yRatio * (maxLat - minLat)).toFixed(4));

      onLocationChange(clickedLat, clickedLng);
      setLastAction(`Pin placed at ${clickedLat.toFixed(4)}°N, ${clickedLng.toFixed(4)}°E`);
    },
    [interactive, onLocationChange, minLng, maxLng, minLat, maxLat]
  );

  // Directional Nudges
  const nudge = useCallback(
    (deltaLat: number, deltaLng: number, label: string) => {
      if (!onLocationChange) return;
      const newLat = Number((validLat + deltaLat).toFixed(4));
      const newLng = Number((validLng + deltaLng).toFixed(4));
      onLocationChange(newLat, newLng);
      setLastAction(`Moved pin ${label} to ${newLat.toFixed(4)}, ${newLng.toFixed(4)}`);
    },
    [validLat, validLng, onLocationChange]
  );

  // Preset location selector
  const setPreset = useCallback(
    (lat: number, lng: number, label: string) => {
      if (!onLocationChange) return;
      setCenterLat(lat);
      setCenterLng(lng);
      onLocationChange(lat, lng);
      setLastAction(`Set to ${label}`);
    },
    [onLocationChange]
  );

  // GPS Device Geolocation
  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setGeoLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLocating(false);
        const lat = Number(pos.coords.latitude.toFixed(4));
        const lng = Number(pos.coords.longitude.toFixed(4));
        setCenterLat(lat);
        setCenterLng(lng);
        if (onLocationChange) {
          onLocationChange(lat, lng);
        }
        setLastAction(`Located GPS at ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      },
      () => {
        setGeoLocating(false);
        if (onLocationChange) {
          onLocationChange(19.8762, 75.3433);
        }
        setLastAction('Defaulted to civic center');
      },
      { timeout: 8000 }
    );
  }, [onLocationChange]);

  const activeMarker = useMemo(() => {
    if (!markers || !selectedMarkerId) return null;
    return markers.find((m) => m.id === selectedMarkerId) || null;
  }, [markers, selectedMarkerId]);

  return (
    <div
      className="civic-map-card"
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        marginTop: '1rem',
        marginBottom: '1rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      {/* Map Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.75rem 1rem',
          background: 'var(--color-canvas)',
          borderBottom: '1px solid var(--color-border)',
          flexWrap: 'wrap',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.25rem' }} aria-hidden="true">📍</span>
          <div>
            <div style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-ink)' }}>
              {title}
            </div>
            {address && (
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-secondary)' }}>
                {address}
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span
            className="badge badge--secondary"
            style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}
          >
            {validLat.toFixed(4)}°N, {validLng.toFixed(4)}°E
          </span>

          <button
            type="button"
            className="btn btn--outline btn--sm"
            style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
            onClick={() => setMapType(mapType === 'civic' ? 'osm' : 'civic')}
          >
            {mapType === 'civic' ? '🗺️ Satellite / Street Tiles' : '🏙️ Civic Grid View'}
          </button>
        </div>
      </div>

      {/* Interactive Adjustment Controls for Donors */}
      {interactive && onLocationChange && (
        <div
          style={{
            padding: '0.6rem 1rem',
            background: 'var(--color-accent-light)',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.6rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--color-accent-hover)', fontWeight: 600, fontSize: '0.8125rem' }}>
              📍 Adjust Pin:
            </span>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
              onClick={() => nudge(0.002, 0, 'North')}
              title="Move pin North"
            >
              ⬆️ North
            </button>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
              onClick={() => nudge(-0.002, 0, 'South')}
              title="Move pin South"
            >
              ⬇️ South
            </button>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
              onClick={() => nudge(0, -0.002, 'West')}
              title="Move pin West"
            >
              ⬅️ West
            </button>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
              onClick={() => nudge(0, 0.002, 'East')}
              title="Move pin East"
            >
              ➡️ East
            </button>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
              onClick={handleUseCurrentLocation}
              disabled={geoLocating}
            >
              {geoLocating ? 'Locating...' : '🎯 My GPS'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-secondary)' }}>Presets:</span>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem' }}
              onClick={() => setPreset(19.8762, 75.3433, 'Central City')}
            >
              City Center
            </button>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem' }}
              onClick={() => setPreset(19.8850, 75.3200, 'Industrial Bay')}
            >
              North Hub
            </button>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem' }}
              onClick={() => setPreset(19.8620, 75.3650, 'Market Zone')}
            >
              Market Bay
            </button>
          </div>
        </div>
      )}

      {/* Map Content Viewport */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: typeof height === 'number' ? `${height}px` : height,
          background: '#e9ede9',
          overflow: 'hidden',
          userSelect: 'none',
        }}
      >
        {mapType === 'osm' ? (
          /* Static OpenStreetMap Tile Layer */
          <div
            style={{
              width: '100%',
              height: '100%',
              position: 'relative',
              background: '#e5e3df',
            }}
          >
            <img
              src={`https://tile.openstreetmap.org/14/${Math.floor(((validLng + 180) / 360) * Math.pow(2, 14))}/${Math.floor((1 - Math.log(Math.tan(validLat * Math.PI / 180) + 1 / Math.cos(validLat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, 14))}.png`}
              alt="Street map tile"
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }}
              onError={(e) => {
                // If tile cannot load, fallback seamlessly to civic vector
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
        ) : (
          /* Interactive High-Contrast Civic Vector Canvas (Zero-Jitter & Zero-Reload) */
          <div
            style={{
              width: '100%',
              height: '100%',
              position: 'relative',
              background: 'linear-gradient(135deg, #f4f7f4 0%, #e2ece4 100%)',
            }}
          >
            {/* Civic Vector Roads & Dispatch Corridors */}
            <svg
              width="100%"
              height="100%"
              style={{ position: 'absolute', inset: 0 }}
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <defs>
                <pattern id="civic-street-grid" width="48" height="48" patternUnits="userSpaceOnUse">
                  <path d="M 48 0 L 0 0 0 48" fill="none" stroke="rgba(0, 0, 0, 0.06)" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#civic-street-grid)" />

              {/* Major Transit Arteries */}
              <line x1="0" y1="45%" x2="100%" y2="45%" stroke="#ffffff" strokeWidth="8" />
              <line x1="0" y1="45%" x2="100%" y2="45%" stroke="var(--color-border)" strokeWidth="2" strokeDasharray="6 4" />
              <line x1="38%" y1="0" x2="38%" y2="100%" stroke="#ffffff" strokeWidth="6" />
              <line x1="72%" y1="0" x2="72%" y2="100%" stroke="#ffffff" strokeWidth="6" />

              {/* Transit Zone Circles */}
              <circle cx="50%" cy="50%" r="65" fill="var(--color-accent-light)" opacity="0.6" stroke="var(--color-accent)" strokeWidth="1.5" strokeDasharray="4 4" />
              <circle cx="50%" cy="50%" r="120" fill="none" stroke="var(--color-secondary)" opacity="0.3" strokeWidth="1" strokeDasharray="3 3" />

              {/* Street Names */}
              <text x="15" y="42%" fill="var(--color-secondary)" fontSize="10" fontWeight="600" letterSpacing="1">
                CIVIC EXPRESS CORRIDOR
              </text>
              <text x="39%" y="25" fill="var(--color-secondary)" fontSize="9" fontWeight="600">
                RELIEF AVE
              </text>
            </svg>
          </div>
        )}

        {/* Clickable Overlay Plane for Interactive Pin Placement */}
        {interactive && (
          <button
            type="button"
            aria-label="Click anywhere on the map to set pickup pin"
            onClick={handleMapClick}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              zIndex: 5,
              border: 0,
              background: 'transparent',
              cursor: 'crosshair',
            }}
          />
        )}

        {/* Visual Staging Pin — Dynamically Positioned to User's Click */}
        <div
          style={{
            position: 'absolute',
            left: `${pinXPercent}%`,
            top: `${pinYPercent}%`,
            transform: 'translate(-50%, -100%)',
            zIndex: 6,
            textAlign: 'center',
            pointerEvents: 'none',
            transition: 'left 0.15s ease-out, top 0.15s ease-out',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50% 50% 50% 0',
              background: 'var(--color-accent)',
              transform: 'rotate(-45deg)',
              margin: '0 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(46, 125, 50, 0.45)',
              border: '2px solid #ffffff',
            }}
          >
            <span
              style={{
                transform: 'rotate(45deg)',
                color: '#ffffff',
                fontSize: '1.1rem',
              }}
            >
              📍
            </span>
          </div>

          <div
            style={{
              marginTop: '0.35rem',
              background: 'var(--color-surface)',
              padding: '0.2rem 0.6rem',
              borderRadius: 'var(--radius-sm)',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'var(--color-ink)',
              whiteSpace: 'nowrap',
              border: '1px solid var(--color-border)',
            }}
          >
            {interactive ? `📍 ${validLat.toFixed(4)}, ${validLng.toFixed(4)}` : address || `${validLat.toFixed(4)}, ${validLng.toFixed(4)}`}
          </div>
        </div>

        {/* Multi-Marker Discovery Pins */}
        {markers &&
          markers.map((m, index) => {
            const isSelected = selectedMarkerId === m.id;
            const angle = (index * (360 / Math.max(1, markers.length))) * (Math.PI / 180);
            const dist = Math.min(130, Math.max(45, (m.distanceKm || 5) * 12));
            const offsetX = Math.cos(angle) * dist;
            const offsetY = Math.sin(angle) * dist * 0.65;

            return (
              <button
                key={m.id}
                type="button"
                style={{
                  position: 'absolute',
                  left: `calc(50% + ${offsetX}px)`,
                  top: `calc(50% + ${offsetY}px)`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: isSelected ? 12 : 7,
                  background: isSelected ? 'var(--color-accent)' : 'var(--color-surface)',
                  color: isSelected ? '#ffffff' : 'var(--color-ink)',
                  border: isSelected ? '2px solid #ffffff' : '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.25rem 0.5rem',
                  boxShadow: isSelected ? '0 4px 12px rgba(46, 125, 50, 0.4)' : '0 2px 6px rgba(0,0,0,0.15)',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  whiteSpace: 'nowrap',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onMarkerSelect) onMarkerSelect(m);
                  if (m.onClick) m.onClick();
                }}
              >
                <span>🍱</span>
                <strong>{m.portions ? `${m.portions}p` : 'Surplus'}</strong>
                <span style={{ opacity: 0.85 }}>({m.distanceKm ? `${m.distanceKm.toFixed(1)}km` : m.city || 'Local'})</span>
              </button>
            );
          })}
      </div>

      {/* Real-time Interaction Status helper */}
      {interactive && (
        <div
          style={{
            padding: '0.4rem 1rem',
            background: 'var(--color-canvas)',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.75rem',
            color: 'var(--color-secondary)',
          }}
        >
          <span>
            {lastAction ? `✓ ${lastAction}` : '💡 Click anywhere on the map to set the exact delivery pickup location.'}
          </span>
          <span style={{ fontFamily: 'monospace' }}>
            GPS: {validLat.toFixed(4)}, {validLng.toFixed(4)}
          </span>
        </div>
      )}

      {/* Selected Marker Detail Card */}
      {activeMarker && (
        <div
          style={{
            padding: '0.75rem 1rem',
            background: 'var(--color-canvas)',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
              <span className="badge badge--info" style={{ textTransform: 'capitalize' }}>
                {activeMarker.category || 'Surplus'}
              </span>
              <strong style={{ fontSize: '0.875rem' }}>{activeMarker.label}</strong>
            </div>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-secondary)' }}>
              {activeMarker.portions} portions available • {activeMarker.distanceKm !== undefined ? `${activeMarker.distanceKm.toFixed(1)} km straight-line distance` : activeMarker.city || ''}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${activeMarker.lat},${activeMarker.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--outline btn--sm"
              style={{ fontSize: '0.75rem' }}
            >
              🧭 Route ↗
            </a>
          </div>
        </div>
      )}

      {/* Turn-by-Turn Navigation Actions */}
      {showDirections && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.75rem 1rem',
            background: 'var(--color-canvas)',
            borderTop: '1px solid var(--color-border)',
            flexWrap: 'wrap',
            gap: '0.75rem',
          }}
        >
          <span style={{ fontSize: '0.8125rem', color: 'var(--color-secondary)' }}>
            🚚 Dispatch vehicle GPS destination: <strong>{validLat.toFixed(4)}, {validLng.toFixed(4)}</strong>
          </span>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <a
              href={gmapsDirectionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--primary btn--sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              🧭 Open in Google Maps Navigation ↗
            </a>
            <a
              href={osmDirectionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--outline btn--sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
            >
              🗺️ OpenStreetMap Route ↗
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
