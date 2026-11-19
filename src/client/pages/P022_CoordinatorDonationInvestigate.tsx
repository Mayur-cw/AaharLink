import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api.js';
import { useToast } from '../context/ToastContext.js';

interface CoordinatorDonationInvestigateDetail {
  id: string;
  donorOrgId: string;
  donorOrgName: string;
  foodCategory: string;
  description: string;
  portionsOffered: number;
  preparedAt: string;
  pickupDeadline: string;
  pickupAddress: string;
  pickupLatitude: number;
  pickupLongitude: number;
  status: string;
  version: number;
  activeClaim?: {
    id: string;
    ngoOrgId: string;
    ngoOrgName: string;
    status: string;
    claimedPortions: number;
    claimedAt: string;
    handoverAttempts: number;
  } | null;
  auditTrail?: Array<{
    id: string;
    eventType: string;
    actorRole: string;
    reason: string | null;
    createdAt: string;
  }>;
}

export default function CoordinatorDonationInvestigatePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [donation, setDonation] = useState<CoordinatorDonationInvestigateDetail | null>(null);

  // Resolution Form
  const [decision, setDecision] = useState<'dispute' | 'cancel' | 'unclaim'>('dispute');
  const [reason, setReason] = useState('');

  const fetchDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await api<CoordinatorDonationInvestigateDetail>(`/api/coordinator/donations/${id}`);
      setDonation(data);
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to load donation details for investigation.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!donation || !id) return;

    if (reason.trim().length < 5) {
      toast.error('Investigation resolution reason must be at least 5 characters.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      await api.post(`/api/coordinator/donations/${id}/resolve`, {
        decision,
        reason: reason.trim(),
        expectedVersion: donation.version,
      });

      toast.success(`Coordinator disposition [${decision.toUpperCase()}] executed and logged to audit ledger.`);
      await fetchDetail();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        toast.warning('Donation state modified; refreshing authoritative data.');
        await fetchDetail();
      } else {
        const msg = (err as Error).message || 'Failed to record resolution.';
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
        <p>Loading donation investigation dossier...</p>
      </div>
    );
  }

  if (!donation) {
    return (
      <div className="page-container">
        <div className="card">
          <h1 className="card-title">Donation Record Not Located</h1>
          <p>The requested donation could not be loaded for investigation.</p>
          <button
            type="button"
            data-testid="EL-199"
            className="btn btn--primary"
            onClick={() => navigate('/coordinator/donations')}
          >
            Return to donation monitor
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
          data-testid="EL-199"
          className="btn btn--outline btn--sm"
          onClick={() => navigate('/coordinator/donations')}
        >
          ← Return to donation monitor
        </button>

        <button
          type="button"
          data-testid="EL-200"
          className="btn btn--secondary btn--sm"
          onClick={fetchDetail}
        >
          Reload donation investigation
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
              <span className={`badge ${donation.status === 'Disputed' ? 'badge--danger' : donation.status === 'Completed' ? 'badge--success' : 'badge--warning'}`}>
                {donation.status.toUpperCase()}
              </span>
              <span className="badge badge--info">{donation.foodCategory}</span>
            </div>
            <h1 className="card-title" style={{ fontSize: '1.75rem' }}>{donation.description}</h1>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-accent)' }}>
              {donation.portionsOffered} <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--color-secondary)' }}>portions</span>
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-secondary)' }}>
              Record Version {donation.version}
            </div>
          </div>
        </div>

        {/* Dossier Information */}
        <div className="grid grid--2" style={{ gap: '1rem', marginBottom: '1.5rem', padding: '1rem', background: 'var(--color-canvas)', borderRadius: 'var(--radius-sm)' }}>
          <div>
            <p><strong>Donor Organization:</strong> {donation.donorOrgName}</p>
            <p><strong>Pickup Address:</strong> {donation.pickupAddress}</p>
            <p><strong>Coordinates:</strong> {donation.pickupLatitude.toFixed(4)}, {donation.pickupLongitude.toFixed(4)}</p>
          </div>
          <div>
            <p><strong>Safe Pickup Deadline:</strong> {new Date(donation.pickupDeadline).toLocaleString()}</p>
            <p><strong>Prepared At:</strong> {new Date(donation.preparedAt).toLocaleString()}</p>
            <p><strong>Claiming NGO:</strong> {donation.activeClaim ? `${donation.activeClaim.ngoOrgName} (${donation.activeClaim.status})` : 'Unclaimed'}</p>
          </div>
        </div>

        {/* Coordinator Resolution Form */}
        <div style={{ padding: '1.5rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem', color: 'var(--color-ink)' }}>
            Coordinator Investigation Disposition (VR-030)
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-secondary)', marginBottom: '1.25rem' }}>
            Resolve pickup disputes, release blocked relief capacity, or cancel spoiled surplus listings.
          </p>

          <form onSubmit={handleResolve} noValidate>
            <div className="form-group">
              <label htmlFor="inv-disposition" className="form-label">
                Investigation Disposition <span className="required-indicator">*</span>
              </label>
              <select
                id="inv-disposition"
                data-testid="EL-201"
                className="form-input"
                value={decision}
                onChange={(e) => setDecision(e.target.value as 'dispute' | 'cancel' | 'unclaim')}
              >
                <option value="dispute">Flag as Disputed (Freeze actions pending inquiry)</option>
                <option value="unclaim">Release Claim (Restore donation to Available, unblock NGO)</option>
                <option value="cancel">Cancel Donation (Archive batch permanently)</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="inv-reason" className="form-label">
                Investigation Resolution Reason <span className="required-indicator">*</span>
              </label>
              <textarea
                id="inv-reason"
                data-testid="EL-202"
                className="form-input form-textarea"
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Relief driver arrived on site but donor premises were closed; verified by call logs."
                required
              />
              <span className="form-hint">Provide transparent justification for the permanent audit trail (min 5 characters).</span>
            </div>

            <div className="form-actions" style={{ marginTop: '1.5rem' }}>
              <button
                type="submit"
                data-testid="EL-203"
                className="btn btn--primary btn--lg full-width"
                disabled={submitting || loading}
              >
                {submitting ? 'Recording Resolution...' : 'Record coordinator resolution'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
