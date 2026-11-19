import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api.js';
import { useToast } from '../context/ToastContext.js';

interface OrgReviewDetail {
  id: string;
  name: string;
  kind: string;
  status: string;
  contactPerson: string;
  contactPhone: string;
  city: string;
  latitude: number;
  longitude: number;
  maxPortions?: number;
  operatingRadiusKm?: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  auditTrail?: Array<{
    id: string;
    eventType: string;
    reason: string | null;
    createdAt: string;
  }>;
}

export default function CoordinatorOrgReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [org, setOrg] = useState<OrgReviewDetail | null>(null);

  // Decision State
  const [decision, setDecision] = useState<'verify' | 'reject' | 'suspend'>('verify');
  const [reason, setReason] = useState('');

  const fetchOrg = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await api<OrgReviewDetail>(`/api/coordinator/organizations/${id}`);
      setOrg(data);
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to load organization record.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    fetchOrg();
  }, [fetchOrg]);

  const handleApplyDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!org || !id) return;

    if (reason.trim().length < 5) {
      toast.error('Decision reason must be at least 5 characters.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      await api.post(`/api/coordinator/organizations/${id}/decision`, {
        decision,
        reason: reason.trim(),
        expectedVersion: org.version,
      });

      toast.success(`Organization ${decision.toUpperCase()} decision applied and recorded in audit ledger.`);
      await fetchOrg();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        toast.warning('Organization record version changed; reloaded fresh data.');
        await fetchOrg();
      } else {
        const msg = (err as Error).message || 'Failed to apply verification decision.';
        setErrorMsg(msg);
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container" role="status" aria-busy="true">
        <p>Loading organization profile and compliance history...</p>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="page-container">
        <div className="card">
          <h1 className="card-title">Organization Not Found</h1>
          <p>The requested organization record could not be found.</p>
          <button
            type="button"
            data-testid="EL-182"
            className="btn btn--primary"
            onClick={() => navigate('/coordinator/organizations')}
          >
            Back to verification queue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container page-container--narrow">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <button
          type="button"
          data-testid="EL-182"
          className="btn btn--outline btn--sm"
          onClick={() => navigate('/coordinator/organizations')}
        >
          ← Back to verification queue
        </button>

        <button
          type="button"
          data-testid="EL-183"
          className="btn btn--secondary btn--sm"
          onClick={fetchOrg}
        >
          Refresh organization record
        </button>
      </div>

      {errorMsg && (
        <div className="error-banner" role="alert" style={{ marginBottom: '1.25rem' }}>
          <span aria-hidden="true">⚠ </span>
          {errorMsg}
        </div>
      )}

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span className={`badge ${org.status === 'verified' ? 'badge--success' : org.status === 'pending' ? 'badge--warning' : 'badge--danger'}`}>
                {org.status.toUpperCase()}
              </span>
              <span className="badge badge--info">{org.kind.toUpperCase()}</span>
            </div>
            <h1 className="card-title" style={{ fontSize: '1.75rem' }}>{org.name}</h1>
          </div>

          <div style={{ textAlign: 'right', fontSize: '0.875rem', color: 'var(--color-secondary)' }}>
            <div>Record Version {org.version}</div>
            <div>Registered: {new Date(org.createdAt).toLocaleDateString()}</div>
          </div>
        </div>

        {/* Credential Data Grid */}
        <div className="grid grid--2" style={{ gap: '1rem', marginBottom: '1.5rem', padding: '1rem', background: 'var(--color-canvas)', borderRadius: 'var(--radius-sm)' }}>
          <div>
            <p><strong>Contact Person:</strong> {org.contactPerson}</p>
            <p><strong>Telephone:</strong> {org.contactPhone}</p>
            <p><strong>Operating City:</strong> {org.city}</p>
          </div>
          <div>
            <p><strong>Location Coordinates:</strong> {org.latitude.toFixed(4)}, {org.longitude.toFixed(4)}</p>
            {org.maxPortions !== undefined && <p><strong>Portion Capacity:</strong> {org.maxPortions}</p>}
            {org.operatingRadiusKm !== undefined && <p><strong>Operating Radius:</strong> {org.operatingRadiusKm} km</p>}
          </div>
        </div>

        {/* Verification Decision Form */}
        <div style={{ padding: '1.5rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem', color: 'var(--color-ink)' }}>
            Coordinator Accreditation Decision (VR-007)
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-secondary)', marginBottom: '1.25rem' }}>
            Verify credentials, food business registration, or relief trust credentials. Every decision publishes an in-app notice and appends an immutable audit event.
          </p>

          <form onSubmit={handleApplyDecision} noValidate>
            <div className="form-group">
              <label htmlFor="coord-decision" className="form-label">
                Decision Action <span className="required-indicator">*</span>
              </label>
              <select
                id="coord-decision"
                data-testid="EL-184"
                className="form-input"
                value={decision}
                onChange={(e) => setDecision(e.target.value as 'verify' | 'reject' | 'suspend')}
              >
                <option value="verify">Approve / Verify Organization</option>
                <option value="reject">Reject Application</option>
                <option value="suspend">Suspend Organization</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="coord-reason" className="form-label">
                Verification Decision Reason <span className="required-indicator">*</span>
              </label>
              <textarea
                id="coord-reason"
                data-testid="EL-185"
                className="form-input form-textarea"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Verified municipal food hygiene certificate and emergency feeding dispatch depot credentials."
                required
              />
              <span className="form-hint">Mandatory justification for audit transparency (min 5 characters).</span>
            </div>

            <div className="form-actions" style={{ marginTop: '1.5rem' }}>
              <button
                type="submit"
                data-testid="EL-186"
                className="btn btn--primary btn--lg full-width"
                disabled={submitting || loading}
              >
                {submitting ? 'Recording Decision...' : 'Apply verification decision'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
