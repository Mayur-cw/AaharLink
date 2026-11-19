import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';

export default function ForbiddenPage() {
  const navigate = useNavigate();
  const { role, isAuthenticated } = useAuth();

  const handleReturn = () => {
    if (!isAuthenticated) {
      navigate('/');
    } else if (role === 'donor') {
      navigate('/donor');
    } else if (role === 'ngo') {
      navigate('/ngo');
    } else if (role === 'coordinator') {
      navigate('/coordinator');
    } else {
      navigate('/');
    }
  };

  return (
    <div className="page-container page-container--narrow">
      <section className="panel panel--danger" role="alert" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }} aria-hidden="true">🚫</div>
        <h1 className="heading-xl" style={{ color: 'var(--color-destructive)' }}>Access Restricted (403)</h1>
        <p style={{ marginTop: '1rem', color: 'var(--color-secondary)' }}>
          You do not possess the required permissions or organizational role to access this operational area.
        </p>
        <div style={{ marginTop: '2rem' }}>
          <button
            type="button"
            data-testid="EL-220"
            className="btn btn--primary"
            onClick={handleReturn}
          >
            Back to service start
          </button>
        </div>
      </section>
    </div>
  );
}
