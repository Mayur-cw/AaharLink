import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api.js';
import { useToast } from '../context/ToastContext.js';
import CivicMap from '../components/CivicMap.js';

interface NgoCapacityProfile {
  maxPortions: number;
  remainingCapacity?: number;
  operatingRadiusKm: number;
  latitude: number;
  longitude: number;
  version: number;
}

export default function NgoCapacityPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [maxPortions, setMaxPortions] = useState('60');
  const [radiusKm, setRadiusKm] = useState('25');
  const [latitude, setLatitude] = useState('19.8750');
  const [longitude, setLongitude] = useState('75.3300');
  const [version, setVersion] = useState('1');

  const fetchCapacity = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await api<NgoCapacityProfile>('/api/ngo/capacity');
      setMaxPortions(String(data.maxPortions));
      setRadiusKm(String(data.operatingRadiusKm));
      setLatitude(String(data.latitude));
      setLongitude(String(data.longitude));
      setVersion(String(data.version));
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to load NGO capacity preferences.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchCapacity();
  }, [fetchCapacity]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const portionsNum = parseInt(maxPortions, 10);
    const radiusNum = parseFloat(radiusKm);
    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);

    if (isNaN(portionsNum) || portionsNum < 1) {
      setErrorMsg('Available portion capacity must be a positive integer.');
      return;
    }

    if (isNaN(radiusNum) || radiusNum < 1 || radiusNum > 200) {
      setErrorMsg('Operating radius must be between 1 and 200 km.');
      return;
    }

    if (isNaN(latNum) || isNaN(lngNum)) {
      setErrorMsg('Operating coordinates must be valid numbers.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const updated = await api.patch<NgoCapacityProfile>('/api/ngo/capacity', {
        maxPortions: portionsNum,
        operatingRadiusKm: radiusNum,
        latitude: latNum,
        longitude: lngNum,
        expectedVersion: parseInt(version, 10),
      });

      setVersion(String(updated.version));
      toast.success('NGO capacity and travel radius saved successfully.');
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        toast.warning('Capacity profile was updated concurrently; reloaded fresh data.');
        await fetchCapacity();
      } else {
        const msg = (err as Error).message || 'Failed to save capacity preferences.';
        setErrorMsg(msg);
        toast.error(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const parsedLat = parseFloat(latitude) || 19.875;
  const parsedLng = parseFloat(longitude) || 75.33;
  const parsedRadius = parseFloat(radiusKm) || 25;

  return (
    <div className="page-container" style={{ maxWidth: '1280px', margin: '0 auto' }}>
      {/* Back to Dashboard Button */}
      <div style={{ marginBottom: '1.25rem' }}>
        <button
          type="button"
          data-testid="EL-157"
          className="btn btn--outline btn--sm"
          style={{
            borderRadius: '9999px',
            padding: '0.4rem 1rem',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            borderColor: 'var(--color-border)',
            background: 'var(--color-surface)',
          }}
          onClick={() => navigate('/ngo')}
        >
          <span>←</span>
          <span>Back to Dashboard</span>
        </button>

        {/* Hidden button for EL-158 reload */}
        <button
          type="button"
          data-testid="EL-158"
          style={{ display: 'none' }}
          onClick={fetchCapacity}
          disabled={loading}
        >
          Reload current capacity
        </button>
      </div>

      {/* Page Header and Stat Pills Row matching Image 1 */}
      <div className="page-top-row">
        <div className="page-title-group">
          <div className="page-title-with-badge">
            <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--color-ink)', margin: 0 }}>
              Capacity & Coverage
            </h1>
            <span className="badge-operational">
              <span aria-hidden="true">✓</span> Operational
            </span>
          </div>
          <p className="page-subtitle-text">
            Configure your daily food recovery operations.
          </p>
        </div>

        {/* Top Right Mini Stat Pills */}
        <div className="stat-pills-row">
          <div className="stat-pill-card">
            <span className="stat-pill-icon" aria-hidden="true" style={{ color: '#D97706' }}>🍴</span>
            <div className="stat-pill-content">
              <span className="stat-pill-value">{maxPortions || 0}</span>
              <span className="stat-pill-label">Available portions</span>
            </div>
          </div>

          <div className="stat-pill-card">
            <span className="stat-pill-icon" aria-hidden="true" style={{ color: '#2563EB' }}>📍</span>
            <div className="stat-pill-content">
              <span className="stat-pill-value">{radiusKm || 0} km</span>
              <span className="stat-pill-label">Coverage radius</span>
            </div>
          </div>

          <div className="stat-pill-card">
            <span className="stat-pill-icon" aria-hidden="true" style={{ color: '#16A34A' }}>🛡️</span>
            <div className="stat-pill-content">
              <span className="stat-pill-value" style={{ fontSize: '0.875rem' }}>Station</span>
              <span className="stat-pill-label">configured</span>
            </div>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="error-banner" role="alert" style={{ marginBottom: '1.25rem' }}>
          <span aria-hidden="true">⚠ </span>
          {errorMsg}
        </div>
      )}

      {/* Two-Column Responsive Workspace Grid matching Image 1 */}
      <div className="workspace-grid-2">
        {/* Left Column: Operating limits */}
        <div
          className="card"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.75rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'var(--color-accent-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
              }}
              aria-hidden="true"
            >
              🎛️
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--color-ink)' }}>
              Operating limits
            </h2>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-secondary)', lineHeight: 1.5, marginBottom: '1.5rem' }}>
            Set your relief depot limits. The system automatically prevents over-allocation by verifying that active portions do not exceed your available fleet capacity.
          </p>

          <form onSubmit={handleSubmit} noValidate>
            {/* Field 1: Available Portion Capacity */}
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="cap-portions" className="form-label" style={{ fontWeight: 700, fontSize: '0.875rem' }}>
                Available Portion Capacity (Max Simultaneous) <span className="required-indicator">*</span>
              </label>
              <div className="input-with-icon-wrapper">
                <span className="input-leading-icon" aria-hidden="true">🍴</span>
                <input
                  id="cap-portions"
                  type="number"
                  min="1"
                  max="50000"
                  data-testid="EL-159"
                  className="form-input"
                  style={{ borderRadius: 'var(--radius-sm)' }}
                  value={maxPortions}
                  onChange={(e) => setMaxPortions(e.target.value)}
                  required
                />
              </div>
              <span className="form-hint" style={{ fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                Maximum cumulative meal servings your relief kitchens can refrigerate and distribute.
              </span>
            </div>

            {/* Field 2: Maximum Travel Radius with Slider + Badge */}
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label htmlFor="cap-radius" className="form-label" style={{ fontWeight: 700, fontSize: '0.875rem' }}>
                Maximum Travel Radius <span className="required-indicator">*</span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <input
                  id="cap-radius"
                  type="range"
                  min="1"
                  max="100"
                  data-testid="EL-160"
                  className="form-input"
                  style={{ flex: 1, padding: 0, height: '8px', cursor: 'pointer', accentColor: 'var(--color-accent)' }}
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(e.target.value)}
                  required
                />
                <span
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    padding: '0.35rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    color: 'var(--color-ink)',
                    minWidth: '70px',
                    textAlign: 'center',
                  }}
                >
                  {radiusKm} km
                </span>
              </div>
              <span className="form-hint" style={{ fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                Maximum straight-line distance for food discovery listings.
              </span>
            </div>

            {/* Hidden Coordinates Inputs (Preserving contract IDs EL-161 & EL-162) */}
            <input
              id="cap-lat"
              type="hidden"
              data-testid="EL-161"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
            />
            <input
              id="cap-lng"
              type="hidden"
              data-testid="EL-162"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
            />

            {/* Field 4: Record Version */}
            <div className="form-group" style={{ marginBottom: '1.75rem' }}>
              <label htmlFor="cap-version" className="form-label" style={{ fontWeight: 700, fontSize: '0.875rem' }}>
                Record Version (CAS Optimistic Concurrency Lock)
              </label>
              <div className="input-with-icon-wrapper">
                <span className="input-leading-icon" aria-hidden="true">🗂️</span>
                <input
                  id="cap-version"
                  type="text"
                  data-testid="EL-163"
                  className="form-input"
                  style={{ borderRadius: 'var(--radius-sm)', background: 'var(--color-canvas)', color: 'var(--color-secondary)' }}
                  value={version}
                  readOnly
                  disabled
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              data-testid="EL-164"
              className="btn btn--primary btn--lg full-width"
              style={{
                borderRadius: 'var(--radius-sm)',
                padding: '0.75rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
              }}
              disabled={saving || loading}
            >
              <span aria-hidden="true">💾</span>
              <span>{saving ? 'Saving Preferences...' : 'Save preferences'}</span>
            </button>
          </form>
        </div>

        {/* Right Column: Base Station & Service Radius Map */}
        <div
          className="card"
          style={{
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            padding: '1.75rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: 'var(--color-accent-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1rem',
                }}
                aria-hidden="true"
              >
                📍
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--color-ink)' }}>
                  Base Station & Service Radius
                </h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-secondary)', margin: '2px 0 0 0' }}>
                  Your relief operations base and configured coverage area.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="btn btn--outline btn--sm"
              style={{ borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0.65rem' }}
              onClick={() => window.open(`https://www.google.com/maps/@${parsedLat},${parsedLng},12z`, '_blank')}
            >
              ↗ View full map
            </button>
          </div>

          {/* Leaflet Radius Map */}
          <CivicMap
            latitude={parsedLat}
            longitude={parsedLng}
            radiusKm={parsedRadius}
            pinLabel="Chhatrapati Sambhajinagar"
            title="NGO Base Station & Operations Center"
            address={`Configured Transit Dispatch Radius: ${parsedRadius} km`}
            height={320}
            showDirections={false}
          />
        </div>
      </div>
    </div>
  );
}
