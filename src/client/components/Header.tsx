import React, { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';

export function Header() {
  const { user, organization, role, isAuthenticated, unreadCount, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();

  const handleLogout = async () => {
    try {
      await logout();
      toast.info('You have signed out successfully.');
      navigate('/');
    } catch {
      toast.error('Sign out could not complete.');
    }
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `nav-link ${isActive ? 'nav-link--active' : ''}`;

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

        <button
          type="button"
          className="mobile-nav-toggle"
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          <span className="hamburger" aria-hidden="true">
            {mobileMenuOpen ? '✕' : '☰'}
          </span>
        </button>

        <nav
          className={`site-nav ${mobileMenuOpen ? 'site-nav--open' : ''}`}
          aria-label="Main Navigation"
        >
          <ul className="nav-list">
            <li>
              <NavLink to="/" className={navClass} onClick={() => setMobileMenuOpen(false)}>
                Home
              </NavLink>
            </li>

            {role === 'donor' && (
              <>
                <li>
                  <NavLink to="/donor" end className={navClass} onClick={() => setMobileMenuOpen(false)}>
                    Donor Overview
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/donor/donations" end className={navClass} onClick={() => setMobileMenuOpen(false)}>
                    My Donations
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/donor/donations/new" className={navClass} onClick={() => setMobileMenuOpen(false)}>
                    Publish
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/donor/history" className={navClass} onClick={() => setMobileMenuOpen(false)}>
                    History
                  </NavLink>
                </li>
              </>
            )}

            {role === 'ngo' && (
              <>
                <li>
                  <NavLink to="/ngo" end className={navClass} onClick={() => setMobileMenuOpen(false)}>
                    Mission Control
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/ngo/discover" className={navClass} onClick={() => setMobileMenuOpen(false)}>
                    Discover Food
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/ngo/pickups" className={navClass} onClick={() => setMobileMenuOpen(false)}>
                    My Pickups
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/ngo/capacity" className={navClass} onClick={() => setMobileMenuOpen(false)}>
                    Capacity
                  </NavLink>
                </li>
              </>
            )}

            {role === 'coordinator' && (
              <>
                <li>
                  <NavLink to="/coordinator" end className={navClass} onClick={() => setMobileMenuOpen(false)}>
                    Coordinator
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/coordinator/organizations" className={navClass} onClick={() => setMobileMenuOpen(false)}>
                    Verifications
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/coordinator/donations" className={navClass} onClick={() => setMobileMenuOpen(false)}>
                    Donations
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/coordinator/analytics" className={navClass} onClick={() => setMobileMenuOpen(false)}>
                    Analytics
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/coordinator/audit" className={navClass} onClick={() => setMobileMenuOpen(false)}>
                    Audit Trail
                  </NavLink>
                </li>
              </>
            )}

            {isAuthenticated ? (
              <>
                <li>
                  <NavLink to="/notifications" className={navClass} onClick={() => setMobileMenuOpen(false)}>
                    <span>Inbox</span>
                    {unreadCount > 0 && (
                      <span className="badge badge--unread" aria-label={`${unreadCount} unread notifications`}>
                        {unreadCount}
                      </span>
                    )}
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/account" className={navClass} onClick={() => setMobileMenuOpen(false)}>
                    Account
                  </NavLink>
                </li>
              </>
            ) : (
              <>
                <li>
                  <NavLink to="/login" className={navClass} onClick={() => setMobileMenuOpen(false)}>
                    Sign In
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/register" className={navClass} onClick={() => setMobileMenuOpen(false)}>
                    Register Org
                  </NavLink>
                </li>
              </>
            )}
          </ul>

          <div className="nav-user-actions">
            {isAuthenticated && user ? (
              <div className="user-profile-summary">
                <span className="user-badge" title={`${user.email} (${user.role})`}>
                  <span className="role-tag role-tag--{user.role}">{user.role.toUpperCase()}</span>
                  <span className="org-name-text">
                    {organization?.name || user.email.split('@')[0]}
                  </span>
                </span>
                <button
                  type="button"
                  className="btn btn--outline btn--sm"
                  onClick={handleLogout}
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <Link to="/login" className="btn btn--primary btn--sm" onClick={() => setMobileMenuOpen(false)}>
                Sign In
              </Link>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
