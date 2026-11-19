import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';

export default function RegisterPage() {
  const [organizationKind, setOrganizationKind] = useState<'donor' | 'ngo'>('donor');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [city, setCity] = useState('');
  const [latitude, setLatitude] = useState('28.6139');
  const [longitude, setLongitude] = useState('77.2090');
  const [consent, setConsent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!consent) {
      setErrorMsg('Please give consent to store your organization and contact details.');
      return;
    }

    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);

    if (isNaN(latNum) || isNaN(lngNum)) {
      setErrorMsg('Operating coordinates must be valid numbers.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      await register({
        organizationKind,
        email,
        password,
        organizationName,
        contactPerson,
        contactPhone,
        city,
        latitude: latNum,
        longitude: lngNum,
        consent: true,
      });

      toast.success('Organization application registered! Your application is pending coordinator verification. Please sign in.');
      navigate('/login');
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to submit application.';
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
          data-testid="EL-018"
          className="btn btn--outline btn--sm"
          onClick={() => navigate('/login')}
        >
          ← Return to sign in
        </button>
      </div>

      <div className="card">
        <h1 className="card-title">Register an Organization</h1>
        <p className="card-description">
          Create an official food donor or verified relief NGO account. All organizations are reviewed prior to critical surplus operations.
        </p>

        {errorMsg && (
          <div className="error-banner" role="alert" style={{ marginBottom: '1.25rem' }}>
            <span aria-hidden="true">⚠ </span>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="reg-org-kind" className="form-label">
              Organization Type <span className="required-indicator">*</span>
            </label>
            <select
              id="reg-org-kind"
              data-testid="EL-019"
              className="form-input"
              value={organizationKind}
              onChange={(e) => setOrganizationKind(e.target.value as 'donor' | 'ngo')}
            >
              <option value="donor">Food Donor (Restaurant, Caterer, Venue)</option>
              <option value="ngo">Relief Agency / NGO / Food Bank</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="reg-email" className="form-label">
              Email Address <span className="required-indicator">*</span>
            </label>
            <input
              id="reg-email"
              type="email"
              data-testid="EL-020"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. liaison@organization.org"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="reg-password" className="form-label">
              Password (min 12 characters) <span className="required-indicator">*</span>
            </label>
            <input
              id="reg-password"
              type="password"
              data-testid="EL-021"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="reg-org-name" className="form-label">
              Organization Name <span className="required-indicator">*</span>
            </label>
            <input
              id="reg-org-name"
              type="text"
              data-testid="EL-023"
              className="form-input"
              value={organizationName}
              onChange={(e) => setOrganizationName(e.target.value)}
              placeholder="e.g. City Relief Kitchen"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="reg-contact-person" className="form-label">
              Contact Person <span className="required-indicator">*</span>
            </label>
            <input
              id="reg-contact-person"
              type="text"
              data-testid="EL-022"
              className="form-input"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="Full name of representative"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="reg-contact-phone" className="form-label">
              Pickup/Contact Phone (E.164 or 8-15 digits) <span className="required-indicator">*</span>
            </label>
            <input
              id="reg-contact-phone"
              type="tel"
              data-testid="EL-025"
              className="form-input"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="+919876543210"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="reg-city" className="form-label">
              Public Operating City <span className="required-indicator">*</span>
            </label>
            <input
              id="reg-city"
              type="text"
              data-testid="EL-024"
              className="form-input"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. New Delhi"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label htmlFor="reg-lat" className="form-label">
                Operating Latitude <span className="required-indicator">*</span>
              </label>
              <input
                id="reg-lat"
                type="number"
                step="0.0001"
                data-testid="EL-026"
                className="form-input"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="reg-lng" className="form-label">
                Operating Longitude <span className="required-indicator">*</span>
              </label>
              <input
                id="reg-lng"
                type="number"
                step="0.0001"
                data-testid="EL-027"
                className="form-input"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '1rem' }}>
            <label className="checkbox-label" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                data-testid="EL-028"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                style={{ marginTop: '0.25rem' }}
                required
              />
              <span style={{ fontSize: '0.875rem' }}>
                I consent to store organization and contact details for civic food rescue operations.
              </span>
            </label>
          </div>

          <div className="form-actions" style={{ marginTop: '1.5rem' }}>
            <button
              type="submit"
              data-testid="EL-029"
              className="btn btn--primary btn--lg full-width"
              disabled={submitting}
            >
              {submitting ? 'Registering Application...' : 'Submit organization application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
