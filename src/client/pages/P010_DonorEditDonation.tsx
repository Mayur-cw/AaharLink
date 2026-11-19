import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api.js';
import { useToast } from '../context/ToastContext.js';
import type { DonationOwnerDetail } from '../../shared/contracts.js';

export default function DonorEditDonationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [description, setDescription] = useState('');
  const [portions, setPortions] = useState('');
  const [pickupDeadline, setPickupDeadline] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [version, setVersion] = useState('1');

  const toLocalISO = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      const offset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - offset).toISOString().slice(0, 16);
    } catch {
      return '';
    }
  };

  const fetchDonation = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await api<DonationOwnerDetail>(`/api/donor/donations/${id}`);
      if (data.status !== 'Available') {
        toast.warning('Only available, unclaimed donations can be modified.');
        navigate(`/donor/donations/${data.id}`);
        return;
      }
      setDescription(data.description);
      setPortions(String(data.offeredPortions));
      setPickupDeadline(toLocalISO(data.pickupDeadline));
      setPickupAddress(data.pickupAddress);
      setVersion(String(data.version));
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to load donation.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => {
    fetchDonation();
  }, [fetchDonation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    const portionsNum = parseInt(portions, 10);
    if (isNaN(portionsNum) || portionsNum < 1) {
      setErrorMsg('Portions must be a positive integer.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      await api.patch(`/api/donor/donations/${id}`, {
        description: description.trim() || undefined,
        offeredPortions: portionsNum,
        pickupDeadline: new Date(pickupDeadline).toISOString(),
        pickupAddress: pickupAddress.trim() || undefined,
        expectedVersion: parseInt(version, 10),
      });

      toast.success('Donation listing updated successfully.');
      navigate(`/donor/donations/${id}`);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        toast.warning('Listing version was modified; reloaded authoritative record.');
        await fetchDonation();
      } else {
        const msg = (err as Error).message || 'Failed to update donation.';
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
          data-testid="EL-094"
          className="btn btn--outline btn--sm"
          onClick={() => navigate(`/donor/donations/${id}`)}
        >
          ← Back to donation details
        </button>

        <button
          type="button"
          data-testid="EL-095"
          className="btn btn--secondary btn--sm"
          onClick={fetchDonation}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh editable donation'}
        </button>
      </div>

      <div className="card">
        <h1 className="card-title">Edit Available Listing</h1>
        <p className="card-description">
          Modify portions, deadline, or dispatch notes prior to NGO claim. Updates are protected by optimistic concurrency controls.
        </p>

        {errorMsg && (
          <div className="error-banner" role="alert" style={{ marginBottom: '1.25rem' }}>
            <span aria-hidden="true">⚠ </span>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="edit-description" className="form-label">
              Food Description <span className="required-indicator">*</span>
            </label>
            <textarea
              id="edit-description"
              data-testid="EL-096"
              className="form-input form-textarea"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-portions" className="form-label">
              Portions Offered <span className="required-indicator">*</span>
            </label>
            <input
              id="edit-portions"
              type="number"
              min="1"
              max="10000"
              data-testid="EL-097"
              className="form-input"
              value={portions}
              onChange={(e) => setPortions(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-deadline" className="form-label">
              Pickup Deadline <span className="required-indicator">*</span>
            </label>
            <input
              id="edit-deadline"
              type="datetime-local"
              data-testid="EL-098"
              className="form-input"
              value={pickupDeadline}
              onChange={(e) => setPickupDeadline(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-address" className="form-label">
              Pickup Address <span className="required-indicator">*</span>
            </label>
            <input
              id="edit-address"
              type="text"
              data-testid="EL-099"
              className="form-input"
              value={pickupAddress}
              onChange={(e) => setPickupAddress(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="edit-version" className="form-label">
              Record Version (CAS Guard)
            </label>
            <input
              id="edit-version"
              type="text"
              data-testid="EL-100"
              className="form-input"
              value={version}
              readOnly
              disabled
            />
          </div>

          <div className="form-actions" style={{ marginTop: '1.5rem' }}>
            <button
              type="submit"
              data-testid="EL-101"
              className="btn btn--primary btn--lg full-width"
              disabled={saving || loading}
            >
              {saving ? 'Saving Changes...' : 'Save available listing edits'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
