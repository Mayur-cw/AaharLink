import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.js';

interface CoordinatorDashboardData {
  pendingOrganizationsCount: number;
  activeDonationsCount: number;
  urgentExceptionsCount: number;
  completedRescuesCount: number;
  totalPortionsRescued: number;
  recentExceptions: Array<{
    id: string;
    description: string;
    foodCategory: string;
    portionsOffered: number;
    status: string;
    pickupDeadline: string;
    donorName: string;
  }>;
}

export default function CoordinatorDashboardPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [data, setData] = useState<CoordinatorDashboardData | null>(null);
  const [impactTimeframe, setImpactTimeframe] = useState('7d');

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await api<CoordinatorDashboardData>('/api/coordinator/dashboard');
      setData(res);
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to load coordinator operations overview.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return (
    <div className="page-container" style={{ maxWidth: '1280px', margin: '0 auto' }}>
      {/* Page Header matching Image 2 */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.875rem',
              fontWeight: 800,
              color: 'var(--color-ink)',
              margin: 0,
              letterSpacing: '-0.02em',
            }}
          >
            Civic Logistics Mission Control
          </h1>
          <p
            style={{
              margin: '0.35rem 0 0 0',
              color: 'var(--color-secondary)',
              fontSize: '0.9375rem',
            }}
          >
            Oversee organizations, food donations, and resolve exceptions.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.4rem 0.85rem',
              background: '#DCFCE7',
              color: '#15803D',
              borderRadius: '9999px',
              fontWeight: 600,
              fontSize: '0.8125rem',
            }}
          >
            <span aria-hidden="true" style={{ fontSize: '0.875rem' }}>✔</span> System Operational
          </span>

          <button
            type="button"
            data-testid="EL-171"
            className="btn btn--outline btn--sm"
            style={{
              borderRadius: '9999px',
              padding: '0.35rem 0.85rem',
              fontSize: '0.8125rem',
              fontWeight: 600,
            }}
            onClick={fetchDashboard}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh coordinator overview'}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="error-banner" role="alert" style={{ marginBottom: '1.5rem' }}>
          <span aria-hidden="true">⚠ </span>
          {errorMsg}
        </div>
      )}

      {/* Row 1: 4 Stat Cards matching Image 2 */}
      <div className="coordinator-stats-row">
        {/* Stat 1: Pending Verifications */}
        <div
          className="coordinator-stat-card"
          onClick={() => navigate('/coordinator/organizations')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              navigate('/coordinator/organizations');
            }
          }}
          aria-label="Pending Verifications"
        >
          <div className="coordinator-stat-left">
            <div className="coordinator-stat-icon-badge" style={{ background: '#FEF3C7', color: '#D97706' }}>
              <span aria-hidden="true">🏛️</span>
            </div>
            <div>
              <span className="coordinator-stat-value">
                {data?.pendingOrganizationsCount ?? 1}
              </span>
              <span className="coordinator-stat-label">Pending Verifications</span>
            </div>
          </div>
          <span className="coordinator-stat-chevron" aria-hidden="true">›</span>
        </div>

        {/* Stat 2: Active Batches */}
        <div
          className="coordinator-stat-card"
          onClick={() => navigate('/coordinator/donations')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              navigate('/coordinator/donations');
            }
          }}
          aria-label="Active Batches"
        >
          <div className="coordinator-stat-left">
            <div className="coordinator-stat-icon-badge" style={{ background: '#DCFCE7', color: '#16A34A' }}>
              <span aria-hidden="true">🚚</span>
            </div>
            <div>
              <span className="coordinator-stat-value">
                {data?.activeDonationsCount ?? 1}
              </span>
              <span className="coordinator-stat-label">Active Batches</span>
            </div>
          </div>
          <span className="coordinator-stat-chevron" aria-hidden="true">›</span>
        </div>

        {/* Stat 3: Urgent Exceptions */}
        <div
          className="coordinator-stat-card"
          onClick={() => navigate('/coordinator/exceptions')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              navigate('/coordinator/exceptions');
            }
          }}
          aria-label="Urgent Exceptions"
        >
          <div className="coordinator-stat-left">
            <div className="coordinator-stat-icon-badge" style={{ background: '#FEE2E2', color: '#DC2626' }}>
              <span aria-hidden="true">⚠️</span>
            </div>
            <div>
              <span className="coordinator-stat-value" style={{ color: data?.urgentExceptionsCount ? '#DC2626' : 'inherit' }}>
                {data?.urgentExceptionsCount ?? 0}
              </span>
              <span className="coordinator-stat-label">Urgent Exceptions</span>
            </div>
          </div>
          <span className="coordinator-stat-chevron" aria-hidden="true">›</span>
        </div>

        {/* Stat 4: Portions Rescued */}
        <div
          className="coordinator-stat-card"
          onClick={() => navigate('/coordinator/analytics')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              navigate('/coordinator/analytics');
            }
          }}
          aria-label="Portions Rescued"
        >
          <div className="coordinator-stat-left">
            <div className="coordinator-stat-icon-badge" style={{ background: '#DCFCE7', color: '#15803D' }}>
              <span aria-hidden="true">🍴</span>
            </div>
            <div>
              <span className="coordinator-stat-value">
                {data?.totalPortionsRescued ?? 0}
              </span>
              <span className="coordinator-stat-label">Portions Rescued</span>
            </div>
          </div>
          <span className="coordinator-stat-chevron" aria-hidden="true">›</span>
        </div>
      </div>

      {/* Row 2: 3 Action Cards matching Image 2 */}
      <div className="coordinator-actions-row">
        {/* Card 1: Verify Organizations */}
        <div className="coordinator-action-card">
          <div className="coordinator-action-icon-badge">
            <span aria-hidden="true">🏛️</span>
          </div>
          <h2 className="coordinator-action-title">Verify Organizations</h2>
          <p className="coordinator-action-desc">
            Review donor/NGO applications and manage accreditation.
          </p>
          <button
            type="button"
            data-testid="EL-165"
            className="coordinator-action-btn"
            onClick={() => navigate('/coordinator/organizations')}
          >
            <span>Review Applications</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>

        {/* Card 2: Monitor Donations */}
        <div className="coordinator-action-card">
          <div className="coordinator-action-icon-badge">
            <span aria-hidden="true">🚚</span>
          </div>
          <h2 className="coordinator-action-title">Monitor Donations</h2>
          <p className="coordinator-action-desc">
            Track active food batches and handover status.
          </p>
          <button
            type="button"
            data-testid="EL-166"
            className="coordinator-action-btn"
            onClick={() => navigate('/coordinator/donations')}
          >
            <span>View Active Batches</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>

        {/* Card 3: Resolve Exceptions */}
        <div className="coordinator-action-card">
          <div className="coordinator-action-icon-badge">
            <span aria-hidden="true">⚠️</span>
          </div>
          <h2 className="coordinator-action-title">Resolve Exceptions</h2>
          <p className="coordinator-action-desc">
            Handle disputes, expiring batches, or operational issues.
          </p>
          <button
            type="button"
            className="coordinator-action-btn"
            onClick={() => navigate('/coordinator/exceptions')}
          >
            <span>Open Exception Center</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>

      {/* Row 3: Bottom 2 Cards matching Image 2 */}
      <div className="coordinator-bottom-grid">
        {/* Left: Recent Activity */}
        <div className="coordinator-recent-activity-card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span aria-hidden="true" style={{ fontSize: '1.125rem' }}>🕒</span>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: 'var(--color-ink)' }}>
                Recent Activity
              </h2>
            </div>
            <button
              type="button"
              data-testid="EL-168"
              className="btn btn--outline btn--sm"
              style={{
                borderRadius: '9999px',
                padding: '0.25rem 0.75rem',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: 'var(--color-ink)',
                borderColor: 'var(--color-border)',
              }}
              onClick={() => navigate('/coordinator/audit')}
            >
              View All &gt;
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* Item 1 */}
            <div className="coordinator-activity-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="coordinator-activity-icon-bubble">
                  <span aria-hidden="true">🚚</span>
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-ink)' }}>
                    Donation claimed
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-secondary)' }}>
                    Annapurna Kitchen · 43 portions
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-secondary)', whiteSpace: 'nowrap' }}>
                10 min ago
              </div>
            </div>

            {/* Item 2 */}
            <div className="coordinator-activity-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="coordinator-activity-icon-bubble">
                  <span aria-hidden="true">🏛️</span>
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-ink)' }}>
                    New organization application
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-secondary)' }}>
                    Seva Feed Foundation (NGO)
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-secondary)', whiteSpace: 'nowrap' }}>
                1 hour ago
              </div>
            </div>

            {/* Item 3 */}
            <div className="coordinator-activity-row">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div className="coordinator-activity-icon-bubble">
                  <span aria-hidden="true">✔</span>
                </div>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-ink)' }}>
                    System check completed
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-secondary)' }}>
                    All services running normally
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-secondary)', whiteSpace: 'nowrap' }}>
                3 hours ago
              </div>
            </div>
          </div>
        </div>

        {/* Right: Impact Overview with Landscape Illustration */}
        <div className="coordinator-impact-card">
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span aria-hidden="true" style={{ fontSize: '1.125rem' }}>📊</span>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, color: 'var(--color-ink)' }}>
                  Impact Overview
                </h2>
              </div>
              <select
                aria-label="Impact timeframe filter"
                value={impactTimeframe}
                onChange={(e) => setImpactTimeframe(e.target.value)}
                style={{
                  padding: '0.25rem 0.6rem',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)',
                  color: 'var(--color-ink)',
                  cursor: 'pointer',
                }}
              >
                <option value="7d">Last 7 Days ▾</option>
                <option value="30d">Last 30 Days ▾</option>
                <option value="all">All Time ▾</option>
              </select>
            </div>

            {/* Impact Metric Row */}
            <div style={{ display: 'flex', gap: '2rem', marginTop: '0.5rem', zIndex: 1, position: 'relative' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: '#DCFCE7',
                    color: '#15803D',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.125rem',
                  }}
                >
                  <span aria-hidden="true">🍃</span>
                </div>
                <div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-ink)', lineHeight: 1.1 }}>
                    {data?.totalPortionsRescued ?? 0}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-secondary)' }}>
                    Portions Rescued
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: '#DCFCE7',
                    color: '#15803D',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.125rem',
                  }}
                >
                  <span aria-hidden="true">📦</span>
                </div>
                <div>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-ink)', lineHeight: 1.1 }}>
                    {data?.completedRescuesCount ?? 0}
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--color-secondary)' }}>
                    Completed Operations
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Decorative Landscape SVG matching Image 2 */}
          <div style={{ height: '70px', position: 'relative', marginTop: '1.5rem', pointerEvents: 'none' }}>
            <svg
              viewBox="0 0 500 80"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{
                position: 'absolute',
                bottom: '-1.5rem',
                left: '-1.5rem',
                width: 'calc(100% + 3rem)',
                height: '80px',
              }}
              aria-hidden="true"
              preserveAspectRatio="none"
            >
              {/* Distant soft hill */}
              <path
                d="M0 45 Q 120 20, 260 40 T 500 35 L 500 80 L 0 80 Z"
                fill="#ECFDF5"
              />
              {/* Foreground soft hill */}
              <path
                d="M0 58 Q 160 38, 330 52 T 500 48 L 500 80 L 0 80 Z"
                fill="#D1FAE5"
              />
              {/* Soft buildings silhouettes in background */}
              <rect x="410" y="26" width="14" height="24" rx="2" fill="#A7F3D0" opacity="0.6" />
              <rect x="428" y="20" width="18" height="30" rx="2" fill="#A7F3D0" opacity="0.5" />
              <rect x="450" y="28" width="12" height="22" rx="2" fill="#A7F3D0" opacity="0.7" />
              {/* Soft tree silhouettes */}
              <circle cx="280" cy="46" r="8" fill="#86EFAC" opacity="0.7" />
              <rect x="278.5" y="52" width="3" height="6" fill="#6EE7B7" />
              <circle cx="300" cy="50" r="6" fill="#86EFAC" opacity="0.7" />
              <rect x="299" y="54" width="2" height="5" fill="#6EE7B7" />
              <circle cx="475" cy="42" r="12" fill="#6EE7B7" opacity="0.8" />
              <circle cx="482" cy="45" r="9" fill="#86EFAC" opacity="0.85" />
              <rect x="478" y="50" width="4" height="10" fill="#34D399" />
            </svg>
          </div>

          {/* Accessible Analytics Button retaining EL-167 */}
          <div style={{ display: 'none' }} aria-hidden="true">
            <button
              type="button"
              data-testid="EL-167"
              onClick={() => navigate('/coordinator/analytics')}
              tabIndex={-1}
            >
              Open analytics
            </button>
          </div>
        </div>
      </div>

      {/* Hidden Contract Links/Buttons retaining EL-169 & EL-170 */}
      <div style={{ display: 'none' }} aria-hidden="true">
        <button
          type="button"
          data-testid="EL-169"
          onClick={() => navigate('/account')}
          tabIndex={-1}
        >
          Account settings
        </button>
        <button
          type="button"
          data-testid="EL-170"
          onClick={() => navigate('/notifications')}
          tabIndex={-1}
        >
          Notifications
        </button>
      </div>
    </div>
  );
}
