import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';

interface NgoDashboardData {
  organizationName: string;
  verificationStatus: string;
  maxPortions: number;
  remainingCapacity: number;
  operatingRadiusKm: number;
  activeClaimsCount: number;
  pendingPickupCount: number;
  completedRescuesCount: number;
  activeClaims: Array<{
    id: string;
    donationId: string;
    foodCategory: string;
    description: string;
    claimedPortions: number;
    pickupDeadline: string;
    status: string;
    donorCity: string;
  }>;
}

export default function NgoDashboardPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { organization } = useAuth();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [data, setData] = useState<NgoDashboardData | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api<NgoDashboardData>('/api/ngo/dashboard');
      setData(res);
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to load NGO mission control.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="heading-xl">NGO Mission Control</h1>
          <p style={{ color: 'var(--color-secondary)' }}>
            Agency: <strong>{data?.organizationName || organization?.name || 'Verified Relief NGO'}</strong>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            data-testid="EL-112"
            className="btn btn--primary"
            onClick={() => navigate('/ngo/discover')}
          >
            🔍 Discover surplus food
          </button>
          <button
            type="button"
            data-testid="EL-117"
            className="btn btn--secondary"
            onClick={fetchDashboard}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh NGO overview'}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="error-banner" role="alert" style={{ marginBottom: '1.5rem' }}>
          <span aria-hidden="true">⚠ </span>
          {errorMsg}
        </div>
      )}

      {/* Metrics Row */}
      <div className="grid grid--4" style={{ marginBottom: '2rem' }}>
        <div className="metric-card">
          <span className="metric-label">Remaining Portion Capacity</span>
          <span className="metric-value" style={{ color: 'var(--color-accent)' }}>
            {data?.remainingCapacity ?? 0}
          </span>
          <span className="metric-hint">of {data?.maxPortions ?? 0} limit</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Active Pickups</span>
          <span className="metric-value">{data?.activeClaimsCount ?? 0}</span>
          <span className="metric-hint">Currently in transit</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Ready for Handover</span>
          <span className="metric-value">{data?.pendingPickupCount ?? 0}</span>
          <span className="metric-hint">Donor code issued</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Completed Deliveries</span>
          <span className="metric-value">{data?.completedRescuesCount ?? 0}</span>
          <span className="metric-hint">Verified food rescues</span>
        </div>
      </div>

      {/* Active Pickups Table */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 className="card-title">Current Pickups in Progress</h2>
          <button
            type="button"
            data-testid="EL-113"
            className="btn btn--outline btn--sm"
            onClick={() => navigate('/ngo/pickups')}
          >
            My pickups →
          </button>
        </div>

        {loading ? (
          <p role="status">Loading active dispatches...</p>
        ) : !data?.activeClaims || data.activeClaims.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-secondary)' }}>
            <p>No active pickups claimed right now.</p>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              style={{ marginTop: '0.75rem' }}
              onClick={() => navigate('/ngo/discover')}
            >
              Find Available Food Nearby
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Status</th>
                  <th scope="col">Food Details</th>
                  <th scope="col">Portions</th>
                  <th scope="col">Donor City</th>
                  <th scope="col">Pickup Deadline</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.activeClaims.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span className={`badge ${c.status === 'Ready' ? 'badge--success' : 'badge--warning'}`}>
                        {c.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <strong>{c.foodCategory}</strong>: {c.description}
                    </td>
                    <td>{c.claimedPortions}</td>
                    <td>{c.donorCity}</td>
                    <td>{new Date(c.pickupDeadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        onClick={() => navigate(`/ngo/pickups/${c.id}`)}
                      >
                        Handover Portal
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action cards */}
      <div className="grid grid--3">
        <div className="card" style={{ textAlign: 'center' }}>
          <h3 className="card-title">Capacity & Radius</h3>
          <p className="card-description">Configure your relief vehicle capacity limits and maximum dispatch range.</p>
          <div style={{ marginTop: '1rem' }}>
            <button
              type="button"
              data-testid="EL-114"
              className="btn btn--outline full-width"
              onClick={() => navigate('/ngo/capacity')}
            >
              Set pickup capacity
            </button>
          </div>
        </div>

        <div className="card" style={{ textAlign: 'center' }}>
          <h3 className="card-title">Agency Verification</h3>
          <p className="card-description">Inspect your verified NGO credentials, contact officer, and dispatch telephone.</p>
          <div style={{ marginTop: '1rem' }}>
            <button
              type="button"
              data-testid="EL-115"
              className="btn btn--outline full-width"
              onClick={() => navigate('/account')}
            >
              Organization settings
            </button>
          </div>
        </div>

        <div className="card" style={{ textAlign: 'center' }}>
          <h3 className="card-title">Alerts & Directives</h3>
          <p className="card-description">Real-time alerts when donors stage food and confirm pickup readiness.</p>
          <div style={{ marginTop: '1rem' }}>
            <button
              type="button"
              data-testid="EL-116"
              className="btn btn--outline full-width"
              onClick={() => navigate('/notifications')}
            >
              Notifications
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
