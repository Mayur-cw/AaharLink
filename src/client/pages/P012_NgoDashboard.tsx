import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import type { NgoDashboardDTO, DonationPublicPreview, Paginated } from '../../shared/contracts.js';

export default function NgoDashboardPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { organization } = useAuth();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [data, setData] = useState<NgoDashboardDTO | null>(null);
  const [availableDonations, setAvailableDonations] = useState<DonationPublicPreview[]>([]);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [dashRes, discRes] = await Promise.all([
        api<NgoDashboardDTO>('/api/ngo/dashboard'),
        api<Paginated<DonationPublicPreview>>('/api/ngo/discover?limit=5').catch(() => ({ items: [], nextCursor: null })),
      ]);
      setData(dashRes);
      setAvailableDonations(discRes.items || []);
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

  const availablePortions = data?.currentCapacity?.availablePortions ?? 0;
  const maxPortions = data?.currentCapacity?.maxPortions ?? 0;
  const activePickups = data?.activeClaimsCount ?? 0;
  const readyCount = data?.readyForHandoverCount ?? 0;
  const completedCount = data?.completedPickupsCount ?? 0;

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="heading-xl">NGO Mission Control</h1>
          <p style={{ color: 'var(--color-secondary)' }}>
            Agency: <strong>{organization?.name || 'Verified Relief NGO'}</strong>
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
        <button
          type="button"
          className="metric-card"
          onClick={() => navigate('/ngo/capacity')}
          style={{ textAlign: 'left', background: 'var(--color-surface)', border: '1px solid var(--color-border)', cursor: 'pointer', width: '100%', font: 'inherit' }}
          title="Click to view and configure vehicle capacity"
        >
          <span className="metric-label">Remaining Portion Capacity</span>
          <span className="metric-value" style={{ color: 'var(--color-accent)' }}>
            {availablePortions}
          </span>
          <span className="metric-hint">of {maxPortions} portion limit</span>
        </button>
        <button
          type="button"
          className="metric-card"
          onClick={() => navigate('/ngo/pickups?tab=active')}
          style={{ textAlign: 'left', background: 'var(--color-surface)', border: '1px solid var(--color-border)', cursor: 'pointer', width: '100%', font: 'inherit' }}
          title="Click to view all active dispatches"
        >
          <span className="metric-label">Active Pickups</span>
          <span className="metric-value">{activePickups}</span>
          <span className="metric-hint">Currently in transit</span>
        </button>
        <button
          type="button"
          className="metric-card"
          onClick={() => navigate('/ngo/pickups?tab=active')}
          style={{ textAlign: 'left', background: 'var(--color-surface)', border: '1px solid var(--color-border)', cursor: 'pointer', width: '100%', font: 'inherit' }}
          title="Click to view pickups ready for handover"
        >
          <span className="metric-label">Ready for Handover</span>
          <span className="metric-value" style={{ color: readyCount > 0 ? 'var(--color-accent)' : undefined }}>
            {readyCount}
          </span>
          <span className="metric-hint">Donor code waiting</span>
        </button>
        <button
          type="button"
          className="metric-card"
          onClick={() => navigate('/ngo/pickups?tab=archived')}
          style={{ textAlign: 'left', background: 'var(--color-surface)', border: '1px solid var(--color-border)', cursor: 'pointer', width: '100%', font: 'inherit' }}
          title="Click to view completed rescue history"
        >
          <span className="metric-label">Completed Deliveries</span>
          <span className="metric-value">{completedCount}</span>
          <span className="metric-hint">Verified food rescues →</span>
        </button>
      </div>

      {/* Active Pickups Table */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 className="card-title">Current Pickups in Progress</h2>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: 'var(--color-secondary)' }}>
              Active dispatches requiring vehicle pickup and on-site code verification.
            </p>
          </div>
          <button
            type="button"
            data-testid="EL-113"
            className="btn btn--outline btn--sm"
            onClick={() => navigate('/ngo/pickups')}
          >
            My pickups ({activePickups}) →
          </button>
        </div>

        {loading ? (
          <p role="status">Loading active dispatches...</p>
        ) : !data?.urgentPickups || data.urgentPickups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2.5rem 1.5rem', background: 'var(--color-canvas)', borderRadius: 'var(--radius-sm)' }}>
            <span style={{ fontSize: '2.5rem' }}>🚚</span>
            <h3 style={{ margin: '0.5rem 0 0.25rem 0', fontSize: '1.1rem' }}>No active pickups claimed right now.</h3>
            <p style={{ margin: '0 0 1rem 0', color: 'var(--color-secondary)', fontSize: '0.875rem' }}>
              Portions you claim from food donors will appear here with real-time status and pickup navigation.
            </p>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => navigate('/ngo/discover')}
            >
              🔍 Find Available Food Nearby
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
                {data.urgentPickups.map((c) => {
                  const isReady = c.status === 'Ready';
                  return (
                    <tr key={c.id}>
                      <td>
                        <span className={`badge ${isReady ? 'badge--success' : 'badge--warning'}`}>
                          {isReady ? 'READY (CODE ISSUED)' : 'IN TRANSIT'}
                        </span>
                      </td>
                      <td>
                        <strong>{c.category}</strong>: {c.description}
                      </td>
                      <td>
                        <strong>{c.claimedPortions}</strong> portions
                      </td>
                      <td>{c.donorCity}</td>
                      <td>
                        <span style={{ color: isReady ? 'var(--color-accent-hover)' : 'inherit', fontWeight: isReady ? 600 : 400 }}>
                          {new Date(c.pickupDeadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={`btn ${isReady ? 'btn--primary' : 'btn--outline'} btn--sm`}
                          onClick={() => navigate(`/ngo/pickups/${c.id}`)}
                        >
                          {isReady ? 'Verify Handover Code →' : 'Pickup Details →'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Discover Available Food Nearby Section */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 className="card-title">Discover Available Food Nearby</h2>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: 'var(--color-secondary)' }}>
              Surplus portions published within your operating radius ready for immediate claim.
            </p>
          </div>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            onClick={() => navigate('/ngo/discover')}
          >
            Browse All Available Batches ({data?.availableDonationsNearbyCount ?? availableDonations.length}) →
          </button>
        </div>

        {availableDonations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem 1.5rem', background: 'var(--color-canvas)', borderRadius: 'var(--radius-sm)' }}>
            <p style={{ margin: '0 0 0.75rem 0', color: 'var(--color-secondary)', fontSize: '0.9rem' }}>
              No unclaimed surplus food currently in transit radius.
            </p>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => navigate('/ngo/discover')}
            >
              Check Regional Discovery Grid
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Status</th>
                  <th scope="col">Category</th>
                  <th scope="col">Description</th>
                  <th scope="col">Offered Portions</th>
                  <th scope="col">City / Distance</th>
                  <th scope="col">Pickup Deadline</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {availableDonations.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <span className="badge badge--success">AVAILABLE</span>
                    </td>
                    <td>
                      <span className="badge badge--info" style={{ textTransform: 'capitalize' }}>
                        {d.category}
                      </span>
                    </td>
                    <td>
                      <strong>{d.description}</strong>
                    </td>
                    <td>
                      <strong>{d.offeredPortions}</strong> portions
                    </td>
                    <td>
                      {d.straightLineDistanceKm !== undefined ? `${d.straightLineDistanceKm.toFixed(1)} km (${d.approximateCity})` : d.approximateCity}
                    </td>
                    <td>
                      {new Date(d.pickupDeadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn--primary btn--sm"
                        onClick={() => navigate(`/ngo/donations/${d.id}`)}
                      >
                        Inspect & Claim →
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
