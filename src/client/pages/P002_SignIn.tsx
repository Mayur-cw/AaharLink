import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const handleDemoSelect = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please provide both email and password.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.email}!`);
      
      const destination = (location.state as { from?: { pathname: string } })?.from?.pathname;
      if (destination && destination !== '/login' && destination !== '/') {
        const isDonorArea = destination.startsWith('/donor');
        const isNgoArea = destination.startsWith('/ngo');
        const isCoordinatorArea = destination.startsWith('/coordinator');

        if (
          (isDonorArea && user.role === 'donor') ||
          (isNgoArea && user.role === 'ngo') ||
          (isCoordinatorArea && user.role === 'coordinator') ||
          (!isDonorArea && !isNgoArea && !isCoordinatorArea)
        ) {
          navigate(destination, { replace: true });
          return;
        }
      }

      if (user.role === 'donor') navigate('/donor', { replace: true });
      else if (user.role === 'ngo') navigate('/ngo', { replace: true });
      else if (user.role === 'coordinator') navigate('/coordinator', { replace: true });
      else navigate('/', { replace: true });
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Invalid email or password.';
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
          data-testid="EL-010"
          className="btn btn--outline btn--sm"
          onClick={() => navigate('/')}
        >
          ← Back to service home
        </button>
      </div>

      <div className="card">
        <h1 className="card-title">Sign In to AaharLink</h1>
        <p className="card-description">
          Enter your registered organizational credentials or select one of the pre-configured demo personas below.
        </p>

        {errorMsg && (
          <div className="error-banner" role="alert" style={{ marginBottom: '1.25rem' }}>
            <span aria-hidden="true">⚠ </span>
            {errorMsg}
          </div>
        )}

        <div className="demo-accounts-box" style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--color-canvas)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
          <p style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.75rem' }}>
            Instant Demo Account Selection:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem' }}>
            <button
              type="button"
              data-testid="EL-013"
              className="btn btn--outline btn--sm"
              onClick={() => handleDemoSelect('donor@aaharlink.example', 'DemoDonor!2026')}
            >
              Select donor demo account
            </button>
            <button
              type="button"
              data-testid="EL-014"
              className="btn btn--outline btn--sm"
              onClick={() => handleDemoSelect('ngo-a@aaharlink.example', 'DemoNgoA!2026')}
            >
              Select NGO A demo account
            </button>
            <button
              type="button"
              data-testid="EL-015"
              className="btn btn--outline btn--sm"
              onClick={() => handleDemoSelect('ngo-b@aaharlink.example', 'DemoNgoB!2026')}
            >
              Select NGO B demo account
            </button>
            <button
              type="button"
              data-testid="EL-016"
              className="btn btn--outline btn--sm"
              onClick={() => handleDemoSelect('coordinator@aaharlink.example', 'DemoCoord!2026')}
            >
              Select coordinator demo account
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="login-email" className="form-label">
              Email Address <span className="required-indicator">*</span>
            </label>
            <input
              id="login-email"
              type="email"
              data-testid="EL-011"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. donor@demo.org"
              required
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="login-password" className="form-label">
              Password <span className="required-indicator">*</span>
            </label>
            <input
              id="login-password"
              type="password"
              data-testid="EL-012"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          <div className="form-actions" style={{ marginTop: '1.5rem' }}>
            <button
              type="submit"
              data-testid="EL-017"
              className="btn btn--primary btn--lg full-width"
              disabled={submitting}
            >
              {submitting ? 'Verifying Credentials...' : 'Sign in'}
            </button>
          </div>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem' }}>
          <span>Don't have an organization registered yet? </span>
          <button
            type="button"
            className="btn-link"
            onClick={() => navigate('/register')}
          >
            Register new organization
          </button>
        </div>
      </div>
    </div>
  );
}
