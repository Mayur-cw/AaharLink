import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';

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

const isBrowser =
  typeof window !== 'undefined' &&
  typeof document !== 'undefined' &&
  !(typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent));

function createPickerPinIcon(label?: string) {
  const safeText = (label || 'Pickup Location').replace(/[<>&]/g, '');
  const svg = `
    <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);pointer-events:none;">
      <div style="background:#22744F;color:#ffffff;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:1px solid #ffffff;margin-bottom:2px;">
        📍 ${safeText}
      </div>
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.35));">
        <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" fill="#22744F" stroke="#18563B" stroke-width="1.5"/>
        <circle cx="12" cy="9" r="3.5" fill="#FFFFFF" />
      </svg>
    </div>
  `;
  return L.divIcon({
    html: svg,
    className: 'civic-picker-pin',
    iconSize: [34, 44],
    iconAnchor: [17, 44],
    popupAnchor: [0, -44],
  });
}

function createBatchPinIcon(portions: number, category: string, isSelected: boolean) {
  const bg = isSelected ? '#18563B' : '#22744F';
  const border = isSelected ? '#FACC15' : '#ffffff';
  const scale = isSelected ? '1.1' : '1.0';
  const svg = `
    <div style="display:flex;align-items:center;gap:4px;background:${bg};color:#ffffff;border:2px solid ${border};border-radius:16px;padding:3px 8px;font-size:11px;font-weight:700;box-shadow:0 3px 8px rgba(0,0,0,0.25);transform:translate(-50%,-50%) scale(${scale});white-space:nowrap;cursor:pointer;">
      <span>🍱</span>
      <span>${portions}p</span>
      <span style="opacity:0.85;font-size:9px;text-transform:uppercase;">${category.slice(0, 3)}</span>
    </div>
  `;
  return L.divIcon({
    html: svg,
    className: 'civic-batch-pin',
    iconSize: [60, 26],
    iconAnchor: [30, 13],
    popupAnchor: [0, -13],
  });
}

export default function CivicMap({
  latitude,
  longitude,
  title = 'Pickup & Delivery Dispatch Location',
  address,
  height = 280,
  showDirections = true,
  markers,
  selectedMarkerId,
  onMarkerSelect,
  interactive = false,
  onLocationChange,
}: CivicMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);

  const [geoLocating, setGeoLocating] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const onLocationChangeRef = useRef(onLocationChange);
  onLocationChangeRef.current = onLocationChange;

  const onMarkerSelectRef = useRef(onMarkerSelect);
  onMarkerSelectRef.current = onMarkerSelect;

  const validLat = Number.isFinite(latitude) && latitude !== 0 ? latitude : 19.8762;
  const validLng = Number.isFinite(longitude) && longitude !== 0 ? longitude : 75.3433;

  const gmapsDirectionsUrl = useMemo(
    () => `https://www.google.com/maps/dir/?api=1&destination=${validLat},${validLng}`,
    [validLat, validLng]
  );
  const osmDirectionsUrl = useMemo(
    () => `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=%3B${validLat}%2C${validLng}`,
    [validLat, validLng]
  );

  // Initialize Leaflet Map
  useEffect(() => {
    if (!isBrowser || !mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [validLat, validLng],
      zoom: interactive ? 15 : 14,
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    if (interactive) {
      // Interactive Draggable Pin for Donors
      const marker = L.marker([validLat, validLng], {
        icon: createPickerPinIcon(address || 'Staging Location'),
        draggable: true,
      }).addTo(map);

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        const newLat = Number(pos.lat.toFixed(4));
        const newLng = Number(pos.lng.toFixed(4));
        if (onLocationChangeRef.current) {
          onLocationChangeRef.current(newLat, newLng);
        }
        setFeedbackMsg(`Pin dragged to ${newLat.toFixed(4)}°N, ${newLng.toFixed(4)}°E`);
      });

      map.on('click', (e: L.LeafletMouseEvent) => {
        const newLat = Number(e.latlng.lat.toFixed(4));
        const newLng = Number(e.latlng.lng.toFixed(4));
        marker.setLatLng([newLat, newLng]);
        if (onLocationChangeRef.current) {
          onLocationChangeRef.current(newLat, newLng);
        }
        setFeedbackMsg(`Pin placed at ${newLat.toFixed(4)}°N, ${newLng.toFixed(4)}°E`);
      });

      markerRef.current = marker;
    } else if (!markers || markers.length === 0) {
      // Single Fixed Location Pin
      const marker = L.marker([validLat, validLng], {
        icon: createPickerPinIcon(address || 'Dispatch Location'),
      }).addTo(map);

      if (address) {
        marker.bindPopup(`<strong>${title}</strong><br/>${address}`);
      }

      markerRef.current = marker;
    }

    mapInstanceRef.current = map;

    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
      markersGroupRef.current = null;
    };
  }, [interactive]);

  // Update single/interactive marker when props change externally
  useEffect(() => {
    if (!isBrowser) return;
    const map = mapInstanceRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;

    const currentPos = marker.getLatLng();
    if (Math.abs(currentPos.lat - validLat) > 0.0001 || Math.abs(currentPos.lng - validLng) > 0.0001) {
      marker.setLatLng([validLat, validLng]);
      map.panTo([validLat, validLng], { animate: true, duration: 0.35 });
    }
  }, [validLat, validLng]);

  // Multi-marker update for NGO Discovery
  useEffect(() => {
    if (!isBrowser) return;
    const map = mapInstanceRef.current;
    if (!map || !markers) return;

    if (!markersGroupRef.current) {
      markersGroupRef.current = L.layerGroup().addTo(map);
    } else {
      markersGroupRef.current.clearLayers();
    }

    if (markers.length === 0) return;

    const bounds = L.latLngBounds([]);

    markers.forEach((m) => {
      if (!Number.isFinite(m.lat) || !Number.isFinite(m.lng)) return;
      const isSelected = selectedMarkerId === m.id;
      const batchMarker = L.marker([m.lat, m.lng], {
        icon: createBatchPinIcon(m.portions || 1, m.category || 'Surplus', isSelected),
      });

      const popupContainer = document.createElement('div');
      popupContainer.style.fontFamily = 'inherit';
      popupContainer.style.fontSize = '12px';
      popupContainer.style.color = '#17251D';
      popupContainer.style.minWidth = '180px';
      popupContainer.style.padding = '4px';

      const titleDiv = document.createElement('div');
      titleDiv.style.fontWeight = '700';
      titleDiv.style.fontSize = '13px';
      titleDiv.style.marginBottom = '2px';
      titleDiv.textContent = m.label;
      popupContainer.appendChild(titleDiv);

      const infoDiv = document.createElement('div');
      infoDiv.style.color = '#566458';
      infoDiv.style.marginBottom = '8px';
      infoDiv.textContent = `${m.portions || 0} portions • ${m.distanceKm ? `${m.distanceKm.toFixed(1)} km away` : m.city || 'Nearby'}`;
      popupContainer.appendChild(infoDiv);

      const inspectBtn = document.createElement('button');
      inspectBtn.type = 'button';
      inspectBtn.textContent = 'Inspect Batch →';
      inspectBtn.style.cssText =
        'background:#22744F;color:#ffffff;border:none;border-radius:4px;padding:4px 10px;font-size:11px;font-weight:600;cursor:pointer;width:100%;';
      inspectBtn.onclick = (e) => {
        e.stopPropagation();
        if (onMarkerSelectRef.current) onMarkerSelectRef.current(m);
        if (m.onClick) m.onClick();
      };
      popupContainer.appendChild(inspectBtn);

      batchMarker.bindPopup(popupContainer);
      batchMarker.on('click', () => {
        if (onMarkerSelectRef.current) onMarkerSelectRef.current(m);
        if (m.onClick) m.onClick();
      });

      markersGroupRef.current?.addLayer(batchMarker);
      bounds.extend([m.lat, m.lng]);
    });

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [35, 35], maxZoom: 15 });
    }
  }, [markers, selectedMarkerId]);

  // Directional Nudges for donors
  const nudge = (deltaLat: number, deltaLng: number, label: string) => {
    if (!onLocationChange) return;
    const newLat = Number((validLat + deltaLat).toFixed(4));
    const newLng = Number((validLng + deltaLng).toFixed(4));
    onLocationChange(newLat, newLng);
    setFeedbackMsg(`Moved pin ${label} to ${newLat.toFixed(4)}, ${newLng.toFixed(4)}`);
  };

  // Preset location selector
  const setPreset = (lat: number, lng: number, label: string) => {
    if (!onLocationChange) return;
    onLocationChange(lat, lng);
    setFeedbackMsg(`Preset applied: ${label}`);
  };

  // Device GPS
  const handleUseCurrentLocation = () => {
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
        if (onLocationChange) {
          onLocationChange(lat, lng);
        }
        setFeedbackMsg(`GPS location locked: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      },
      () => {
        setGeoLocating(false);
        if (onLocationChange) {
          onLocationChange(19.8762, 75.3433);
        }
        setFeedbackMsg('Defaulted to civic operations center');
      },
      { timeout: 8000 }
    );
  };

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
          <span style={{ fontSize: '1.25rem' }} aria-hidden="true">
            🗺️
          </span>
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
        </div>
      </div>

      {/* Interactive Controls for Donors */}
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
              📍 Pin Nudge:
            </span>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
              onClick={(e) => {
                e.stopPropagation();
                nudge(0.002, 0, 'North');
              }}
              title="Nudge pin North"
            >
              ⬆️ North
            </button>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
              onClick={(e) => {
                e.stopPropagation();
                nudge(-0.002, 0, 'South');
              }}
              title="Nudge pin South"
            >
              ⬇️ South
            </button>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
              onClick={(e) => {
                e.stopPropagation();
                nudge(0, -0.002, 'West');
              }}
              title="Nudge pin West"
            >
              ⬅️ West
            </button>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
              onClick={(e) => {
                e.stopPropagation();
                nudge(0, 0.002, 'East');
              }}
              title="Nudge pin East"
            >
              ➡️ East
            </button>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
              onClick={(e) => {
                e.stopPropagation();
                handleUseCurrentLocation();
              }}
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
              onClick={(e) => {
                e.stopPropagation();
                setPreset(19.8762, 75.3433, 'Central City');
              }}
            >
              City Center
            </button>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem' }}
              onClick={(e) => {
                e.stopPropagation();
                setPreset(19.885, 75.32, 'Industrial Bay');
              }}
            >
              North Hub
            </button>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem' }}
              onClick={(e) => {
                e.stopPropagation();
                setPreset(19.862, 75.365, 'Market Zone');
              }}
            >
              Market Bay
            </button>
          </div>
        </div>
      )}

      {/* Real Leaflet Map Viewport */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: typeof height === 'number' ? `${height}px` : height,
          background: '#e5e3df',
          overflow: 'hidden',
        }}
      >
        {isBrowser ? (
          <div
            ref={mapContainerRef}
            aria-label="Interactive map view"
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          /* JSDOM Accessible Test Representation */
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--color-canvas)',
              color: 'var(--color-secondary)',
              fontSize: '0.875rem',
            }}
          >
            <span>
              Map Viewport ({validLat.toFixed(4)}, {validLng.toFixed(4)})
            </span>
          </div>
        )}

        {/* Real-time Instructions Overlay */}
        {interactive && (
          <div
            style={{
              position: 'absolute',
              bottom: '8px',
              left: '8px',
              zIndex: 400,
              background: 'rgba(255, 255, 255, 0.92)',
              padding: '4px 10px',
              borderRadius: 'var(--radius-sm)',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              fontSize: '0.75rem',
              color: 'var(--color-ink)',
              pointerEvents: 'none',
              border: '1px solid var(--color-border)',
            }}
          >
            💡 Click anywhere or drag the pin to set pickup point
          </div>
        )}
      </div>

      {/* Interaction Status helper */}
      {interactive && feedbackMsg && (
        <div
          style={{
            padding: '0.4rem 1rem',
            background: 'var(--color-canvas)',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.75rem',
            color: 'var(--color-accent)',
            fontWeight: 600,
          }}
        >
          <span>✓ {feedbackMsg}</span>
          <span style={{ fontFamily: 'monospace', color: 'var(--color-secondary)' }}>
            Coordinates: {validLat.toFixed(4)}, {validLng.toFixed(4)}
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
              {activeMarker.portions} portions available •{' '}
              {activeMarker.distanceKm !== undefined
                ? `${activeMarker.distanceKm.toFixed(1)} km straight-line distance`
                : activeMarker.city || ''}
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
            🚚 Dispatch vehicle destination: <strong>{validLat.toFixed(4)}, {validLng.toFixed(4)}</strong>
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
