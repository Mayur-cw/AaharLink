import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.js';

interface CoordinatorDashboardData {
  pendingOrganizationsCount: number;
  activeDonationsCount: number;
  urgentExceptionsCount: number;
  completedRescuesCount: number;
  totalPortionsRescued: number;
  recentExceptions: Array<{
    id: string;
    description: string;
    foodCategory: string;
    portionsOffered: number;
    status: string;
    pickupDeadline: string;
    donorName: string;
  }>;
}

export default function CoordinatorDashboardPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [data, setData] = useState<CoordinatorDashboardData | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api<CoordinatorDashboardData>('/api/coordinator/dashboard');
      setData(res);
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to load coordinator operations overview.';
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
          <h1 className="heading-xl">Civic Logistics Operations Overview</h1>
          <p style={{ color: 'var(--color-secondary)' }}>
            System Administration, Organization Accreditation & Exception Remediation
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            data-testid="EL-171"
            className="btn btn--secondary"
            onClick={fetchDashboard}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh coordinator overview'}
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
          <span className="metric-label">Pending Org Verifications</span>
          <span className="metric-value" style={{ color: data?.pendingOrganizationsCount ? 'var(--color-amber-urgent)' : 'inherit' }}>
            {data?.pendingOrganizationsCount ?? 0}
          </span>
          <span className="metric-hint">Awaiting coordinator review</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Active Surplus Batches</span>
          <span className="metric-value">{data?.activeDonationsCount ?? 0}</span>
          <span className="metric-hint">Currently in circulation</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Urgent Exceptions</span>
          <span className="metric-value" style={{ color: data?.urgentExceptionsCount ? 'var(--color-destructive)' : 'inherit' }}>
            {data?.urgentExceptionsCount ?? 0}
          </span>
          <span className="metric-hint">Disputed or expiring</span>
        </div>
        <div className="metric-card">
          <span className="metric-label">Total Portions Rescued</span>
          <span className="metric-value" style={{ color: 'var(--color-accent)' }}>
            {data?.totalPortionsRescued ?? 0}
          </span>
          <span className="metric-hint">{data?.completedRescuesCount ?? 0} completed operations</span>
        </div>
      </div>

      {/* Operations Quick Navigations */}
      <div className="grid grid--4" style={{ marginBottom: '2rem' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <h2 className="card-title">Organization Verification</h2>
          <p className="card-description">Review NGO and donor accreditation applications, inspect credentials, and issue decisions.</p>
          <div style={{ marginTop: '1rem' }}>
            <button
              type="button"
              data-testid="EL-165"
              className="btn btn--primary full-width"
              onClick={() => navigate('/coordinator/organizations')}
            >
              Review pending organizations
            </button>
          </div>
        </div>

        <div className="card" style={{ textAlign: 'center' }}>
          <h2 className="card-title">Donation Monitor</h2>
          <p className="card-description">Inspect active food batches, investigate delivery disputes, and resolve exceptions.</p>
          <div style={{ marginTop: '1rem' }}>
            <button
              type="button"
              data-testid="EL-166"
              className="btn btn--primary full-width"
              onClick={() => navigate('/coordinator/donations')}
            >
              Monitor donations
            </button>
          </div>
        </div>

        <div className="card" style={{ textAlign: 'center' }}>
          <h2 className="card-title">Operational Analytics</h2>
          <p className="card-description">Audit real database-derived community impact, delivery speed, and portion recovery metrics.</p>
          <div style={{ marginTop: '1rem' }}>
            <button
              type="button"
              data-testid="EL-167"
              className="btn btn--primary full-width"
              onClick={() => navigate('/coordinator/analytics')}
            >
              Open analytics
            </button>
          </div>
        </div>

        <div className="card" style={{ textAlign: 'center' }}>
          <h2 className="card-title">Permanent Audit Ledger</h2>
          <p className="card-description">Verify the append-only SQLite audit log, cryptographic correlation IDs, and actor traces.</p>
          <div style={{ marginTop: '1rem' }}>
            <button
              type="button"
              data-testid="EL-168"
              className="btn btn--primary full-width"
              onClick={() => navigate('/coordinator/audit')}
            >
              Inspect audit trail
            </button>
          </div>
        </div>
      </div>

      {/* Account and Notifications shortcuts */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Coordinator Profile & Inbox</h2>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: 'var(--color-secondary)' }}>
            Access administrative security settings and inspect high-priority alerts.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            data-testid="EL-169"
            className="btn btn--secondary"
            onClick={() => navigate('/account')}
          >
            Account settings
          </button>
          <button
            type="button"
            data-testid="EL-170"
            className="btn btn--secondary"
            onClick={() => navigate('/notifications')}
          >
            Notifications
          </button>
        </div>
      </div>
    </div>
  );
}
