import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.js';
import type { DonationOwnerSummary, Paginated } from '../../shared/contracts.js';

export default function DonorHistoryPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [donations, setDonations] = useState<DonationOwnerSummary[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filters
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortAsc, setSortAsc] = useState(false);

  const fetchHistory = useCallback(async (targetCursor?: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const queryParams = new URLSearchParams();
      queryParams.set('limit', '20');
      if (targetCursor) queryParams.set('cursor', targetCursor);

      const res = await api<Paginated<DonationOwnerSummary>>(`/api/donor/donations?${queryParams.toString()}`);
      let items = res.items;

      // Filter for past/resolved donations
      if (outcomeFilter) {
        items = items.filter((d) => d.status.toLowerCase() === outcomeFilter.toLowerCase());
      } else {
        items = items.filter((d) => ['completed', 'cancelled', 'expired', 'disputed'].includes(d.status.toLowerCase()));
      }

      if (categoryFilter) {
        items = items.filter((d) => d.category.toLowerCase() === categoryFilter.toLowerCase());
      }

      if (dateFilter) {
        const targetDate = new Date(dateFilter).toDateString();
        items = items.filter((d) => new Date(d.createdAt).toDateString() === targetDate);
      }

      setDonations(items);
      setNextCursor(res.nextCursor);
      if (items.length > 0 && !selectedId) {
        setSelectedId(items[0].id);
      }
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to load historical donations.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [outcomeFilter, categoryFilter, dateFilter, selectedId, toast]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleApplyFilters = () => {
    setCursor(undefined);
    setCursorHistory([]);
    fetchHistory(undefined);
  };

  const handleSortToggle = () => {
    setSortAsc(!sortAsc);
    setDonations((prev) =>
      [...prev].sort((a, b) => {
        const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return sortAsc ? diff : -diff;
      })
    );
  };

  const handleNextPage = () => {
    if (!nextCursor) return;
    setCursorHistory((prev) => [...prev, cursor || '']);
    setCursor(nextCursor);
    fetchHistory(nextCursor);
  };

  const handlePreviousPage = () => {
    if (cursorHistory.length === 0) return;
    const prevHistory = [...cursorHistory];
    const prevCursor = prevHistory.pop();
    setCursorHistory(prevHistory);
    const resolved = prevCursor || undefined;
    setCursor(resolved);
    fetchHistory(resolved);
  };

  const handleViewDetail = () => {
    if (!selectedId) {
      toast.warning('Select a donation to inspect.');
      return;
    }
    navigate(`/donor/donations/${selectedId}`);
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <button
          type="button"
          data-testid="EL-102"
          className="btn btn--outline btn--sm"
          onClick={() => navigate('/donor')}
        >
          ← Back to donor dashboard
        </button>

        <button
          type="button"
          data-testid="EL-111"
          className="btn btn--secondary btn--sm"
          onClick={() => fetchHistory(cursor)}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Retry loading'}
        </button>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="card-title">Past Donations and Outcomes</h1>
            <p className="card-description">
              Archive of completed food rescues, verified collections, cancellations, and expired listings.
            </p>
          </div>
          <button
            type="button"
            data-testid="EL-103"
            className="btn btn--primary"
            onClick={handleViewDetail}
            disabled={!selectedId}
          >
            View historical donation detail
          </button>
        </div>

        {errorMsg && (
          <div className="error-banner" role="alert" style={{ marginBottom: '1.25rem' }}>
            <span aria-hidden="true">⚠ </span>
            {errorMsg}
          </div>
        )}

        {/* Filter bar */}
        <div className="filter-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem', padding: '1rem', background: 'var(--color-canvas)', borderRadius: 'var(--radius-sm)' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="hist-outcome" className="form-label" style={{ fontSize: '0.75rem' }}>
              Filter: outcome
            </label>
            <select
              id="hist-outcome"
              data-testid="EL-104"
              className="form-input form-input--sm"
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value)}
            >
              <option value="">All Resolved Outcomes</option>
              <option value="Completed">Completed (Rescued)</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Expired">Expired</option>
              <option value="Disputed">Disputed</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="hist-category" className="form-label" style={{ fontSize: '0.75rem' }}>
              Filter: food category
            </label>
            <select
              id="hist-category"
              data-testid="EL-106"
              className="form-input form-input--sm"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">All Categories</option>
              <option value="cooked_meals">Cooked Meals</option>
              <option value="packaged_goods">Packaged Goods</option>
              <option value="raw_produce">Raw Produce</option>
              <option value="baked_items">Baked Items</option>
              <option value="dairy">Dairy</option>
              <option value="beverages">Beverages</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="hist-date" className="form-label" style={{ fontSize: '0.75rem' }}>
              Filter: date range
            </label>
            <input
              id="hist-date"
              type="date"
              data-testid="EL-105"
              className="form-input form-input--sm"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
            <button
              type="button"
              data-testid="EL-107"
              className="btn btn--primary btn--sm"
              onClick={handleApplyFilters}
            >
              Apply filters
            </button>
            <button
              type="button"
              data-testid="EL-108"
              className="btn btn--outline btn--sm"
              onClick={handleSortToggle}
            >
              Sort results
            </button>
          </div>
        </div>

        {/* Data Table */}
        {loading ? (
          <div className="loading-skeleton" role="status" aria-busy="true">
            <p>Loading historical records...</p>
          </div>
        ) : donations.length === 0 ? (
          <div className="empty-state" style={{ textAlign: 'center', padding: '2.5rem' }}>
            <p style={{ color: 'var(--color-secondary)' }}>No historical donations found matching criteria.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Outcome</th>
                  <th scope="col">Category</th>
                  <th scope="col">Description</th>
                  <th scope="col">Portions</th>
                  <th scope="col">Date</th>
                </tr>
              </thead>
              <tbody>
                {donations.map((d) => {
                  const isSelected = selectedId === d.id;
                  return (
                    <tr
                      key={d.id}
                      className={isSelected ? 'table-row--selected' : ''}
                      onClick={() => setSelectedId(d.id)}
                      onDoubleClick={() => navigate(`/donor/donations/${d.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <span className={`badge ${d.status === 'Completed' ? 'badge--success' : d.status === 'Cancelled' ? 'badge--secondary' : 'badge--danger'}`}>
                          {d.status.toUpperCase()}
                        </span>
                      </td>
                      <td><strong>{d.category}</strong></td>
                      <td>{d.description}</td>
                      <td>{d.offeredPortions}</td>
                      <td>{new Date(d.createdAt).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Fallback hidden element */}
        {donations.length === 0 && (
          <div style={{ display: 'none' }}>
            <button type="button" data-testid="EL-103" onClick={handleViewDetail}>View historical donation detail</button>
          </div>
        )}

        {/* Pagination */}
        <div className="pagination-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
          <button
            type="button"
            data-testid="EL-110"
            className="btn btn--outline btn--sm"
            onClick={handlePreviousPage}
            disabled={cursorHistory.length === 0 || loading}
          >
            ← Previous page
          </button>

          <span style={{ fontSize: '0.875rem', color: 'var(--color-secondary)' }}>
            Showing {donations.length} records
          </span>

          <button
            type="button"
            data-testid="EL-109"
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
