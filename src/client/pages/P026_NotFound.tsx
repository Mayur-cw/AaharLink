import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';

export default function NotFoundPage() {
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
      <section className="panel" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }} aria-hidden="true">🗺️</div>
        <h1 className="heading-xl">Route Not Located (404)</h1>
        <p style={{ marginTop: '1rem', color: 'var(--color-secondary)' }}>
          The requested civic logistics resource or portal view could not be found or may have been archived.
        </p>
        <div style={{ marginTop: '2rem' }}>
          <button
            type="button"
            data-testid="EL-221"
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
