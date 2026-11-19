import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.js';
import type { OwnClaimSummary, Paginated } from '../../shared/contracts.js';

export default function NgoPickupsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [claims, setClaims] = useState<OwnClaimSummary[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filters
  const isHistoryPath = location.pathname.includes('/history');
  const tabParam = searchParams.get('tab') || searchParams.get('view');
  const initialFilter = isHistoryPath
    ? (tabParam === 'archived' ? 'archived' : 'all')
    : (tabParam === 'all' || tabParam === 'history' ? 'all' : tabParam === 'archived' ? 'archived' : 'active');
  const [activeArchived, setActiveArchived] = useState<'all' | 'active' | 'archived'>(initialFilter);
  const [statusFilter, setStatusFilter] = useState('');
  const [deadlineFilter, setDeadlineFilter] = useState('');
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    const isHist = location.pathname.includes('/history');
    const t = searchParams.get('tab') || searchParams.get('view');
    if (isHist) {
      if (t === 'archived') setActiveArchived('archived');
      else setActiveArchived('all');
    } else {
      if (t === 'archived') setActiveArchived('archived');
      else if (t === 'all') setActiveArchived('all');
      else setActiveArchived('active');
    }
  }, [location.pathname, searchParams]);

  const fetchClaims = useCallback(async (targetCursor?: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const queryParams = new URLSearchParams();
      queryParams.set('limit', '20');
      if (targetCursor) queryParams.set('cursor', targetCursor);
      if (statusFilter) queryParams.set('status', statusFilter);

      const res = await api<Paginated<OwnClaimSummary>>(`/api/ngo/claims?${queryParams.toString()}`);
      let items = res.items;

      // Filter active vs archived
      if (activeArchived === 'active') {
        items = items.filter((c) => ['Active', 'Ready'].includes(c.status));
      } else if (activeArchived === 'archived') {
        items = items.filter((c) => ['Collected', 'Completed', 'Cancelled', 'Expired'].includes(c.status));
      }

      if (deadlineFilter) {
        const maxTime = new Date(deadlineFilter).getTime();
        items = items.filter((c) => new Date(c.pickupDeadline).getTime() <= maxTime);
      }

      setClaims(items);
      setNextCursor(res.nextCursor);
      if (items.length > 0 && !selectedId) {
        setSelectedId(items[0].id);
      }
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to load pickups.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [activeArchived, statusFilter, deadlineFilter, selectedId, toast]);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  const handleApplyFilters = () => {
    setCursor(undefined);
    setCursorHistory([]);
    fetchClaims(undefined);
  };

  const handleSortToggle = () => {
    setSortAsc(!sortAsc);
    setClaims((prev) =>
      [...prev].sort((a, b) => {
        const diff = new Date(a.pickupDeadline).getTime() - new Date(b.pickupDeadline).getTime();
        return sortAsc ? diff : -diff;
      })
    );
  };

  const handleNextPage = () => {
    if (!nextCursor) return;
    setCursorHistory((prev) => [...prev, cursor || '']);
    setCursor(nextCursor);
    fetchClaims(nextCursor);
  };

  const handlePreviousPage = () => {
    if (cursorHistory.length === 0) return;
    const prevHistory = [...cursorHistory];
    const prevCursor = prevHistory.pop();
    setCursorHistory(prevHistory);
    const resolved = prevCursor || undefined;
    setCursor(resolved);
    fetchClaims(resolved);
  };

  const handleOpenPickup = () => {
    if (!selectedId) {
      toast.warning('Please select a pickup first.');
      return;
    }
    navigate(`/ngo/pickups/${selectedId}`);
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <button
          type="button"
          data-testid="EL-137"
          className="btn btn--outline btn--sm"
          onClick={() => navigate('/ngo')}
        >
          ← Return to NGO dashboard
        </button>

        <button
          type="button"
          data-testid="EL-146"
          className="btn btn--secondary btn--sm"
          onClick={() => fetchClaims(cursor)}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Retry loading'}
        </button>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="card-title">
              {activeArchived === 'active'
                ? 'Active Pickups in Transit'
                : activeArchived === 'all'
                ? 'Rescue Operations History (All Active & Past)'
                : 'Completed Rescues & Deliveries'}
            </h1>
            <p className="card-description">
              {activeArchived === 'active'
                ? 'Track active dispatches, access unlocked donor dispatch addresses, and submit one-time handover codes.'
                : activeArchived === 'all'
                ? 'Complete chronological record of all surplus food claims, verified handovers, and completed deliveries.'
                : 'Delivered and verified food rescues recorded in the permanent audit ledger.'}
            </p>
          </div>
          <button
            type="button"
            data-testid="EL-138"
            className="btn btn--primary"
            onClick={handleOpenPickup}
            disabled={!selectedId}
          >
            Open selected pickup
          </button>
        </div>

        {errorMsg && (
          <div className="error-banner" role="alert" style={{ marginBottom: '1.25rem' }}>
            <span aria-hidden="true">⚠ </span>
            {errorMsg}
          </div>
        )}

        {/* Quick Segmented Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn btn--sm ${activeArchived === 'active' ? 'btn--primary' : 'btn--outline'}`}
            style={{ borderRadius: '9999px', fontWeight: 600 }}
            onClick={() => {
              setActiveArchived('active');
              navigate('/ngo/pickups');
            }}
          >
            🚚 Active Pickups
          </button>
          <button
            type="button"
            className={`btn btn--sm ${activeArchived === 'all' ? 'btn--primary' : 'btn--outline'}`}
            style={{ borderRadius: '9999px', fontWeight: 600 }}
            onClick={() => {
              setActiveArchived('all');
              navigate('/ngo/history');
            }}
          >
            📜 Complete History (All Active & Past)
          </button>
          <button
            type="button"
            className={`btn btn--sm ${activeArchived === 'archived' ? 'btn--primary' : 'btn--outline'}`}
            style={{ borderRadius: '9999px', fontWeight: 600 }}
            onClick={() => {
              setActiveArchived('archived');
              navigate('/ngo/history?tab=archived');
            }}
          >
            ✅ Completed Deliveries
          </button>
        </div>

        {/* Filters */}
        <div className="filter-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem', padding: '1rem', background: 'var(--color-canvas)', borderRadius: 'var(--radius-sm)' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="pk-active-archived" className="form-label" style={{ fontSize: '0.75rem' }}>
              Filter: active vs archived
            </label>
            <select
              id="pk-active-archived"
              data-testid="EL-139"
              className="form-input form-input--sm"
              value={activeArchived}
              onChange={(e) => setActiveArchived(e.target.value as 'all' | 'active' | 'archived')}
            >
              <option value="active">Active Pickups (In Transit / Ready)</option>
              <option value="archived">Archived (Collected / Completed / Cancelled)</option>
              <option value="all">All Pickups</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="pk-status" className="form-label" style={{ fontSize: '0.75rem' }}>
              Filter: status
            </label>
            <select
              id="pk-status"
              data-testid="EL-140"
              className="form-input form-input--sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="Active">Active (Claimed)</option>
              <option value="Ready">Ready (Code Waiting)</option>
              <option value="Completed">Completed (Delivered)</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="pk-deadline" className="form-label" style={{ fontSize: '0.75rem' }}>
              Filter: pickup deadline
            </label>
            <input
              id="pk-deadline"
              type="datetime-local"
              data-testid="EL-141"
              className="form-input form-input--sm"
              value={deadlineFilter}
              onChange={(e) => setDeadlineFilter(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
            <button
              type="button"
              data-testid="EL-142"
              className="btn btn--primary btn--sm"
              onClick={handleApplyFilters}
            >
              Apply filters
            </button>
            <button
              type="button"
              data-testid="EL-143"
              className="btn btn--outline btn--sm"
              onClick={handleSortToggle}
            >
              Sort results
            </button>
          </div>
        </div>

        {/* Pickups Table */}
        {loading ? (
          <div className="loading-skeleton" role="status" aria-busy="true">
            <p>Loading pickups...</p>
          </div>
        ) : claims.length === 0 ? (
          <div className="empty-state" style={{ textAlign: 'center', padding: '2.5rem' }}>
            <p style={{ color: 'var(--color-secondary)' }}>No pickups found matching criteria.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Status</th>
                  <th scope="col">Food Details</th>
                  <th scope="col">Portions</th>
                  <th scope="col">Donor City</th>
                  <th scope="col">Pickup Deadline</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((c) => {
                  const isSelected = selectedId === c.id;
                  return (
                    <tr
                      key={c.id}
                      className={isSelected ? 'table-row--selected' : ''}
                      onClick={() => setSelectedId(c.id)}
                      onDoubleClick={() => navigate(`/ngo/pickups/${c.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <span className={`badge ${c.status === 'Ready' ? 'badge--success' : c.status === 'Active' ? 'badge--warning' : c.status === 'Completed' ? 'badge--info' : 'badge--secondary'}`}>
                          {c.status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <strong>{c.category}</strong>: {c.description}
                      </td>
                      <td>{c.claimedPortions}</td>
                      <td>{c.donorCity || 'City'}</td>
                      <td>{new Date(c.pickupDeadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td>
                        <button
                          type="button"
                          className={`btn ${c.status === 'Ready' ? 'btn--primary' : 'btn--outline'} btn--sm`}
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/ngo/pickups/${c.id}`);
                          }}
                        >
                          {c.status === 'Ready' ? 'Verify Code →' : c.status === 'Completed' ? 'View Receipt →' : 'Manage Pickup →'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Fallback hidden element */}
        {claims.length === 0 && (
          <div style={{ display: 'none' }}>
            <button type="button" data-testid="EL-138" onClick={handleOpenPickup}>Open selected pickup</button>
          </div>
        )}

        {/* Pagination */}
        <div className="pagination-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
          <button
            type="button"
            data-testid="EL-145"
            className="btn btn--outline btn--sm"
            onClick={handlePreviousPage}
            disabled={cursorHistory.length === 0 || loading}
          >
            ← Previous page
          </button>

          <span style={{ fontSize: '0.875rem', color: 'var(--color-secondary)' }}>
            Showing {claims.length} pickups
          </span>

          <button
            type="button"
            data-testid="EL-144"
            className="btn btn--outline btn--sm"
            onClick={handleNextPage}
            disabled={!nextCursor || loading}
          >
            Next page →
          </button>
        </div>
      </div>
    </div>
  );
}
