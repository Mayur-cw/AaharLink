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

  const [maxPortions, setMaxPortions] = useState('');
  const [radiusKm, setRadiusKm] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
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

  return (
    <div className="page-container page-container--narrow">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <button
          type="button"
          data-testid="EL-157"
          className="btn btn--outline btn--sm"
          onClick={() => navigate('/ngo')}
        >
          ← Return to NGO dashboard
        </button>

        <button
          type="button"
          data-testid="EL-158"
          className="btn btn--secondary btn--sm"
          onClick={fetchCapacity}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Reload current capacity'}
        </button>
      </div>

      <div className="card">
        <h1 className="card-title">NGO Portion Capacity & Travel Preferences</h1>
        <p className="card-description">
          Set your relief depot limits. The system automatically prevents over-allocation by verifying that active portions do not exceed your available fleet capacity.
        </p>

        {errorMsg && (
          <div className="error-banner" role="alert" style={{ marginBottom: '1.25rem' }}>
            <span aria-hidden="true">⚠ </span>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="cap-portions" className="form-label">
              Available Portion Capacity (Max Simultaneous) <span className="required-indicator">*</span>
            </label>
            <input
              id="cap-portions"
              type="number"
              min="1"
              max="50000"
              data-testid="EL-159"
              className="form-input"
              value={maxPortions}
              onChange={(e) => setMaxPortions(e.target.value)}
              required
            />
            <span className="form-hint">Maximum cumulative meal servings your relief kitchens can refrigerate and distribute.</span>
          </div>

          <div className="form-group">
            <label htmlFor="cap-radius" className="form-label">
              Maximum Straight-Line Distance (km) <span className="required-indicator">*</span>
            </label>
            <input
              id="cap-radius"
              type="number"
              min="1"
              max="200"
              data-testid="EL-160"
              className="form-input"
              value={radiusKm}
              onChange={(e) => setRadiusKm(e.target.value)}
              required
            />
            <span className="form-hint">Maximum transit radius for food discovery listings.</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label htmlFor="cap-lat" className="form-label">
                Operating Latitude <span className="required-indicator">*</span>
              </label>
              <input
                id="cap-lat"
                type="number"
                step="0.0001"
                data-testid="EL-161"
                className="form-input"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="cap-lng" className="form-label">
                Operating Longitude <span className="required-indicator">*</span>
              </label>
              <input
                id="cap-lng"
                type="number"
                step="0.0001"
                data-testid="EL-162"
                className="form-input"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="cap-version" className="form-label">
              Record Version (CAS Optimistic Concurrency Lock)
            </label>
            <input
              id="cap-version"
              type="text"
              data-testid="EL-163"
              className="form-input"
              value={version}
              readOnly
              disabled
            />
          </div>

          {/* Base Station Map */}
          {Number.isFinite(parseFloat(latitude)) && Number.isFinite(parseFloat(longitude)) && parseFloat(latitude) !== 0 && (
            <CivicMap
              latitude={parseFloat(latitude)}
              longitude={parseFloat(longitude)}
              title="NGO Base Station & Operations Center"
              address={`Configured Transit Dispatch Radius: ${radiusKm || '25'} km`}
              height={220}
              showDirections={false}
            />
          )}

          <div className="form-actions" style={{ marginTop: '1.5rem' }}>
            <button
              type="submit"
              data-testid="EL-164"
              className="btn btn--primary btn--lg full-width"
              disabled={saving || loading}
            >
              {saving ? 'Saving Preferences...' : 'Save NGO capacity and travel preferences'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
