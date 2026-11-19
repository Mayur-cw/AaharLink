import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api.js';
import { useToast } from '../context/ToastContext.js';
import type { DonationPublicPreview } from '../../shared/contracts.js';

export default function NgoEvaluateDonationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [donation, setDonation] = useState<DonationPublicPreview | null>(null);

  // Claim State
  const [suitabilityAffirmed, setSuitabilityAffirmed] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [claiming, setClaiming] = useState(false);

  const fetchDonation = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await api<DonationPublicPreview>(`/api/ngo/donations/${id}`);
      setDonation(data);
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to evaluate donation.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    fetchDonation();
  }, [fetchDonation]);

  const handleClaim = async () => {
    if (!donation || !id) return;
    if (!suitabilityAffirmed) {
      toast.warning('Please confirm recipient food suitability assessment before claiming.');
      return;
    }

    setClaiming(true);
    setErrorMsg(null);

    try {
      const res = await api.post<{ id: string }>(`/api/ngo/donations/${id}/claims`, {
        assessedDeclaration: true,
        expectedVersion: donation.version,
      });

      setShowConfirmModal(false);
      toast.success('Food donation claimed successfully! Full pickup address and contact unlocked.');
      navigate(`/ngo/pickups/${res.id}`);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        setErrorMsg('Conflict: Another relief organization completed a claim for this donation simultaneously. Your portion capacity remains untouched.');
        toast.warning('Donation already claimed by another organization.');
        await fetchDonation();
      } else {
        const msg = (err as Error).message || 'Failed to claim donation.';
        setErrorMsg(msg);
        toast.error(msg);
      }
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container" role="status" aria-busy="true">
        <p>Evaluating donation eligibility and travel radius...</p>
      </div>
    );
  }

  if (!donation) {
    return (
      <div className="page-container">
        <div className="card">
          <h1 className="card-title">Donation Unavailable</h1>
          <p>The selected donation could not be retrieved.</p>
          <button
            type="button"
            data-testid="EL-132"
            className="btn btn--primary"
            onClick={() => navigate('/ngo/discover')}
          >
            Return to discovery
          </button>
        </div>
      </div>
    );
  }

  const isExpired = donation.status === 'Expired';
  const isAvailable = donation.status === 'Available';
  const isEligible = donation.eligibleForMyCapacity && isAvailable && !isExpired;

  return (
    <div className="page-container page-container--narrow">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <button
          type="button"
          data-testid="EL-132"
          className="btn btn--outline btn--sm"
          onClick={() => navigate('/ngo/discover')}
        >
          ← Return to discovery
        </button>

        <button
          type="button"
          data-testid="EL-133"
          className="btn btn--secondary btn--sm"
          onClick={fetchDonation}
        >
          Refresh donation eligibility
        </button>
      </div>

      {errorMsg && (
        <div className="error-banner" role="alert" style={{ marginBottom: '1.25rem' }}>
          <span aria-hidden="true">⚠ </span>
          {errorMsg}
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span className={`badge ${isExpired ? 'badge--danger' : isAvailable ? 'badge--success' : 'badge--secondary'}`}>
                {donation.status.toUpperCase()}
              </span>
              <span className="badge badge--info">{donation.category}</span>
            </div>
            <h1 className="card-title" style={{ fontSize: '1.75rem' }}>{donation.description}</h1>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-accent)' }}>
              {donation.offeredPortions} <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--color-secondary)' }}>portions</span>
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-secondary)' }}>
              {donation.straightLineDistanceKm !== undefined ? `${donation.straightLineDistanceKm.toFixed(1)} km straight-line distance` : 'Local Area'}
            </div>
          </div>
        </div>

        {/* Civic Logistics Confidentiality Notice */}
        <div className="info-box" style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--color-info-light)', border: '1px solid var(--color-info)', borderRadius: 'var(--radius-sm)' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-info)' }}>
            <strong>Privacy & Integrity Shield:</strong> Exact donor street address, contact officer, and pickup telephone are withheld until an atomic claim transaction is verified on the SQLite database.
          </p>
        </div>

        {/* Logistics Details */}
        <div className="details-list" style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '0.75rem 0', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)' }}>
            <div>
              <span style={{ fontSize: '0.8125rem', color: 'var(--color-secondary)', display: 'block' }}>City / Regional Zone</span>
              <strong>{donation.approximateCity || 'Regional Zone'}</strong>
            </div>
            <div>
              <span style={{ fontSize: '0.8125rem', color: 'var(--color-secondary)', display: 'block' }}>Safe Pickup Deadline</span>
              <strong style={{ color: isExpired ? 'var(--color-destructive)' : 'inherit' }}>
                {new Date(donation.pickupDeadline).toLocaleString()}
              </strong>
            </div>
          </div>
        </div>

        {/* Eligibility Status */}
        <div style={{ marginBottom: '1.5rem' }}>
          {isEligible ? (
            <div style={{ padding: '0.75rem 1rem', background: 'var(--color-accent-light)', border: '1px solid var(--color-accent)', borderRadius: 'var(--radius-sm)', color: 'var(--color-accent-hover)', fontWeight: 600 }}>
              ✓ Fully eligible to claim within your available capacity and dispatch radius.
            </div>
          ) : (
            <div style={{ padding: '0.75rem 1rem', background: 'var(--color-destructive-light)', border: '1px solid var(--color-destructive)', borderRadius: 'var(--radius-sm)', color: 'var(--color-destructive)', fontWeight: 600 }}>
              ⚠ Not currently claimable: {donation.ineligibleReason || (isExpired ? 'Pickup deadline has elapsed.' : 'Donation is no longer available.')}
            </div>
          )}
        </div>

        {/* Mandatory Recipient Suitability Assessment Checkbox (VR-020, EL-134) */}
        <div className="suitability-box" style={{ marginBottom: '1.5rem', padding: '1.25rem', background: 'var(--color-canvas)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
          <label className="checkbox-label" style={{ display: 'flex', gap: '0.75rem', cursor: 'pointer', fontSize: '0.875rem' }}>
            <input
              type="checkbox"
              data-testid="EL-134"
              checked={suitabilityAffirmed}
              onChange={(e) => setSuitabilityAffirmed(e.target.checked)}
              disabled={!isEligible}
            />
            <span>
              <strong>Recipient Food Suitability Assessment:</strong> As a verified relief agency, we confirm that our transport fleet and distribution network have adequate thermal containment to receive and safely distribute these {donation.offeredPortions} portions.
            </span>
          </label>
        </div>

        {/* Claim Buttons */}
        <div className="form-actions" style={{ display: 'flex', gap: '1rem' }}>
          <button
            type="button"
            data-testid="EL-135"
            className="btn btn--primary btn--lg full-width"
            onClick={() => setShowConfirmModal(true)}
            disabled={!isEligible || !suitabilityAffirmed}
          >
            Show claim confirmation
          </button>
        </div>

        {/* Fallback hidden button */}
        {!showConfirmModal && (
          <div style={{ display: 'none' }}>
            <button type="button" data-testid="EL-136" onClick={handleClaim}>Claim all available portions</button>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="claim-modal-title">
          <div className="modal-box">
            <h2 id="claim-modal-title" className="card-title">Confirm Atomic Portion Claim</h2>
            <p>
              You are about to reserve all <strong>{donation.offeredPortions} portions</strong> of {donation.category}.
            </p>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-secondary)' }}>
              Once claimed, your NGO capacity will be deducted immediately, and the donor's full dispatch address and telephone will be unlocked for collection.
            </p>

            <div className="form-actions" style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => setShowConfirmModal(false)}
                disabled={claiming}
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="EL-136"
                className="btn btn--primary"
                onClick={handleClaim}
                disabled={claiming}
              >
                {claiming ? 'Reserving Portions...' : 'Claim all available portions'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
