import React from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';

export function TopBar() {
  const { role, unreadCount, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const handleLogout = async () => {
    try {
      await logout();
      toast.info('Signed out successfully.');
      navigate('/');
    } catch {
      toast.error('Sign out could not complete.');
    }
  };

  const getWorkspaceTitle = () => {
    if (role === 'ngo') return 'NGO Workspace';
    if (role === 'donor') return 'Donor Workspace';
    if (role === 'coordinator') return 'Coordinator Workspace';
    return 'Workspace';
  };

  const getPageTitle = () => {
    const p = location.pathname;
    if (p.includes('/capacity')) return 'Capacity & Coverage';
    if (p.includes('/donations/new')) return 'Publish Food Donation';
    if (p.includes('/handover') || (p.includes('/pickups/') && p.split('/').length > 3)) return 'Pickup & Handover';
    if (p.includes('/discover')) return 'Discover Food';
    if (p.includes('/pickups')) return 'My Pickups';
    if (p.includes('/exceptions')) return 'Exception Center';
    if (p.includes('/donations')) return role === 'coordinator' ? 'Donations Registry' : 'Manage Donations';
    if (p.includes('/history')) return 'History';
    if (p.includes('/organizations')) return 'Organizations';
    if (p.includes('/analytics')) return 'Analytics';
    if (p.includes('/audit')) return 'Audit Trail';
    if (p.includes('/notifications')) return 'Inbox & Alerts';
    if (p.includes('/account')) return 'Account Settings';
    if (p === '/donor' || p === '/ngo' || p === '/coordinator') return 'Mission Control';
    return 'Overview';
  };

  const workspaceRoot = role === 'donor' ? '/donor' : role === 'ngo' ? '/ngo' : '/coordinator';

  return (
    <header className="app-topbar" role="banner">
      <nav aria-label="Breadcrumb" className="app-breadcrumbs">
        <Link to={workspaceRoot} aria-label="Workspace Home" style={{ fontSize: '1rem', lineHeight: 1 }}>
          🏠
        </Link>
        <span aria-hidden="true" style={{ opacity: 0.6 }}>›</span>
        <Link to={workspaceRoot}>{getWorkspaceTitle()}</Link>
        <span aria-hidden="true" style={{ opacity: 0.6 }}>/</span>
        <span className="app-breadcrumbs-current">{getPageTitle()}</span>
      </nav>

      <div className="app-topbar-actions">
        <Link
          to="/notifications"
          className="topbar-icon-btn"
          aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notification inbox'}
          title="Notifications"
        >
          <span style={{ fontSize: '1.1rem' }} aria-hidden="true">🔔</span>
          {unreadCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                background: '#DC2626',
                color: '#ffffff',
                fontSize: '0.6875rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #ffffff',
              }}
            >
              {unreadCount}
            </span>
          )}
        </Link>

        <button
          type="button"
          className="topbar-signout-btn"
          onClick={handleLogout}
          aria-label="Sign out of workspace"
        >
          <span style={{ fontSize: '1rem' }} aria-hidden="true">➔</span>
          <span>Sign Out</span>
        </button>
      </div>
    </header>
  );
}
