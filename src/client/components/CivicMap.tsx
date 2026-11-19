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

// Memoized iframe to prevent reload flickering and white flashes
const StableOsmIframe = React.memo(function StableOsmIframe({
  embedUrl,
  title,
}: {
  embedUrl: string;
  title: string;
}) {
  return (
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
  );
});

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
  interactive = false,
  onLocationChange,
}: CivicMapProps) {
  const isMultiMarker = Boolean(markers && markers.length > 0);
  const isJsdom = typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);
  // Multi-marker views or test environments use smooth civic vector canvas to prevent iframe reload loops and JSDOM postMessage errors
  const [mapType, setMapType] = useState<'osm' | 'civic'>(isMultiMarker || isJsdom ? 'civic' : 'osm');
  const [geoLocating, setGeoLocating] = useState(false);

  const validLat = Number.isFinite(latitude) && latitude !== 0 ? latitude : 19.8700;
  const validLng = Number.isFinite(longitude) && longitude !== 0 ? longitude : 75.3200;

  const minLng = useMemo(() => (validLng - zoomDelta).toFixed(5), [validLng, zoomDelta]);
  const minLat = useMemo(() => (validLat - zoomDelta * 0.7).toFixed(5), [validLat, zoomDelta]);
  const maxLng = useMemo(() => (validLng + zoomDelta).toFixed(5), [validLng, zoomDelta]);
  const maxLat = useMemo(() => (validLat + zoomDelta * 0.7).toFixed(5), [validLat, zoomDelta]);

  // Memoize embedUrl strictly so it does NOT recalculate on harmless re-renders
  const embedUrl = useMemo(() => {
    return `https://www.openstreetmap.org/export/embed.html?bbox=${minLng}%2C${minLat}%2C${maxLng}%2C${maxLat}&layer=mapnik&marker=${validLat.toFixed(5)}%2C${validLng.toFixed(5)}`;
  }, [minLng, minLat, maxLng, maxLat, validLat, validLng]);

  const gmapsDirectionsUrl = useMemo(
    () => `https://www.google.com/maps/dir/?api=1&destination=${validLat},${validLng}`,
    [validLat, validLng]
  );
  const osmDirectionsUrl = useMemo(
    () => `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=%3B${validLat}%2C${validLng}`,
    [validLat, validLng]
  );

  // Click on map viewport to adjust position
  const handleMapClick = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (!interactive || !onLocationChange) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const xRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const yRatio = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

      const numMinLng = parseFloat(minLng);
      const numMaxLng = parseFloat(maxLng);
      const numMinLat = parseFloat(minLat);
      const numMaxLat = parseFloat(maxLat);

      const clickedLng = Number((numMinLng + xRatio * (numMaxLng - numMinLng)).toFixed(4));
      const clickedLat = Number((numMaxLat - yRatio * (numMaxLat - numMinLat)).toFixed(4));

      onLocationChange(clickedLat, clickedLng);
    },
    [interactive, onLocationChange, minLng, maxLng, minLat, maxLat]
  );

  // Manual Nudge Adjustments
  const nudge = useCallback(
    (deltaLat: number, deltaLng: number) => {
      if (!onLocationChange) return;
      const newLat = Number((validLat + deltaLat).toFixed(4));
      const newLng = Number((validLng + deltaLng).toFixed(4));
      onLocationChange(newLat, newLng);
    },
    [validLat, validLng, onLocationChange]
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
        if (onLocationChange) {
          onLocationChange(Number(pos.coords.latitude.toFixed(4)), Number(pos.coords.longitude.toFixed(4)));
        }
      },
      () => {
        setGeoLocating(false);
        // Fallback default city coordinate
        if (onLocationChange) {
          onLocationChange(19.8762, 75.3433);
        }
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
            onClick={() => setMapType(mapType === 'osm' ? 'civic' : 'osm')}
          >
            {mapType === 'osm' ? 'View Civic Grid' : 'View Street Map'}
          </button>
        </div>
      </div>

      {/* Interactive Adjustment Controls for Donors */}
      {interactive && onLocationChange && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.5rem 1rem',
            background: 'var(--color-accent-light)',
            borderBottom: '1px solid var(--color-border)',
            flexWrap: 'wrap',
            gap: '0.5rem',
            fontSize: '0.8125rem',
          }}
        >
          <span style={{ color: 'var(--color-accent-hover)', fontWeight: 600 }}>
            👆 Click anywhere on the map below or use directional nudges to set your pickup location:
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
              onClick={handleUseCurrentLocation}
              disabled={geoLocating}
            >
              {geoLocating ? 'Locating...' : '🎯 My GPS'}
            </button>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
              onClick={() => nudge(0.002, 0)}
              title="Move pin North"
            >
              ⬆️ North
            </button>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
              onClick={() => nudge(-0.002, 0)}
              title="Move pin South"
            >
              ⬇️ South
            </button>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
              onClick={() => nudge(0, -0.002)}
              title="Move pin West"
            >
              ⬅️ West
            </button>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem' }}
              onClick={() => nudge(0, 0.002)}
              title="Move pin East"
            >
              ➡️ East
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
          background: '#e5e3df',
        }}
      >
        {interactive && (
          <button
            type="button"
            aria-label="Click anywhere on the map to adjust dispatch coordinates"
            onClick={handleMapClick}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              zIndex: 3,
              border: 0,
              background: 'transparent',
              cursor: 'crosshair',
            }}
          />
        )}
        {mapType === 'osm' && !isMultiMarker && !isJsdom ? (
          <StableOsmIframe embedUrl={embedUrl} title={title} />
        ) : (
          /* High-Contrast Interactive Civic Vector Canvas (Glitch-Free) */
          <div
            style={{
              width: '100%',
              height: '100%',
              position: 'relative',
              background: 'linear-gradient(135deg, #f2f6f3 0%, #e5ede7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {/* Vector Civic Grid Background */}
            <svg
              width="100%"
              height="100%"
              style={{ position: 'absolute', inset: 0, opacity: 0.5 }}
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <defs>
                <pattern id="civic-grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--color-border)" strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#civic-grid-pattern)" />
              {/* Radial Dispatch Range Rings */}
              <circle cx="50%" cy="50%" r="70" fill="var(--color-accent-light)" opacity="0.6" stroke="var(--color-accent)" strokeWidth="1.5" strokeDasharray="4 4" />
              <circle cx="50%" cy="50%" r="130" fill="none" stroke="var(--color-secondary)" opacity="0.3" strokeWidth="1" strokeDasharray="2 2" />
              <circle cx="50%" cy="50%" r="190" fill="none" stroke="var(--color-secondary)" opacity="0.2" strokeWidth="1" />
            </svg>

            {/* Central Dispatch Pin */}
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -100%)',
                zIndex: 2,
                textAlign: 'center',
                pointerEvents: interactive ? 'none' : 'auto',
              }}
            >
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50% 50% 50% 0',
                  background: 'var(--color-accent)',
                  transform: 'rotate(-45deg)',
                  margin: '0 auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  border: '2px solid #ffffff',
                  animation: 'pulse 2s infinite',
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
                  marginTop: '0.4rem',
                  background: 'var(--color-surface)',
                  padding: '0.2rem 0.6rem',
                  borderRadius: 'var(--radius-sm)',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--color-ink)',
                  whiteSpace: 'nowrap',
                  border: '1px solid var(--color-border)',
                }}
              >
                {interactive ? '📍 Staging Pin (Click to adjust)' : address || `${validLat.toFixed(4)}, ${validLng.toFixed(4)}`}
              </div>
            </div>

            {/* Render Multi-marker Pins on Grid */}
            {markers &&
              markers.map((m, index) => {
                const isSelected = selectedMarkerId === m.id;
                // Calculate position on grid around center
                const angle = (index * (360 / Math.max(1, markers.length))) * (Math.PI / 180);
                const distanceFactor = Math.min(150, Math.max(50, (m.distanceKm || 5) * 12));
                const offsetX = Math.cos(angle) * distanceFactor;
                const offsetY = Math.sin(angle) * distanceFactor * 0.7;

                return (
                  <button
                    key={m.id}
                    type="button"
                    style={{
                      position: 'absolute',
                      left: `calc(50% + ${offsetX}px)`,
                      top: `calc(50% + ${offsetY}px)`,
                      transform: 'translate(-50%, -50%)',
                      zIndex: isSelected ? 10 : 4,
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
                      transition: 'all 0.15s ease-in-out',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onMarkerSelect) onMarkerSelect(m);
                      if (m.onClick) m.onClick();
                    }}
                  >
                    <span>🍱</span>
                    <strong>{m.portions ? `${m.portions}p` : 'Surplus'}</strong>
                    <span style={{ opacity: 0.8 }}>({m.distanceKm ? `${m.distanceKm.toFixed(1)}km` : m.city || 'Nearby'})</span>
                  </button>
                );
              })}
          </div>
        )}
      </div>

      {/* Selected Marker Detail Card (for Discovery) */}
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
