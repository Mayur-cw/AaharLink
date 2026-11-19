import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import type { OwnAccountProfile } from '../../shared/contracts.js';

export default function AccountPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user: authUser, logout, refreshSession } = useAuth();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<OwnAccountProfile | null>(null);

  // Profile Form state
  const [displayName, setDisplayName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [city, setCity] = useState('');
  const [coords, setCoords] = useState('');
  const [version, setVersion] = useState('1');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password Form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setProfileError(null);
    try {
      const data = await api<OwnAccountProfile>('/api/account');
      setProfile(data);
      if (data.organization) {
        setDisplayName(data.organization.name || '');
        setContactPerson(data.organization.contactPerson || '');
        setContactPhone(data.organization.contactPhone || '');
        setCity(data.organization.city || '');
        setCoords(`${data.organization.latitude}, ${data.organization.longitude}`);
        setVersion(String(data.organization.version));
      }
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to load account profile.';
      setProfileError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError(null);

    let lat: number | undefined;
    let lng: number | undefined;

    if (coords.trim()) {
      const parts = coords.split(',').map((s) => parseFloat(s.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        lat = parts[0];
        lng = parts[1];
      } else {
        setProfileError('Coordinates must be entered in format: latitude, longitude');
        setProfileSaving(false);
        return;
      }
    }

    try {
      const updated = await api.patch<OwnAccountProfile>('/api/account', {
        organizationName: displayName || undefined,
        contactPerson: contactPerson || undefined,
        contactPhone: contactPhone || undefined,
        city: city || undefined,
        latitude: lat,
        longitude: lng,
        version: parseInt(version, 10),
      });

      setProfile(updated);
      if (updated.organization) {
        setVersion(String(updated.organization.version));
      }
      await refreshSession();
      toast.success('Organization profile updated successfully.');
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        toast.warning('Record was modified elsewhere. Re-fetching authoritative data.');
        await fetchProfile();
      } else {
        const msg = (err as Error).message || 'Failed to update profile.';
        setProfileError(msg);
        toast.error(msg);
      }
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      setPasswordError('Please fill in both current and new passwords.');
      return;
    }
    if (newPassword.length < 12) {
      setPasswordError('Use a password of at least 12 characters.');
      return;
    }

    setPasswordSaving(true);
    setPasswordError(null);

    try {
      await api.post('/api/account/password', {
        currentPassword,
        newPassword,
      });

      setCurrentPassword('');
      setNewPassword('');
      await refreshSession();
      toast.success('Security credentials updated successfully.');
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Password change failed.';
      setPasswordError(msg);
      toast.error(msg);
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.info('Signed out successfully.');
      navigate('/');
    } catch {
      toast.error('Logout failed.');
    }
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <button
          type="button"
          data-testid="EL-030"
          className="btn btn--outline btn--sm"
          onClick={() => navigate('/')}
        >
          ← Back to service home
        </button>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            data-testid="EL-031"
            className="btn btn--secondary btn--sm"
            onClick={fetchProfile}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Reload account and verification'}
          </button>

          <button
            type="button"
            data-testid="EL-042"
            className="btn btn--outline btn--sm"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </div>

      <div className="grid grid--2">
        {/* Organization Profile Column */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
            <h1 className="card-title">My Organization Profile</h1>
            {profile?.organization && (
              <span className={`badge ${profile.organization.status === 'verified' ? 'badge--success' : profile.organization.status === 'rejected' ? 'badge--danger' : 'badge--warning'}`}>
                {profile.organization.status.toUpperCase()}
              </span>
            )}
          </div>

          <p className="card-description">
            Maintain your verified organization identity, location coordinates, and dispatch telephone numbers.
          </p>

          {profileError && (
            <div className="error-banner" role="alert" style={{ marginBottom: '1rem' }}>
              <span aria-hidden="true">⚠ </span>
              {profileError}
            </div>
          )}

          <form onSubmit={handleSaveProfile} noValidate>
            <div className="form-group">
              <label htmlFor="acc-org-name" className="form-label">
                Organization Display Name
              </label>
              <input
                id="acc-org-name"
                type="text"
                data-testid="EL-032"
                className="form-input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="acc-contact-person" className="form-label">
                Contact Person
              </label>
              <input
                id="acc-contact-person"
                type="text"
                data-testid="EL-033"
                className="form-input"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="acc-contact-phone" className="form-label">
                Contact Phone
              </label>
              <input
                id="acc-contact-phone"
                type="tel"
                data-testid="EL-034"
                className="form-input"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="acc-city" className="form-label">
                City
              </label>
              <input
                id="acc-city"
                type="text"
                data-testid="EL-035"
                className="form-input"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="acc-coords" className="form-label">
                Location Coordinates (lat, lon)
              </label>
              <input
                id="acc-coords"
                type="text"
                data-testid="EL-036"
                className="form-input"
                value={coords}
                onChange={(e) => setCoords(e.target.value)}
                placeholder="28.6139, 77.2090"
              />
            </div>

            <div className="form-group">
              <label htmlFor="acc-version" className="form-label">
                Record Version (Optimistic CAS Lock)
              </label>
              <input
                id="acc-version"
                type="text"
                data-testid="EL-037"
                className="form-input"
                value={version}
                readOnly
                disabled
              />
            </div>

            <div className="form-actions" style={{ marginTop: '1.5rem' }}>
              <button
                type="submit"
                data-testid="EL-038"
                className="btn btn--primary full-width"
                disabled={profileSaving || loading}
              >
                {profileSaving ? 'Saving Updates...' : 'Save organization profile'}
              </button>
            </div>
          </form>
        </div>

        {/* Security & Password Column */}
        <div className="card">
          <h2 className="card-title">Security & Credentials</h2>
          <p className="card-description">
            Update account password. Active session tokens are invalidated and replaced upon password rotation.
          </p>

          <div style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--color-canvas)', borderRadius: 'var(--radius-sm)' }}>
            <p><strong>Account Email:</strong> {profile?.user.email || authUser?.email}</p>
            <p><strong>Assigned Role:</strong> {profile?.user.role || authUser?.role}</p>
          </div>

          {passwordError && (
            <div className="error-banner" role="alert" style={{ marginBottom: '1rem' }}>
              <span aria-hidden="true">⚠ </span>
              {passwordError}
            </div>
          )}

          <form onSubmit={handleChangePassword} noValidate>
            <div className="form-group">
              <label htmlFor="acc-current-password" className="form-label">
                Current Password
              </label>
              <input
                id="acc-current-password"
                type="password"
                data-testid="EL-039"
                className="form-input"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••••••"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="acc-new-password" className="form-label">
                New Password (minimum 12 characters)
              </label>
              <input
                id="acc-new-password"
                type="password"
                data-testid="EL-040"
                className="form-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••••••"
                required
              />
            </div>

            <div className="form-actions" style={{ marginTop: '1.5rem' }}>
              <button
                type="submit"
                data-testid="EL-041"
                className="btn btn--outline full-width"
                disabled={passwordSaving}
              >
                {passwordSaving ? 'Updating Password...' : 'Change password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
