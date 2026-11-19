import React, { useState } from 'react';

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
}

export default function CivicMap({
  latitude,
  longitude,
  title = 'Pickup & Delivery Dispatch Location',
  address,
  height = 280,
  zoomDelta = 0.015,
  showDirections = true,
  markers,
  selectedMarkerId,
  onMarkerSelect,
}: CivicMapProps) {
  const [mapType, setMapType] = useState<'osm' | 'civic'>('osm');

  const validLat = Number.isFinite(latitude) && latitude !== 0 ? latitude : 19.8700;
  const validLng = Number.isFinite(longitude) && longitude !== 0 ? longitude : 75.3200;

  const minLng = (validLng - zoomDelta).toFixed(5);
  const minLat = (validLat - zoomDelta * 0.7).toFixed(5);
  const maxLng = (validLng + zoomDelta).toFixed(5);
  const maxLat = (validLat + zoomDelta * 0.7).toFixed(5);

  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${minLng}%2C${minLat}%2C${maxLng}%2C${maxLat}&layer=mapnik&marker=${validLat}%2C${validLng}`;
  const gmapsDirectionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${validLat},${validLng}`;
  const osmDirectionsUrl = `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=%3B${validLat}%2C${validLng}`;

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
          <span style={{ fontSize: '1.25rem' }}>📍</span>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-ink)' }}>
              {title}
            </h4>
            {address && (
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-secondary)' }}>
                {address}
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span
            className="badge badge--secondary"
            style={{ fontSize: '0.75rem', fontFamily: 'monospace' }}
          >
            {validLat.toFixed(4)}°N, {validLng.toFixed(4)}°E
          </span>
          <button
            type="button"
            className="btn btn--outline btn--sm"
            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
            onClick={() => setMapType(mapType === 'osm' ? 'civic' : 'osm')}
          >
            {mapType === 'osm' ? 'View Grid View' : 'View Street Map'}
          </button>
        </div>
      </div>

      {/* Map Content Viewport */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: typeof height === 'number' ? `${height}px` : height,
          background: '#e5e3df',
        }}
      >
        {mapType === 'osm' ? (
          <iframe
            title={title}
            src={embedUrl}
            style={{
              width: '100%',
              height: '100%',
              border: 0,
              display: 'block',
            }}
            loading="lazy"
          />
        ) : (
          /* High-Contrast Civic SVG Grid Fallback */
          <div
            style={{
              width: '100%',
              height: '100%',
              position: 'relative',
              background: 'linear-gradient(135deg, #f0f4f1 0%, #e8eee9 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <svg
              width="100%"
              height="100%"
              style={{ position: 'absolute', inset: 0, opacity: 0.4 }}
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <defs>
                <pattern id="civic-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--color-border)" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#civic-grid)" />
              {/* Radial dispatch range boundary */}
              <circle cx="50%" cy="50%" r="80" fill="var(--color-accent-light)" opacity="0.6" stroke="var(--color-accent)" strokeWidth="1.5" strokeDasharray="4 4" />
              <circle cx="50%" cy="50%" r="140" fill="none" stroke="var(--color-secondary)" opacity="0.3" strokeWidth="1" />
            </svg>

            {/* Central Marker */}
            <div
              style={{
                position: 'relative',
                zIndex: 2,
                textAlign: 'center',
                transform: 'translateY(-10px)',
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
                  boxShadow: '0 4px 10px rgba(0,0,0,0.25)',
                  border: '2px solid #ffffff',
                }}
              >
                <span
                  style={{
                    transform: 'rotate(45deg)',
                    color: '#ffffff',
                    fontSize: '1rem',
                  }}
                >
                  📍
                </span>
              </div>
              <div
                style={{
                  marginTop: '0.5rem',
                  background: 'var(--color-surface)',
                  padding: '0.25rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--color-ink)',
                  whiteSpace: 'nowrap',
                }}
              >
                {address || `${validLat.toFixed(4)}, ${validLng.toFixed(4)}`}
              </div>
            </div>
          </div>
        )}

        {/* Multi-Marker List Overlay (if provided) */}
        {markers && markers.length > 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: '10px',
              left: '10px',
              right: '10px',
              zIndex: 3,
              display: 'flex',
              gap: '0.5rem',
              overflowX: 'auto',
              padding: '0.5rem',
              background: 'rgba(255, 255, 255, 0.92)',
              backdropFilter: 'blur(4px)',
              borderRadius: 'var(--radius-sm)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            }}
          >
            {markers.map((m) => {
              const isSelected = selectedMarkerId === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    border: isSelected ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                    background: isSelected ? 'var(--color-accent-light)' : 'var(--color-surface)',
                    cursor: 'pointer',
                    fontSize: '0.8125rem',
                    textAlign: 'left',
                    flexShrink: 0,
                  }}
                  onClick={() => {
                    if (onMarkerSelect) onMarkerSelect(m);
                    if (m.onClick) m.onClick();
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{m.label}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-secondary)' }}>
                    {m.portions ? `${m.portions} portions • ` : ''}
                    {m.distanceKm !== undefined ? `${m.distanceKm.toFixed(1)} km` : m.city || ''}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

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
