import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';

interface DonorDashboardData {
  organizationName: string;
  verificationStatus: string;
  activeListingsCount: number;
  claimedPendingReadyCount: number;
  readyForPickupCount: number;
  completedRescuesCount: number;
  totalPortionsRescued: number;
  urgentDonations: Array<{
    id: string;
    foodCategory: string;
    description: string;
    portionsOffered: number;
    pickupDeadline: string;
    status: string;
    claimStatus: string | null;
  }>;
}

export default function DonorDashboardPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { organization } = useAuth();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [data, setData] = useState<DonorDashboardData | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api<DonorDashboardData>('/api/donor/dashboard');
      setData(res);
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to load donor overview.';
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
          <h1 className="heading-xl">Donor Command Center</h1>
          <p style={{ color: 'var(--color-secondary)' }}>
            Organization: <strong>{data?.organizationName || organization?.name || 'Verified Food Donor'}</strong>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            data-testid="EL-052"
            className="btn btn--primary"
            onClick={() => navigate('/donor/donations/new')}
          >
            + Create donation
          </button>
          <button
            type="button"
            data-testid="EL-057"
            className="btn btn--secondary"
            onClick={fetchDashboard}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh donor overview'}
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
          <span className="metric-label">Active Listings</span>
          <span className="metric-value">{data?.activeListingsCount ?? 0}</span>
          <span className="metric-hint">Awaiting NGO claims</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Claimed — Awaiting Ready</span>
          <span className="metric-value">{data?.claimedPendingReadyCount ?? 0}</span>
          <span className="metric-hint">Prepare packaging & issue code</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Ready for Pickup</span>
          <span className="metric-value">{data?.readyForPickupCount ?? 0}</span>
          <span className="metric-hint">Handover code active</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Portions Rescued</span>
          <span className="metric-value">{data?.totalPortionsRescued ?? 0}</span>
          <span className="metric-hint">{data?.completedRescuesCount ?? 0} total rescues</span>
        </div>
      </div>

      {/* Urgent Action Listings */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 className="card-title">Active & Urgent Donations</h2>
          <button
            type="button"
            data-testid="EL-053"
            className="btn btn--outline btn--sm"
            onClick={() => navigate('/donor/donations')}
          >
            View my donations →
          </button>
        </div>

        {loading ? (
          <p role="status">Loading active listings...</p>
        ) : !data?.urgentDonations || data.urgentDonations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-secondary)' }}>
            <p>No active surplus donations at this time.</p>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              style={{ marginTop: '0.75rem' }}
              onClick={() => navigate('/donor/donations/new')}
            >
              Publish Surplus Food
            </button>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col">Description</th>
                  <th scope="col">Portions</th>
                  <th scope="col">Status</th>
                  <th scope="col">Deadline</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.urgentDonations.map((d) => (
                  <tr key={d.id}>
                    <td><strong>{d.foodCategory}</strong></td>
                    <td>{d.description}</td>
                    <td>{d.portionsOffered}</td>
                    <td>
                      <span className={`badge ${d.status === 'Ready' ? 'badge--success' : d.status === 'Claimed' ? 'badge--warning' : 'badge--info'}`}>
                        {d.status.toUpperCase()}
                      </span>
                    </td>
                    <td>{new Date(d.pickupDeadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn--secondary btn--sm"
                        onClick={() => navigate(`/donor/donations/${d.id}`)}
                      >
                        Manage Pickup
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Navigation shortcuts */}
      <div className="grid grid--3">
        <div className="card" style={{ textAlign: 'center' }}>
          <h3 className="card-title">Completed Rescues</h3>
          <p className="card-description">View verified past donations and community impact outcomes.</p>
          <div style={{ marginTop: '1rem' }}>
            <button
              type="button"
              data-testid="EL-054"
              className="btn btn--outline full-width"
              onClick={() => navigate('/donor/history')}
            >
              View donation history
            </button>
          </div>
        </div>

        <div className="card" style={{ textAlign: 'center' }}>
          <h3 className="card-title">Organization Settings</h3>
          <p className="card-description">Update pickup dispatch details, operating coordinates, and staff contacts.</p>
          <div style={{ marginTop: '1rem' }}>
            <button
              type="button"
              data-testid="EL-055"
              className="btn btn--outline full-width"
              onClick={() => navigate('/account')}
            >
              My organization
            </button>
          </div>
        </div>

        <div className="card" style={{ textAlign: 'center' }}>
          <h3 className="card-title">Notifications & Inquiries</h3>
          <p className="card-description">Review claim notifications and collection confirmations.</p>
          <div style={{ marginTop: '1rem' }}>
            <button
              type="button"
              data-testid="EL-056"
              className="btn btn--outline full-width"
              onClick={() => navigate('/notifications')}
            >
              Open notifications
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
