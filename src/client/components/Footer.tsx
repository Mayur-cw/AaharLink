import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';

export function Footer() {
  const { isAuthenticated, role } = useAuth();

  const homeTarget = !isAuthenticated
    ? '/'
    : role === 'donor'
    ? '/donor'
    : role === 'ngo'
    ? '/ngo'
    : role === 'coordinator'
    ? '/coordinator'
    : '/';

  return (
    <footer
      className="site-footer"
      role="contentinfo"
      style={{
        background: 'var(--color-surface)',
        borderTop: '1px solid var(--color-border)',
        padding: '3rem 1.5rem',
        marginTop: 'auto',
      }}
    >
      <div
        style={{
          maxWidth: '1240px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr 1fr',
          gap: '3rem',
          fontSize: '0.875rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.85rem' }}>
            <span style={{ fontSize: '1.4rem', color: 'var(--color-accent)' }} aria-hidden="true">🌱</span>
            <span style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--color-ink)' }}>AaharLink</span>
            <span style={{ color: 'var(--color-secondary)', fontSize: '0.8125rem' }}>· Rescue Food. Connect Communities.</span>
          </div>
          <p style={{ color: 'var(--color-secondary)', lineHeight: 1.6, margin: 0, maxWidth: '420px' }}>
            AaharLink is a civic food recovery platform. Per municipal food hygiene standards, safe preparation and transport conditions are validated by participants. Donors declare handling at publishing, and receiving NGOs verify quality and temperature at physical handover.
          </p>
        </div>

        <div>
          <h2
            style={{
              fontSize: '0.8125rem',
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--color-ink)',
              marginBottom: '1rem',
            }}
          >
            Quick Navigation
          </h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <li>
              <Link to={homeTarget} style={{ color: 'var(--color-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span aria-hidden="true">🏠</span>
                <span>Home & Mission</span>
              </Link>
            </li>
            <li>
              <Link to="/login" style={{ color: 'var(--color-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span aria-hidden="true">➔</span>
                <span>Sign In / Demo Accounts</span>
              </Link>
            </li>
            <li>
              <Link to="/register" style={{ color: 'var(--color-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span aria-hidden="true">🏛️</span>
                <span>Register Organization</span>
              </Link>
            </li>
            <li>
              <Link to="/account" style={{ color: 'var(--color-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span aria-hidden="true">🗂️</span>
                <span>Account & Capacity</span>
              </Link>
            </li>
            <li>
              <Link to="/notifications" style={{ color: 'var(--color-secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span aria-hidden="true">🔔</span>
                <span>Alerts & Notifications</span>
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h2
            style={{
              fontSize: '0.8125rem',
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--color-ink)',
              marginBottom: '1rem',
            }}
          >
            Standards & Assurance
          </h2>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '1rem', color: 'var(--color-secondary)', lineHeight: 1.5 }}>
            <span aria-hidden="true" style={{ color: 'var(--color-accent)', fontSize: '1rem' }}>🛡️</span>
            <span>Complies with WCAG 2.1 AA accessibility guidelines. Keyboard navigable, contrast checked, screen-reader announced.</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-accent)' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#22744F' }} />
            <span>Operational — Local Native Persistence</span>
          </div>
          <p style={{ color: 'var(--color-secondary)', fontSize: '0.75rem', margin: 0 }}>
            © {new Date().getFullYear()} AaharLink. Rescue Food. Connect Communities.
          </p>
        </div>
      </div>
    </footer>
  );
}
