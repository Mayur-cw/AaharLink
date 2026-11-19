import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.js';
import type { Paginated } from '../../shared/contracts.js';

interface CoordinatorExceptionItem {
  id: string;
  donorOrgName: string;
  category?: string;
  foodCategory?: string;
  description: string;
  offeredPortions?: number;
  portionsOffered?: number;
  pickupDeadline: string;
  status: string;
  claimStatus: string | null;
  claimNgoName?: string;
  createdAt: string;
}

export default function CoordinatorExceptionsPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [items, setItems] = useState<CoordinatorExceptionItem[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'disputed' | 'urgent' | 'stalled'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchExceptions = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // Fetch all active, disputed, and expiring batches
      const res = await api<Paginated<CoordinatorExceptionItem>>('/api/coordinator/donations?limit=50');
      const allItems = res.items || [];
      setItems(allItems);
      if (allItems.length > 0 && !selectedId) {
        setSelectedId(allItems[0].id);
      }
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to load exception incidents.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [selectedId, toast]);

  useEffect(() => {
    fetchExceptions();
  }, [fetchExceptions]);

  // Categorize exceptions
  const now = Date.now();
  const twoHoursFromNow = now + 2 * 3600 * 1000;

  const categorized = useMemo(() => {
    const disputed = items.filter((d) => d.status === 'Disputed');
    const urgent = items.filter(
      (d) =>
        new Date(d.pickupDeadline).getTime() <= twoHoursFromNow &&
        !['Completed', 'Expired', 'Cancelled'].includes(d.status)
    );
    const stalled = items.filter(
      (d) =>
        d.status === 'Claimed' &&
        new Date(d.pickupDeadline).getTime() < now
    );

    // Combined unique exceptions
    const allExceptionIds = new Set<string>();
    const all: CoordinatorExceptionItem[] = [];

    disputed.forEach((d) => {
      allExceptionIds.add(d.id);
      all.push(d);
    });
    urgent.forEach((d) => {
      if (!allExceptionIds.has(d.id)) {
        allExceptionIds.add(d.id);
        all.push(d);
      }
    });
    stalled.forEach((d) => {
      if (!allExceptionIds.has(d.id)) {
        allExceptionIds.add(d.id);
        all.push(d);
      }
    });

    return { all, disputed, urgent, stalled };
  }, [items, now, twoHoursFromNow]);

  // Filter based on active tab and search query
  const displayedItems = useMemo(() => {
    let list = categorized[activeTab];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (d) =>
          d.description.toLowerCase().includes(q) ||
          d.donorOrgName.toLowerCase().includes(q) ||
          (d.claimNgoName && d.claimNgoName.toLowerCase().includes(q))
      );
    }
    return list;
  }, [categorized, activeTab, searchQuery]);

  const getTimeRemaining = (deadline: string) => {
    const diff = new Date(deadline).getTime() - now;
    if (diff <= 0) return 'Deadline expired';
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    if (hours > 0) return `${hours}h ${mins % 60}m remaining`;
    return `${mins}m remaining`;
  };

  const getExceptionBadge = (item: CoordinatorExceptionItem) => {
    if (item.status === 'Disputed') {
      return (
        <span
          style={{
            background: '#FEE2E2',
            color: '#DC2626',
            padding: '3px 9px',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span aria-hidden="true">⚠️</span> DISPUTE OPEN
        </span>
      );
    }
    const isPastDeadline = new Date(item.pickupDeadline).getTime() < now;
    if (item.status === 'Claimed' && isPastDeadline) {
      return (
        <span
          style={{
            background: '#EDE9FE',
            color: '#7C3AED',
            padding: '3px 9px',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span aria-hidden="true">🔄</span> STALLED TRANSIT
        </span>
      );
    }
    return (
      <span
        style={{
          background: '#FEF3C7',
          color: '#D97706',
          padding: '3px 9px',
          borderRadius: '9999px',
          fontSize: '0.75rem',
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <span aria-hidden="true">⏳</span> CRITICAL EXPIRY
      </span>
    );
  };

  return (
    <div className="page-container" style={{ maxWidth: '1280px', margin: '0 auto' }}>
      {/* Back button and page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <button
          type="button"
          className="btn btn--outline btn--sm"
          style={{ borderRadius: '9999px', padding: '0.4rem 1rem', fontWeight: 600, background: 'var(--color-surface)' }}
          onClick={() => navigate('/coordinator')}
        >
          ← Return to Mission Control
        </button>

        <button
          type="button"
          className="btn btn--secondary btn--sm"
          style={{ borderRadius: '9999px', padding: '0.4rem 1rem', fontWeight: 600 }}
          onClick={fetchExceptions}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : '↻ Refresh incident queue'}
        </button>
      </div>

      {/* Main Exception Center Card */}
      <div className="card" style={{ padding: '1.75rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
              <span aria-hidden="true" style={{ fontSize: '1.5rem' }}>🚨</span>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-ink)', margin: 0, letterSpacing: '-0.02em' }}>
                Civic Exception Remediation Center
              </h1>
            </div>
            <p style={{ margin: 0, color: 'var(--color-secondary)', fontSize: '0.9375rem' }}>
              Active incident triage, delivery dispute arbitration, and urgent expiry interventions.
            </p>
          </div>

          <span
            style={{
              padding: '0.4rem 0.85rem',
              background: '#FEE2E2',
              color: '#DC2626',
              borderRadius: '9999px',
              fontSize: '0.8125rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <span aria-hidden="true">⚠️</span> Operational Remediation Queue
          </span>
        </div>

        {errorMsg && (
          <div className="error-banner" role="alert" style={{ marginBottom: '1.25rem' }}>
            <span aria-hidden="true">⚠ </span>
            {errorMsg}
          </div>
        )}

        {/* Triage Stat Pills */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <div
            style={{
              padding: '1rem',
              background: 'var(--color-canvas)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem',
            }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#FEE2E2', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
              ⚠️
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#DC2626', lineHeight: 1.1 }}>
                {categorized.disputed.length}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-secondary)', fontWeight: 600 }}>
                Open Disputes
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '1rem',
              background: 'var(--color-canvas)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem',
            }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#FEF3C7', color: '#D97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
              ⏳
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#D97706', lineHeight: 1.1 }}>
                {categorized.urgent.length}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-secondary)', fontWeight: 600 }}>
                Critical Expiry (&lt; 2h)
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '1rem',
              background: 'var(--color-canvas)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem',
            }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#EDE9FE', color: '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
              🔄
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#7C3AED', lineHeight: 1.1 }}>
                {categorized.stalled.length}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-secondary)', fontWeight: 600 }}>
                Stalled Handovers
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '1rem',
              background: 'var(--color-canvas)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem',
            }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem' }}>
              🛡️
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-ink)', lineHeight: 1.1 }}>
                {categorized.all.length}
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-secondary)', fontWeight: 600 }}>
                Total Active Incidents
              </div>
            </div>
          </div>
        </div>

        {/* Segmented Filter Pills */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn btn--sm ${activeTab === 'all' ? 'btn--primary' : 'btn--outline'}`}
            style={{ borderRadius: '9999px', fontWeight: 600 }}
            onClick={() => setActiveTab('all')}
          >
            🚨 All Exceptions ({categorized.all.length})
          </button>
          <button
            type="button"
            className={`btn btn--sm ${activeTab === 'disputed' ? 'btn--primary' : 'btn--outline'}`}
            style={{ borderRadius: '9999px', fontWeight: 600 }}
            onClick={() => setActiveTab('disputed')}
          >
            ⚠️ Open Disputes ({categorized.disputed.length})
          </button>
          <button
            type="button"
            className={`btn btn--sm ${activeTab === 'urgent' ? 'btn--primary' : 'btn--outline'}`}
            style={{ borderRadius: '9999px', fontWeight: 600 }}
            onClick={() => setActiveTab('urgent')}
          >
            ⏳ Critical Expiry ({categorized.urgent.length})
          </button>
          <button
            type="button"
            className={`btn btn--sm ${activeTab === 'stalled' ? 'btn--primary' : 'btn--outline'}`}
            style={{ borderRadius: '9999px', fontWeight: 600 }}
            onClick={() => setActiveTab('stalled')}
          >
            🔄 Stalled Handovers ({categorized.stalled.length})
          </button>
        </div>

        {/* Search bar */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="input-with-icon-wrapper">
            <span className="input-leading-icon" aria-hidden="true">🔍</span>
            <input
              type="text"
              className="form-input"
              style={{ borderRadius: 'var(--radius-sm)' }}
              placeholder="Filter incidents by food description, donor kitchen, or claiming NGO..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Filter exceptions"
            />
          </div>
        </div>

        {/* Incident List */}
        {displayedItems.length === 0 ? (
          <div style={{ padding: '3rem 1.5rem', textAlign: 'center', background: 'var(--color-canvas)', borderRadius: 'var(--radius-sm)' }}>
            <span aria-hidden="true" style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.75rem' }}>🎉</span>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 0.4rem 0', color: 'var(--color-ink)' }}>
              No Active Exceptions in this Queue
            </h3>
            <p style={{ margin: 0, color: 'var(--color-secondary)', fontSize: '0.875rem' }}>
              All surplus food batches and relief dispatches are operating smoothly within safe thresholds.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {displayedItems.map((item) => {
              const portions = item.portionsOffered || item.offeredPortions || 0;
              const category = item.category || item.foodCategory || 'cooked';
              const isDisputed = item.status === 'Disputed';

              return (
                <div
                  key={item.id}
                  style={{
                    background: isDisputed ? 'rgba(254, 226, 226, 0.25)' : 'var(--color-surface)',
                    border: `1.5px solid ${isDisputed ? '#F87171' : 'var(--color-border)'}`,
                    borderRadius: 'var(--radius-sm)',
                    padding: '1.25rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1.25rem',
                    transition: 'border-color var(--transition-fast), box-shadow var(--transition-fast)',
                  }}
                >
                  <div style={{ flex: '1 1 320px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                      {getExceptionBadge(item)}
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-secondary)' }}>
                        {category} · {portions} portions
                      </span>
                    </div>

                    <h3 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--color-ink)', margin: '0 0 0.4rem 0' }}>
                      {item.description}
                    </h3>

                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.8125rem', color: 'var(--color-secondary)' }}>
                      <div>
                        <strong>Donor:</strong> {item.donorOrgName}
                      </div>
                      {item.claimNgoName && (
                        <div>
                          <strong>Claimed By:</strong> {item.claimNgoName} ({item.claimStatus || 'Active'})
                        </div>
                      )}
                      <div>
                        <strong>Safe Deadline:</strong> {getTimeRemaining(item.pickupDeadline)} ({new Date(item.pickupDeadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <button
                      type="button"
                      className="btn btn--primary"
                      style={{
                        padding: '0.55rem 1.15rem',
                        fontWeight: 700,
                        fontSize: '0.875rem',
                        borderRadius: 'var(--radius-sm)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                      }}
                      onClick={() => navigate(`/coordinator/donations/${item.id}`)}
                    >
                      <span>Investigate & Resolve</span>
                      <span aria-hidden="true">→</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
