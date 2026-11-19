import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import type { DonationCategory } from '../../shared/contracts.js';

export default function PublishDonationPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { organization } = useAuth();

  const [category, setCategory] = useState<DonationCategory>('cooked');
  const [description, setDescription] = useState('');
  const [portions, setPortions] = useState('40');
  
  // Default preparedAt to now, deadline to 4 hours from now
  const now = new Date();
  const fourHoursLater = new Date(now.getTime() + 4 * 3600 * 1000);
  
  const toLocalISO = (d: Date) => {
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().slice(0, 16);
  };

  const [preparedAt, setPreparedAt] = useState(toLocalISO(now));
  const [pickupDeadline, setPickupDeadline] = useState(toLocalISO(fourHoursLater));
  const [pickupAddress, setPickupAddress] = useState(organization?.city ? `Central Kitchen, ${organization.city}` : 'Main Campus Kitchen, 12 Civic Lane');
  const [latitude, setLatitude] = useState(organization ? '28.6139' : '28.6139');
  const [longitude, setLongitude] = useState(organization ? '77.2090' : '77.2090');

  // Food handling declarations (VR-019, VR-020)
  const [safePrep, setSafePrep] = useState(false);
  const [properStorage, setProperStorage] = useState(false);
  const [cleanPackaging, setCleanPackaging] = useState(false);
  const [accurateInfo, setAccurateInfo] = useState(false);
  const [recipientAck, setRecipientAck] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!safePrep || !properStorage || !cleanPackaging || !accurateInfo || !recipientAck) {
      setErrorMsg('All food safety handling declarations and recipient assessment acknowledgement must be confirmed.');
      return;
    }

    const portionsNum = parseInt(portions, 10);
    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);

    if (isNaN(portionsNum) || portionsNum < 1) {
      setErrorMsg('Portions offered must be a positive integer.');
      return;
    }

    if (isNaN(latNum) || isNaN(lngNum)) {
      setErrorMsg('Pickup coordinates must be valid numbers.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await api.post<{ id: string }>('/api/donor/donations', {
        category,
        description,
        offeredPortions: portionsNum,
        preparedAt: new Date(preparedAt).toISOString(),
        pickupDeadline: new Date(pickupDeadline).toISOString(),
        pickupAddress,
        pickupLatitude: latNum,
        pickupLongitude: lngNum,
        handlingDeclarations: {
          safePreparation: safePrep,
          properTemperature: properStorage,
          cleanPackaging: cleanPackaging,
          accurateInformation: accurateInfo,
          recipientAssessmentAcknowledgement: recipientAck,
        },
      });

      toast.success('Surplus food donation published successfully!');
      navigate(`/donor/donations/${res.id}`);
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to publish donation.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container page-container--narrow">
      <div style={{ marginBottom: '1.5rem' }}>
        <button
          type="button"
          data-testid="EL-070"
          className="btn btn--outline btn--sm"
          onClick={() => navigate('/donor/donations')}
        >
          ← Back to donation list
        </button>
      </div>

      <div className="card">
        <h1 className="card-title">Publish Surplus Food Donation</h1>
        <p className="card-description">
          Offer prepared meals, packed items, or produce to verified local relief NGOs. Complete all safety affirmations truthfully.
        </p>

        {errorMsg && (
          <div className="error-banner" role="alert" style={{ marginBottom: '1.25rem' }}>
            <span aria-hidden="true">⚠ </span>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="don-category" className="form-label">
              Food Category <span className="required-indicator">*</span>
            </label>
            <select
              id="don-category"
              data-testid="EL-071"
              className="form-input"
              value={category}
              onChange={(e) => setCategory(e.target.value as DonationCategory)}
            >
              <option value="cooked">Cooked Meals (Prepared Catering / Kitchen)</option>
              <option value="packed">Packaged Goods (Sealed Non-Perishable / Dry)</option>
              <option value="produce">Raw Fresh Produce (Fruits / Vegetables)</option>
              <option value="bakery">Bakery & Breads (Bread / Pastries)</option>
              <option value="other">Other Edible Food Supply</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="don-description" className="form-label">
              Food Description <span className="required-indicator">*</span>
            </label>
            <textarea
              id="don-description"
              data-testid="EL-072"
              className="form-input form-textarea"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. 40 trays of fresh vegetable biryani and lentil curry, prepared in certified hygienic kitchen"
              required
            />
            <span className="form-hint">Describe food items, ingredients, allergens, and dietary labels (4–300 characters).</span>
          </div>

          <div className="form-group">
            <label htmlFor="don-portions" className="form-label">
              Portions Offered <span className="required-indicator">*</span>
            </label>
            <input
              id="don-portions"
              type="number"
              min="1"
              max="10000"
              data-testid="EL-073"
              className="form-input"
              value={portions}
              onChange={(e) => setPortions(e.target.value)}
              required
            />
            <span className="form-hint">Total number of full individual adult meal servings.</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label htmlFor="don-prepared-at" className="form-label">
                Prepared At <span className="required-indicator">*</span>
              </label>
              <input
                id="don-prepared-at"
                type="datetime-local"
                data-testid="EL-074"
                className="form-input"
                value={preparedAt}
                onChange={(e) => setPreparedAt(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="don-deadline" className="form-label">
                Safe Pickup Deadline <span className="required-indicator">*</span>
              </label>
              <input
                id="don-deadline"
                type="datetime-local"
                data-testid="EL-075"
                className="form-input"
                value={pickupDeadline}
                onChange={(e) => setPickupDeadline(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="don-address" className="form-label">
              Pickup Address <span className="required-indicator">*</span>
            </label>
            <input
              id="don-address"
              type="text"
              data-testid="EL-076"
              className="form-input"
              value={pickupAddress}
              onChange={(e) => setPickupAddress(e.target.value)}
              placeholder="Exact street address and dispatch bay instructions"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label htmlFor="don-lat" className="form-label">
                Pickup Latitude <span className="required-indicator">*</span>
              </label>
              <input
                id="don-lat"
                type="number"
                step="0.0001"
                data-testid="EL-077"
                className="form-input"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="don-lng" className="form-label">
                Pickup Longitude <span className="required-indicator">*</span>
              </label>
              <input
                id="don-lng"
                type="number"
                step="0.0001"
                data-testid="EL-078"
                className="form-input"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Mandatory Food Safety Handling Declarations (VR-019, VR-020) */}
          <div className="declarations-panel" style={{ marginTop: '1.5rem', padding: '1.25rem', background: 'var(--color-canvas)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
            <h2 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--color-ink)' }}>
              Mandatory Food Safety Affirmations (VR-019, VR-020)
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-secondary)', marginBottom: '1rem' }}>
              All 4 handling checkboxes and the independent recipient assessment acknowledgement must be truthfully confirmed.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label className="checkbox-label" style={{ display: 'flex', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input
                  type="checkbox"
                  data-testid="EL-079"
                  checked={safePrep}
                  onChange={(e) => setSafePrep(e.target.checked)}
                  required
                />
                <span>Donor handling declaration — preparation time accurate and prepared hygienically</span>
              </label>

              <label className="checkbox-label" style={{ display: 'flex', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input
                  type="checkbox"
                  data-testid="EL-080"
                  checked={properStorage}
                  onChange={(e) => setProperStorage(e.target.checked)}
                  required
                />
                <span>Donor handling declaration — appropriate thermal storage used continuously</span>
              </label>

              <label className="checkbox-label" style={{ display: 'flex', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input
                  type="checkbox"
                  data-testid="EL-081"
                  checked={cleanPackaging}
                  onChange={(e) => setCleanPackaging(e.target.checked)}
                  required
                />
                <span>Donor handling declaration — appropriate food-grade packaging used</span>
              </label>

              <label className="checkbox-label" style={{ display: 'flex', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                <input
                  type="checkbox"
                  data-testid="EL-082"
                  checked={accurateInfo}
                  onChange={(e) => setAccurateInfo(e.target.checked)}
                  required
                />
                <span>Donor handling declaration — no known contamination or spoilage</span>
              </label>

              <label className="checkbox-label" style={{ display: 'flex', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--color-border)' }}>
                <input
                  type="checkbox"
                  data-testid="EL-083"
                  checked={recipientAck}
                  onChange={(e) => setRecipientAck(e.target.checked)}
                  required
                />
                <span><strong>Donor acknowledgement:</strong> recipient must independently assess food suitability at physical handover</span>
              </label>
            </div>
          </div>

          <div className="form-actions" style={{ marginTop: '2rem' }}>
            <button
              type="submit"
              data-testid="EL-084"
              className="btn btn--primary btn--lg full-width"
              disabled={submitting}
            >
              {submitting ? 'Publishing Listing...' : 'Publish donation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
