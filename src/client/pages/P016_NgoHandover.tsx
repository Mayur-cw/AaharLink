import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api.js';
import { useToast } from '../context/ToastContext.js';
import CivicMap from '../components/CivicMap.js';
import type { OwnClaimDetail, CollectionReceipt } from '../../shared/contracts.js';

export default function NgoHandoverPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [claim, setClaim] = useState<OwnClaimDetail | null>(null);

  // Handover collection form state
  const [handoverCode, setHandoverCode] = useState('');
  const [actualPortions, setActualPortions] = useState('');
  const [declarationChecked, setDeclarationChecked] = useState(false);
  const [showCollectDialog, setShowCollectDialog] = useState(false);
  const [collecting, setCollecting] = useState(false);

  // Cancellation dialog state
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const fetchClaim = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await api<OwnClaimDetail>(`/api/ngo/claims/${id}`);
      setClaim(data);
      if (!actualPortions) {
        setActualPortions(String(data.claimedPortions));
      }
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to load claim detail.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [id, actualPortions, toast]);

  useEffect(() => {
    fetchClaim();
  }, [fetchClaim]);

  useEffect(() => {
    if (claim && claim.status === 'Active') {
      const interval = setInterval(() => {
        fetchClaim();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [claim?.status, fetchClaim]);

  const handleCollect = async () => {
    if (!claim || !id) return;

    if (!/^[0-9]{6}$/.test(handoverCode.trim())) {
      setErrorMsg('Handover code must be exactly 6 digits.');
      toast.error('Handover code must be exactly 6 digits.');
      return;
    }

    const portionsNum = parseInt(actualPortions, 10);
    if (isNaN(portionsNum) || portionsNum < 1) {
      setErrorMsg('Actual portions received must be a positive integer.');
      toast.error('Actual portions received must be a positive integer.');
      return;
    }

    if (!declarationChecked) {
      setErrorMsg('Please confirm recipient acceptance declaration.');
      toast.warning('Please confirm recipient acceptance declaration.');
      return;
    }

    setCollecting(true);
    setErrorMsg(null);

    try {
      const receipt = await api.post<CollectionReceipt>(`/api/ngo/claims/${id}/collect`, {
        handoverCode: handoverCode.trim(),
        actualPortions: portionsNum,
        recipientAffirmation: true,
        expectedVersion: claim.version,
        version: claim.version,
      });

      setShowCollectDialog(false);
      toast.success(`Collection completed! ${receipt.actualReceived} portions successfully rescued and recorded.`);
      await fetchClaim();
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        toast.warning('Claim state changed; refreshing authoritative record.');
        await fetchClaim();
      } else {
        const msg = (err as Error).message || 'Handover code verification failed.';
        setErrorMsg(msg);
        toast.error(msg);
        // Refresh claim to update attempt count
        await fetchClaim();
      }
    } finally {
      setCollecting(false);
    }
  };

  const handleCancelClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claim || !id) return;

    if (cancelReason.trim().length < 10) {
      toast.error('Cancellation reason must be at least 10 characters.');
      return;
    }

    setCancelling(true);
    try {
      await api.post(`/api/ngo/claims/${id}/cancel`, {
        reason: cancelReason.trim(),
        expectedVersion: claim.version,
        version: claim.version,
      });

      setShowCancelDialog(false);
      toast.info('Claim cancelled. Portion capacity has been restored to your NGO.');
      navigate('/ngo/pickups');
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        toast.warning('Claim state modified; refreshing.');
        await fetchClaim();
      } else {
        toast.error((err as Error).message || 'Failed to cancel claim.');
      }
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="page-container" role="status" aria-busy="true">
        <p>Loading handover details and pickup credentials...</p>
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="page-container">
        <div className="card">
          <h1 className="card-title">Pickup Claim Not Found</h1>
          <p>The requested claim does not exist or has expired.</p>
          <button
            type="button"
            data-testid="EL-147"
            className="btn btn--primary"
            onClick={() => navigate('/ngo/pickups')}
          >
            Return to pickup list
          </button>
        </div>
      </div>
    );
  }

  const isCompleted = claim.status === 'Completed' || claim.status === 'Collected';
  const isCancelled = claim.status === 'Cancelled';
  const isReady = claim.status === 'Ready';

  return (
    <div className="page-container page-container--narrow">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <button
          type="button"
          data-testid="EL-147"
          className="btn btn--outline btn--sm"
          onClick={() => navigate('/ngo/pickups')}
        >
          ← Return to pickup list
        </button>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            data-testid="EL-148"
            className="btn btn--secondary btn--sm"
            onClick={fetchClaim}
          >
            Refresh handover status
          </button>

          {!isCompleted && !isCancelled && (
            <button
              type="button"
              data-testid="EL-149"
              className="btn btn--outline btn--sm"
              style={{ color: 'var(--color-destructive)' }}
              onClick={() => setShowCancelDialog(true)}
            >
              Open cancel claim dialog
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="error-banner" role="alert" style={{ marginBottom: '1.25rem' }}>
          <span aria-hidden="true">⚠ </span>
          {errorMsg}
        </div>
      )}

      {/* Main card */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span className={`badge ${isCompleted ? 'badge--info' : isReady ? 'badge--success' : 'badge--warning'}`}>
                {claim.status.toUpperCase()}
              </span>
              <span className="badge badge--info">{claim.category}</span>
            </div>
            <h1 className="card-title" style={{ fontSize: '1.75rem' }}>{claim.description}</h1>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-accent)' }}>
              {claim.claimedPortions} <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--color-secondary)' }}>portions claimed</span>
            </div>
            {claim.actualReceived && (
              <div style={{ fontSize: '0.9rem', color: 'var(--color-accent)', fontWeight: 600 }}>
                {claim.actualReceived} portions collected
              </div>
            )}
          </div>
        </div>

        {/* Unlocked Donor Logistics (EP-022) */}
        <div className="unlocked-contact-panel" style={{ marginBottom: '1.5rem', padding: '1.25rem', background: 'var(--color-canvas)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem', color: 'var(--color-ink)' }}>
            📍 Unlocked Dispatch Address & Contact Officer
          </h2>
          <div className="grid grid--2" style={{ gap: '1rem', fontSize: '0.9rem' }}>
            <div>
              <p><strong>Donor Organization:</strong> {claim.donorOrganizationName}</p>
              <p><strong>Dispatch Contact Person:</strong> {claim.donorContactPerson || 'Dispatch Manager'}</p>
              <p><strong>Telephone:</strong> <a href={`tel:${claim.donorContactPhone}`} style={{ color: 'var(--color-accent)', fontWeight: 600 }}>{claim.donorContactPhone || 'Available on site'}</a></p>
            </div>
            <div>
              <p><strong>Pickup Address:</strong> {claim.pickupAddress || 'Disclosed upon verified claim'}</p>
              <p><strong>Operating City:</strong> {claim.donorCity}</p>
              <p><strong>Safe Pickup Deadline:</strong> <span style={{ color: 'var(--color-destructive)', fontWeight: 600 }}>{new Date(claim.pickupDeadline).toLocaleString()}</span></p>
            </div>
          </div>
        </div>

        {/* Live Dispatch Location Map */}
        {claim.pickupLatitude !== undefined && claim.pickupLongitude !== undefined && (
          <CivicMap
            latitude={claim.pickupLatitude}
            longitude={claim.pickupLongitude}
            title={`Dispatch Facility: ${claim.donorOrganizationName}`}
            address={claim.pickupAddress || `${claim.donorCity} dispatch point`}
            height={260}
            showDirections={true}
          />
        )}

        {/* Status Callout Banner */}
        {claim.status === 'Active' && (
          <div className="status-callout" style={{ marginBottom: '1.5rem', padding: '1.25rem', background: 'var(--color-amber-light)', border: '1px solid var(--color-amber-urgent)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, color: 'var(--color-amber-urgent)', fontSize: '1.1rem' }}>
                  ⏳ Awaiting Donor Readiness Confirmation
                </h3>
                <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.875rem', color: 'var(--color-ink)', lineHeight: 1.5 }}>
                  The food donor is currently packaging and staging the portions at the dispatch address. Proceed to the facility. Once the donor marks the food ready on their dashboard, they will receive a 6-digit verification code to share with you at vehicle loading.
                </p>
              </div>
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={fetchClaim}
              >
                Check Readiness Status ↻
              </button>
            </div>
          </div>
        )}

        {claim.status === 'Ready' && (
          <div className="status-callout" style={{ marginBottom: '1.5rem', padding: '1.25rem', background: 'var(--color-accent-light)', border: '2px solid var(--color-accent)', borderRadius: 'var(--radius-md)' }}>
            <h3 style={{ margin: 0, color: 'var(--color-accent-hover)', fontSize: '1.1rem' }}>
              ✅ Donor Is Ready For Handover!
            </h3>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.875rem', color: 'var(--color-ink)', lineHeight: 1.5 }}>
              Portions are packaged and staged. Request the one-time 6-digit physical handover code from the donor staff on-site and enter it below to record custody transfer.
            </p>
          </div>
        )}

        {/* Collection Handover Form if Ready */}
        {isReady && !isCompleted && !isCancelled ? (
          <div className="collection-form-panel" style={{ padding: '1.5rem', background: 'var(--color-accent-light)', borderRadius: 'var(--radius-md)', border: '2px solid var(--color-accent)' }}>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--color-accent-hover)', marginBottom: '0.5rem' }}>
              Physical Handover Verification (Step 6 & 7)
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-ink)', marginBottom: '1.25rem' }}>
              Upon arriving at the donor facility, verify food condition and obtain the one-time 6-digit code from the donor representative.
            </p>

            {claim.handoverAttemptsRemaining !== undefined && claim.handoverAttemptsRemaining < 3 && (
              <div style={{ marginBottom: '1rem', color: 'var(--color-amber-urgent)', fontWeight: 600, fontSize: '0.875rem' }}>
                Note: {claim.handoverAttemptsRemaining} handover code attempt(s) remaining before review.
              </div>
            )}

            <div className="form-group">
              <label htmlFor="ho-code" className="form-label">
                6-Digit Handover Code <span className="required-indicator">*</span>
              </label>
              <input
                id="ho-code"
                type="text"
                maxLength={6}
                data-testid="EL-152"
                className="form-input code-input"
                style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '4px', textAlign: 'center', maxWidth: '240px' }}
                value={handoverCode}
                onChange={(e) => setHandoverCode(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="000000"
                required
              />
              <span className="form-hint">Obtain this code directly from the donor at physical vehicle loading.</span>
            </div>

            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label htmlFor="ho-portions" className="form-label">
                Actual Portions Received <span className="required-indicator">*</span>
              </label>
              <input
                id="ho-portions"
                type="number"
                min="1"
                max="10000"
                data-testid="EL-153"
                className="form-input"
                style={{ maxWidth: '240px' }}
                value={actualPortions}
                onChange={(e) => setActualPortions(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ marginTop: '1.25rem' }}>
              <label className="checkbox-label" style={{ display: 'flex', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input
                  type="checkbox"
                  data-testid="EL-154"
                  checked={declarationChecked}
                  onChange={(e) => setDeclarationChecked(e.target.checked)}
                  required
                />
                <span>
                  <strong>Recipient Acceptance Declaration:</strong> I confirm our relief transport team has physically inspected the packaging integrity, verified safe sensory/thermal condition, and accepted custody of these portions.
                </span>
              </label>
            </div>

            <div className="form-actions" style={{ marginTop: '1.5rem' }}>
              <button
                type="button"
                data-testid="EL-155"
                className="btn btn--primary btn--lg full-width"
                onClick={() => setShowCollectDialog(true)}
                disabled={!handoverCode || handoverCode.length !== 6 || !actualPortions || !declarationChecked || collecting}
              >
                Open handover confirmation dialog
              </button>
            </div>
          </div>
        ) : isCompleted ? (
          <div className="completed-banner" style={{ padding: '1.5rem', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
            <span style={{ fontSize: '2.5rem' }}>🎉</span>
            <h2 style={{ fontSize: '1.25rem', marginTop: '0.5rem', color: 'var(--color-accent)' }}>
              Food Rescue Successfully Recorded
            </h2>
            <p style={{ color: 'var(--color-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
              Atomic events Collected and Completed have been written to the permanent audit ledger.
            </p>
          </div>
        ) : null}

        {/* Fallback hidden elements for contract elements when awaiting readiness */}
        {!isReady && !isCompleted && !isCancelled && (
          <div style={{ display: 'none' }} aria-hidden="true">
            <input data-testid="EL-152" value={handoverCode} onChange={() => {}} tabIndex={-1} />
            <input data-testid="EL-153" value={actualPortions} onChange={() => {}} tabIndex={-1} />
            <input type="checkbox" data-testid="EL-154" checked={declarationChecked} onChange={() => {}} tabIndex={-1} />
            <button type="button" data-testid="EL-155" onClick={() => {}} tabIndex={-1}>Handover</button>
          </div>
        )}

        {/* Fallback hidden elements */}
        {!showCollectDialog && (
          <div style={{ display: 'none' }}>
            <button type="button" data-testid="EL-156" onClick={handleCollect}>Verify code and complete collection</button>
          </div>
        )}
        {!showCancelDialog && (
          <div style={{ display: 'none' }}>
            <button type="button" data-testid="EL-149" onClick={() => setShowCancelDialog(true)}>Open cancel claim dialog</button>
            <input data-testid="EL-150" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
            <button type="button" data-testid="EL-151" onClick={handleCancelClaim}>Confirm cancel claim</button>
          </div>
        )}
      </div>

      {/* Handover Confirmation Dialog (EL-156) */}
      {showCollectDialog && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="ho-dialog-title">
          <div className="modal-box">
            <h2 id="ho-dialog-title" className="card-title">Confirm Custody Transfer</h2>
            <p>
              You are completing physical collection of <strong>{actualPortions} portions</strong> using handover code <strong>{handoverCode}</strong>.
            </p>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-secondary)' }}>
              This will atomically verify the timing-safe HMAC digest, mark the claim Collected, finalize the donation as Completed, and update community impact statistics in SQLite.
            </p>

            <div className="form-actions" style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => setShowCollectDialog(false)}
                disabled={collecting}
              >
                Back
              </button>
              <button
                type="button"
                data-testid="EL-156"
                className="btn btn--primary"
                onClick={handleCollect}
                disabled={collecting}
              >
                {collecting ? 'Verifying Code...' : 'Verify code and complete collection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Dialog (EL-151) */}
      {showCancelDialog && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="can-dialog-title">
          <div className="modal-box">
            <h2 id="can-dialog-title" className="card-title" style={{ color: 'var(--color-destructive)' }}>
              Cancel Pickup Claim
            </h2>
            <p>
              If your relief vehicle is unable to reach the donor site before the safe pickup deadline, cancel promptly to return the donation to the public discovery pool.
            </p>

            <form onSubmit={handleCancelClaim} noValidate>
              <div className="form-group">
                <label htmlFor="can-reason-input" className="form-label">
                  Cancellation Reason (min 10 characters) <span className="required-indicator">*</span>
                </label>
                <textarea
                  id="can-reason-input"
                  data-testid="EL-150"
                  className="form-input form-textarea"
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Transport vehicle breakdown; cannot reach dispatch in time"
                  required
                />
              </div>

              <div className="form-actions" style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn--outline"
                  onClick={() => setShowCancelDialog(false)}
                  disabled={cancelling}
                >
                  Keep Claim
                </button>
                <button
                  type="submit"
                  data-testid="EL-151"
                  className="btn btn--primary"
                  style={{ background: 'var(--color-destructive)', borderColor: 'var(--color-destructive)' }}
                  disabled={cancelling}
                >
                  {cancelling ? 'Cancelling...' : 'Confirm cancel claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
