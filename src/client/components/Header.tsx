import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';

export function Header() {
  const { isAuthenticated } = useAuth();

  // In authenticated workspace, TopBar and Sidebar take over the header role
  if (isAuthenticated) {
    return null;
  }

  return (
    <header className="site-header" role="banner">
      <div className="site-header__container">
        <div className="site-header__brand">
          <Link to="/" className="brand-logo" aria-label="AaharLink Home">
            <span className="brand-symbol" aria-hidden="true">🌱</span>
            <span className="brand-title">AaharLink</span>
          </Link>
          <span className="brand-tagline">Rescue Food. Connect Communities.</span>
        </div>

        <nav className="site-nav" aria-label="Public Navigation">
          <ul className="nav-list" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', listStyle: 'none', margin: 0, padding: 0 }}>
            <li>
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `btn btn--sm ${isActive ? 'btn--secondary' : 'btn--outline'}`
                }
                style={{ borderRadius: 'var(--radius-sm)', padding: '0.35rem 0.85rem' }}
              >
                Home
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/login"
                className="btn btn--outline btn--sm"
                style={{ borderRadius: 'var(--radius-sm)', padding: '0.35rem 0.85rem' }}
              >
                Sign In
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/register"
                className="btn btn--outline btn--sm"
                style={{ borderRadius: 'var(--radius-sm)', padding: '0.35rem 0.85rem' }}
              >
                Register Org
              </NavLink>
            </li>
            <li>
              <Link
                to="/login"
                className="btn btn--primary btn--sm"
                style={{
                  borderRadius: 'var(--radius-sm)',
                  padding: '0.35rem 0.95rem',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontWeight: 600,
                }}
              >
                <span aria-hidden="true">➔</span>
                <span>Sign In</span>
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
