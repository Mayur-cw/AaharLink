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
      <div className="page-container" role="status" aria-busy="true" style={{ padding: '2rem' }}>
        <p style={{ color: 'var(--color-secondary)' }}>Loading handover details and pickup credentials...</p>
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

  const getStatusBadgeText = () => {
    if (isCompleted) return 'Completed';
    if (isReady) return 'Ready';
    if (isCancelled) return 'Cancelled';
    return 'Active';
  };

  const getReadinessStatusLabel = () => {
    if (isCompleted) return 'Verified Handover';
    if (isReady) return 'Donor Ready';
    if (isCancelled) return 'Cancelled';
    return 'Packaging';
  };

  const getDispatchStateLabel = () => {
    if (isCompleted) return 'Delivered';
    if (isReady) return 'Ready at Bay';
    return 'Not dispatched';
  };

  return (
    <div className="page-container" style={{ maxWidth: '1280px', margin: '0 auto' }}>
      {/* Top Action Buttons matching Image 3 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <button
          type="button"
          data-testid="EL-147"
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
          onClick={() => navigate('/ngo/pickups')}
        >
          <span>←</span>
          <span>Back to pickup list</span>
        </button>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            data-testid="EL-148"
            className="btn btn--secondary btn--sm"
            style={{ borderRadius: '9999px', padding: '0.4rem 1rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            onClick={fetchClaim}
          >
            <span>🔄</span>
            <span>Refresh handover status</span>
          </button>

          {!isCompleted && !isCancelled && (
            <button
              type="button"
              data-testid="EL-149"
              className="btn btn--outline btn--sm"
              style={{
                borderRadius: '9999px',
                padding: '0.4rem 1rem',
                fontWeight: 600,
                color: 'var(--color-destructive)',
                borderColor: 'var(--color-destructive)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
              onClick={() => setShowCancelDialog(true)}
            >
              <span>❌</span>
              <span>Cancel claim</span>
            </button>
          )}
        </div>
      </div>

      {/* Page Header and Stat Pills Row matching Image 3 */}
      <div className="page-top-row">
        <div className="page-title-group">
          <div className="page-title-with-badge">
            <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--color-ink)', margin: 0 }}>
              Pickup & Handover
            </h1>
            <span className="badge-operational">
              <span aria-hidden="true">✓</span> {getStatusBadgeText()}
            </span>
          </div>
          <p className="page-subtitle-text">
            Manage your claimed pickup, track donor readiness, and complete the handover.
          </p>
        </div>

        {/* Top Right Mini Stat Pills matching Image 3 */}
        <div className="stat-pills-row">
          <div className="stat-pill-card">
            <span className="stat-pill-icon" aria-hidden="true" style={{ color: '#D97706' }}>🍴</span>
            <div className="stat-pill-content">
              <span className="stat-pill-value">{claim.claimedPortions}</span>
              <span className="stat-pill-label">Portions claimed</span>
            </div>
          </div>

          <div className="stat-pill-card">
            <span className="stat-pill-icon" aria-hidden="true" style={{ color: '#D97706' }}>📦</span>
            <div className="stat-pill-content">
              <span className="stat-pill-value">{getReadinessStatusLabel()}</span>
              <span className="stat-pill-label">Readiness status</span>
            </div>
          </div>

          <div className="stat-pill-card">
            <span className="stat-pill-icon" aria-hidden="true" style={{ color: '#16A34A' }}>🚚</span>
            <div className="stat-pill-content">
              <span className="stat-pill-value" style={{ fontSize: '0.875rem' }}>{getDispatchStateLabel()}</span>
              <span className="stat-pill-label">Dispatch state</span>
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

      {/* Two-Column Responsive Workspace Grid matching Image 3 */}
      <div className="workspace-grid-2">
        {/* Left Column: Pickup Claim Details */}
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
              📦
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--color-ink)' }}>
              Pickup Claim Details
            </h2>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--color-secondary)', lineHeight: 1.5, marginBottom: '1.5rem' }}>
            Details of your food pickup from the donor organization.
          </p>

          {/* 6 Grid Fields with Inline Icons matching Image 3 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            {/* Field 1: Donor Organization */}
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-ink)', display: 'block', marginBottom: '4px' }}>
                Donor Organization *
              </span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.55rem 0.75rem',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8125rem',
                  color: 'var(--color-ink)',
                }}
              >
                <span aria-hidden="true">🏢</span>
                <span style={{ fontWeight: 600 }}>{claim.donorOrganizationName}</span>
              </div>
            </div>

            {/* Field 2: Dispatch Contact */}
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-ink)', display: 'block', marginBottom: '4px' }}>
                Dispatch Contact *
              </span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.55rem 0.75rem',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8125rem',
                  color: 'var(--color-ink)',
                }}
              >
                <span aria-hidden="true">👤</span>
                <span style={{ fontWeight: 600 }}>{claim.donorContactPerson || 'Rajesh Sharma'}</span>
              </div>
            </div>

            {/* Field 3: Telephone */}
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-ink)', display: 'block', marginBottom: '4px' }}>
                Telephone *
              </span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.55rem 0.75rem',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8125rem',
                  color: 'var(--color-ink)',
                }}
              >
                <span aria-hidden="true">📞</span>
                <a href={`tel:${claim.donorContactPhone}`} style={{ color: 'var(--color-ink)', textDecoration: 'none', fontWeight: 600 }}>
                  {claim.donorContactPhone || '+919822011111'}
                </a>
              </div>
            </div>

            {/* Field 4: Pickup Address */}
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-ink)', display: 'block', marginBottom: '4px' }}>
                Pickup Address *
              </span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.55rem 0.75rem',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8125rem',
                  color: 'var(--color-ink)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={claim.pickupAddress}
              >
                <span aria-hidden="true">📍</span>
                <span style={{ fontWeight: 600 }}>{claim.pickupAddress || 'Central Kitchen, Chhatrapati Sambhaji Nagar'}</span>
              </div>
            </div>

            {/* Field 5: Operating City */}
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-ink)', display: 'block', marginBottom: '4px' }}>
                Operating City
              </span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.55rem 0.75rem',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8125rem',
                  color: 'var(--color-ink)',
                }}
              >
                <span aria-hidden="true">📍</span>
                <span style={{ fontWeight: 600 }}>{claim.donorCity || 'Chhatrapati Sambhaji Nagar'}</span>
              </div>
            </div>

            {/* Field 6: Safe Pickup Deadline */}
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-ink)', display: 'block', marginBottom: '4px' }}>
                Safe Pickup Deadline *
              </span>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.55rem 0.75rem',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8125rem',
                  color: 'var(--color-ink)',
                }}
              >
                <span aria-hidden="true">📅</span>
                <span style={{ fontWeight: 600 }}>{new Date(claim.pickupDeadline).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
              </div>
            </div>
          </div>

          {/* Portions Claimed Highlight Callout */}
          <div
            style={{
              padding: '0.75rem 1rem',
              background: 'var(--color-accent-light)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              marginBottom: '1.25rem',
            }}
          >
            <span style={{ fontSize: '1.35rem', color: 'var(--color-accent)' }} aria-hidden="true">🍴</span>
            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-secondary)' }}>
                Portions Claimed
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-accent)' }}>
                {claim.claimedPortions} portions
              </div>
            </div>
          </div>

          {/* Readiness Status Box matching Image 3 */}
          {claim.status === 'Active' && (
            <div
              style={{
                padding: '1.25rem',
                background: '#FFFBEB',
                border: '1px solid #FDE68A',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '1rem' }}>
                <span style={{ fontSize: '1.4rem' }} aria-hidden="true">📦</span>
                <div>
                  <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '0.9375rem', fontWeight: 700, color: '#92400E' }}>
                    Awaiting Donor Readiness Confirmation
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.8125rem', color: '#78350F', lineHeight: 1.5 }}>
                    The donor is packaging and staging the portions for pickup. They will share a 6-digit verification code when ready for handover.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="btn btn--primary full-width"
                style={{
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.65rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
                onClick={fetchClaim}
              >
                <span aria-hidden="true">🔲</span>
                <span>Check readiness status</span>
              </button>
            </div>
          )}

          {/* Unlocked Physical Handover Form (when Ready) */}
          {claim.status === 'Ready' && (
            <div
              style={{
                padding: '1.25rem',
                background: 'var(--color-accent-light)',
                border: '2px solid var(--color-accent)',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '1rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '1.25rem' }} aria-hidden="true">📦</span>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-accent)' }}>
                  Physical Handover Verification (Ready)
                </h3>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-ink)', marginBottom: '1rem' }}>
                Upon arriving at the facility, verify food condition and obtain the one-time 6-digit code from the donor representative.
              </p>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label htmlFor="handover-code-input" className="form-label" style={{ fontWeight: 700, fontSize: '0.8125rem' }}>
                  6-Digit Handover Code *
                </label>
                <input
                  id="handover-code-input"
                  type="text"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  data-testid="EL-150"
                  className="form-input"
                  style={{
                    fontSize: '1.35rem',
                    fontFamily: 'monospace',
                    letterSpacing: '0.4em',
                    textAlign: 'center',
                    fontWeight: 800,
                    borderRadius: 'var(--radius-sm)',
                  }}
                  value={handoverCode}
                  onChange={(e) => setHandoverCode(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="000000"
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label htmlFor="actual-portions-input" className="form-label" style={{ fontWeight: 700, fontSize: '0.8125rem' }}>
                  Actual Portions Received *
                </label>
                <input
                  id="actual-portions-input"
                  type="number"
                  min="1"
                  data-testid="EL-151"
                  className="form-input"
                  style={{ borderRadius: 'var(--radius-sm)' }}
                  value={actualPortions}
                  onChange={(e) => setActualPortions(e.target.value)}
                  required
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.8125rem', cursor: 'pointer', marginBottom: '1rem' }}>
                <input
                  type="checkbox"
                  data-testid="EL-152"
                  checked={declarationChecked}
                  onChange={(e) => setDeclarationChecked(e.target.checked)}
                  required
                  style={{ marginTop: '2px', accentColor: 'var(--color-accent)' }}
                />
                <span>
                  <strong>Recipient Acceptance Declaration:</strong> I confirm our relief transport team has physically inspected packaging integrity, verified safe temperature condition, and accepted custody.
                </span>
              </label>

              <button
                type="button"
                data-testid="EL-153"
                className="btn btn--primary btn--lg full-width"
                style={{ borderRadius: 'var(--radius-sm)', padding: '0.75rem', fontWeight: 700 }}
                onClick={handleCollect}
                disabled={collecting || !declarationChecked || handoverCode.trim().length !== 6}
              >
                {collecting ? 'Verifying Code & Logging...' : 'Complete verified handover'}
              </button>
            </div>
          )}

          {/* Completed State Callout */}
          {isCompleted && (
            <div
              style={{
                padding: '1.25rem',
                background: 'var(--color-surface)',
                border: '1px solid #16A34A',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#16A34A', marginBottom: '0.5rem' }}>
                <span aria-hidden="true" style={{ fontSize: '1.25rem' }}>✓</span>
                <strong style={{ fontSize: '1rem' }}>Verified Food Rescue Completed</strong>
              </div>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--color-secondary)' }}>
                {claim.actualReceived || claim.claimedPortions} portions successfully rescued and recorded in the immutable audit ledger.
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Dispatch Facility & Route Map matching Image 3 */}
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
              📍
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--color-ink)' }}>
                Dispatch Facility & Route
              </h2>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-secondary)', margin: '2px 0 0 0' }}>
                Pickup location, route, and navigation to the donor's facility.
              </p>
            </div>
          </div>

          {/* Leaflet Navigation Map matching Image 3 */}
          <CivicMap
            latitude={claim.pickupLatitude || 28.6139}
            longitude={claim.pickupLongitude || 77.209}
            radiusKm={15}
            title={`Dispatch Facility (${claim.donorOrganizationName})`}
            address={claim.pickupAddress || `${claim.donorCity} facility`}
            pinLabel={claim.donorOrganizationName}
            height={320}
            showDirections={true}
          />
        </div>
      </div>

      {/* Cancel Claim Modal Dialog */}
      {showCancelDialog && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="cancel-dialog-title" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ maxWidth: '480px', width: '90%', background: 'var(--color-surface)', borderRadius: 'var(--radius-md)', padding: '1.5rem' }}>
            <h2 id="cancel-dialog-title" style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--color-destructive)' }}>
              Cancel Claim (Release Portions)
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-secondary)', marginBottom: '1rem' }}>
              Cancelling releases portions back to the available regional pool. Enter a clear operational reason:
            </p>

            <form onSubmit={handleCancelClaim}>
              <div className="form-group">
                <label htmlFor="cancel-reason-input" className="form-label">
                  Reason for Cancellation <span className="required-indicator">*</span>
                </label>
                <textarea
                  id="cancel-reason-input"
                  data-testid="EL-154"
                  className="form-input form-textarea"
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Vehicle breakdown occurred en route to donor facility"
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  data-testid="EL-156"
                  className="btn btn--outline"
                  onClick={() => setShowCancelDialog(false)}
                  disabled={cancelling}
                >
                  Keep claim
                </button>
                <button
                  type="submit"
                  data-testid="EL-155"
                  className="btn btn--destructive"
                  disabled={cancelling || cancelReason.trim().length < 10}
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
