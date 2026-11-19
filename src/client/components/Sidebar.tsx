import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';

export function Sidebar() {
  const { user, organization, role, unreadCount } = useAuth();

  const getRoleBadge = () => {
    if (role === 'ngo') return 'NGO';
    if (role === 'donor') return 'DONOR';
    if (role === 'coordinator') return 'COORDINATOR';
    return 'USER';
  };

  const getWorkspaceRoot = () => {
    if (role === 'donor') return '/donor';
    if (role === 'ngo') return '/ngo';
    if (role === 'coordinator') return '/coordinator';
    return '/';
  };

  return (
    <aside className="app-sidebar" aria-label="Sidebar Navigation">
      <div className="app-sidebar-top">
        <Link to={getWorkspaceRoot()} className="app-sidebar-brand" aria-label="AaharLink Home">
          <div className="app-sidebar-logo-row">
            <span style={{ fontSize: '1.6rem', color: 'var(--color-accent)' }} aria-hidden="true">🌱</span>
            <span className="app-sidebar-logo-text">AaharLink</span>
          </div>
          <span className="app-sidebar-tagline">Rescue Food. Connect Communities.</span>
        </Link>

        <nav aria-label="Workspace Navigation">
          <ul className="app-sidebar-nav">
            {role === 'ngo' && (
              <>
                <li>
                  <NavLink
                    to="/ngo"
                    end
                    className={({ isActive }) =>
                      `app-sidebar-link ${isActive ? 'app-sidebar-link--active' : ''}`
                    }
                  >
                    <div className="app-sidebar-item-left">
                      <span className="app-sidebar-icon" aria-hidden="true">🎯</span>
                      <span>Mission Control</span>
                    </div>
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/ngo/discover"
                    className={({ isActive }) =>
                      `app-sidebar-link ${isActive ? 'app-sidebar-link--active' : ''}`
                    }
                  >
                    <div className="app-sidebar-item-left">
                      <span className="app-sidebar-icon" aria-hidden="true">🔍</span>
                      <span>Discover Food</span>
                    </div>
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/ngo/pickups"
                    end
                    className={({ isActive }) =>
                      `app-sidebar-link ${isActive && !location.pathname.includes('/history') && !location.search.includes('tab=all') && !location.search.includes('tab=history') ? 'app-sidebar-link--active' : ''}`
                    }
                  >
                    <div className="app-sidebar-item-left">
                      <span className="app-sidebar-icon" aria-hidden="true">🚚</span>
                      <span>My Pickups</span>
                    </div>
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/ngo/history"
                    className={({ isActive }) =>
                      `app-sidebar-link ${isActive || location.pathname.includes('/history') || location.search.includes('tab=all') || location.search.includes('tab=history') ? 'app-sidebar-link--active' : ''}`
                    }
                  >
                    <div className="app-sidebar-item-left">
                      <span className="app-sidebar-icon" aria-hidden="true">🕒</span>
                      <span>History</span>
                    </div>
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/ngo/capacity"
                    className={({ isActive }) =>
                      `app-sidebar-link ${isActive ? 'app-sidebar-link--active' : ''}`
                    }
                  >
                    <div className="app-sidebar-item-left">
                      <span className="app-sidebar-icon" aria-hidden="true">🗂️</span>
                      <span>Capacity</span>
                    </div>
                  </NavLink>
                </li>
              </>
            )}

            {role === 'donor' && (
              <>
                <li>
                  <NavLink
                    to="/donor"
                    end
                    className={({ isActive }) =>
                      `app-sidebar-link ${isActive ? 'app-sidebar-link--active' : ''}`
                    }
                  >
                    <div className="app-sidebar-item-left">
                      <span className="app-sidebar-icon" aria-hidden="true">🎯</span>
                      <span>Mission Control</span>
                    </div>
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/donor/donations"
                    end
                    className={({ isActive }) =>
                      `app-sidebar-link ${isActive ? 'app-sidebar-link--active' : ''}`
                    }
                  >
                    <div className="app-sidebar-item-left">
                      <span className="app-sidebar-icon" aria-hidden="true">🍱</span>
                      <span>Manage Food</span>
                    </div>
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/donor/donations/new"
                    className={({ isActive }) =>
                      `app-sidebar-link ${isActive ? 'app-sidebar-link--active' : ''}`
                    }
                  >
                    <div className="app-sidebar-item-left">
                      <span className="app-sidebar-icon" aria-hidden="true">➕</span>
                      <span>Publish Food</span>
                    </div>
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/donor/history"
                    className={({ isActive }) =>
                      `app-sidebar-link ${isActive ? 'app-sidebar-link--active' : ''}`
                    }
                  >
                    <div className="app-sidebar-item-left">
                      <span className="app-sidebar-icon" aria-hidden="true">🕒</span>
                      <span>History</span>
                    </div>
                  </NavLink>
                </li>
              </>
            )}

            {role === 'coordinator' && (
              <>
                <li>
                  <NavLink
                    to="/coordinator"
                    end
                    className={({ isActive }) =>
                      `app-sidebar-link ${isActive ? 'app-sidebar-link--active' : ''}`
                    }
                  >
                    <div className="app-sidebar-item-left">
                      <span className="app-sidebar-icon" aria-hidden="true">🎯</span>
                      <span>Mission Control</span>
                    </div>
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/coordinator/organizations"
                    className={({ isActive }) =>
                      `app-sidebar-link ${isActive ? 'app-sidebar-link--active' : ''}`
                    }
                  >
                    <div className="app-sidebar-item-left">
                      <span className="app-sidebar-icon" aria-hidden="true">🛡️</span>
                      <span>Organizations</span>
                    </div>
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/coordinator/donations"
                    end
                    className={({ isActive }) =>
                      `app-sidebar-link ${isActive && !location.search.includes('status=Disputed') ? 'app-sidebar-link--active' : ''}`
                    }
                  >
                    <div className="app-sidebar-item-left">
                      <span className="app-sidebar-icon" aria-hidden="true">🚚</span>
                      <span>Donations</span>
                    </div>
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/coordinator/donations?status=Disputed"
                    className={() =>
                      `app-sidebar-link ${location.search.includes('status=Disputed') ? 'app-sidebar-link--active' : ''}`
                    }
                  >
                    <div className="app-sidebar-item-left">
                      <span className="app-sidebar-icon" aria-hidden="true">⚠️</span>
                      <span>Exceptions</span>
                    </div>
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/coordinator/analytics"
                    className={({ isActive }) =>
                      `app-sidebar-link ${isActive ? 'app-sidebar-link--active' : ''}`
                    }
                  >
                    <div className="app-sidebar-item-left">
                      <span className="app-sidebar-icon" aria-hidden="true">📊</span>
                      <span>Analytics</span>
                    </div>
                  </NavLink>
                </li>
                <li>
                  <NavLink
                    to="/coordinator/audit"
                    className={({ isActive }) =>
                      `app-sidebar-link ${isActive ? 'app-sidebar-link--active' : ''}`
                    }
                  >
                    <div className="app-sidebar-item-left">
                      <span className="app-sidebar-icon" aria-hidden="true">🗂️</span>
                      <span>Audit Ledger</span>
                    </div>
                  </NavLink>
                </li>
              </>
            )}

            {/* Shared Inbox and Account */}
            <li>
              <NavLink
                to="/notifications"
                className={({ isActive }) =>
                  `app-sidebar-link ${isActive ? 'app-sidebar-link--active' : ''}`
                }
              >
                <div className="app-sidebar-item-left">
                  <span className="app-sidebar-icon" aria-hidden="true">✉️</span>
                  <span>Inbox</span>
                </div>
                {unreadCount > 0 && (
                  <span
                    className="badge badge--unread"
                    style={{
                      background: '#DC2626',
                      color: '#ffffff',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '1px 6px',
                      minWidth: '18px',
                      textAlign: 'center',
                    }}
                  >
                    {unreadCount}
                  </span>
                )}
              </NavLink>
            </li>

            <li>
              <NavLink
                to="/account"
                className={({ isActive }) =>
                  `app-sidebar-link ${isActive ? 'app-sidebar-link--active' : ''}`
                }
              >
                <div className="app-sidebar-item-left">
                  <span className="app-sidebar-icon" aria-hidden="true">👤</span>
                  <span>Account</span>
                </div>
              </NavLink>
            </li>
          </ul>
        </nav>
      </div>

      {/* Bottom Organization Card matching screenshots */}
      <div className="app-sidebar-bottom">
        <div className="app-sidebar-org-card">
          <div className="app-sidebar-org-info">
            <span style={{ fontSize: '1.25rem' }} aria-hidden="true">🏛️</span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="app-sidebar-org-name" title={role === 'coordinator' ? 'Civic Coordinator' : (organization?.name || user?.email)}>
                {role === 'coordinator' ? 'Civic Coordinator' : (organization?.name || user?.email?.split('@')[0] || 'Organization')}
              </span>
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: 'var(--color-secondary)',
                  textTransform: role === 'coordinator' ? 'none' : 'uppercase',
                }}
              >
                {role === 'coordinator' ? 'Regional Operations' : getRoleBadge()}
              </span>
            </div>
          </div>
          <span style={{ color: 'var(--color-secondary)', fontSize: '0.8125rem' }} aria-hidden="true">
            ▾
          </span>
        </div>
      </div>
    </aside>
  );
}
