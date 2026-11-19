import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.js';
import type { DonationOwnerSummary, Paginated } from '../../shared/contracts.js';

export default function DonorDonationsPage() {
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
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [deadlineFilter, setDeadlineFilter] = useState('');
  const [sortAsc, setSortAsc] = useState(false);

  const fetchDonations = useCallback(async (targetCursor?: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const queryParams = new URLSearchParams();
      queryParams.set('limit', '20');
      if (targetCursor) queryParams.set('cursor', targetCursor);

      const res = await api<Paginated<DonationOwnerSummary>>(`/api/donor/donations?${queryParams.toString()}`);
      let items = res.items;

      // Apply client filtering if specified
      if (statusFilter) {
        items = items.filter((d) => d.status.toLowerCase() === statusFilter.toLowerCase());
      }
      if (categoryFilter) {
        items = items.filter((d) => d.category.toLowerCase() === categoryFilter.toLowerCase());
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        items = items.filter(
          (d) =>
            d.description.toLowerCase().includes(q) ||
            d.category.toLowerCase().includes(q)
        );
      }
      if (deadlineFilter) {
        const maxTime = new Date(deadlineFilter).getTime();
        items = items.filter((d) => new Date(d.pickupDeadline).getTime() <= maxTime);
      }

      setDonations(items);
      setNextCursor(res.nextCursor);
      if (items.length > 0 && !selectedId) {
        setSelectedId(items[0].id);
      }
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to load donations.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, searchQuery, deadlineFilter, selectedId, toast]);

  useEffect(() => {
    fetchDonations();
  }, [fetchDonations]);

  const handleApplyFilters = () => {
    setCursor(undefined);
    setCursorHistory([]);
    fetchDonations(undefined);
  };

  const handleSortToggle = () => {
    setSortAsc(!sortAsc);
    setDonations((prev) =>
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
    fetchDonations(nextCursor);
  };

  const handlePreviousPage = () => {
    if (cursorHistory.length === 0) return;
    const prevHistory = [...cursorHistory];
    const prevCursor = prevHistory.pop();
    setCursorHistory(prevHistory);
    const resolved = prevCursor || undefined;
    setCursor(resolved);
    fetchDonations(resolved);
  };

  const handleOpenSelected = () => {
    if (!selectedId) {
      toast.warning('Please select a donation first.');
      return;
    }
    navigate(`/donor/donations/${selectedId}`);
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <button
          type="button"
          data-testid="EL-058"
          className="btn btn--outline btn--sm"
          onClick={() => navigate('/donor')}
        >
          ← Back to donor dashboard
        </button>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            type="button"
            data-testid="EL-059"
            className="btn btn--primary btn--sm"
            onClick={() => navigate('/donor/donations/new')}
          >
            + Publish another donation
          </button>
          <button
            type="button"
            data-testid="EL-069"
            className="btn btn--secondary btn--sm"
            onClick={() => fetchDonations(cursor)}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Retry loading'}
          </button>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="card-title">Manage My Donations</h1>
            <p className="card-description">
              Review current listing status, confirm pickup readiness, and manage active relief claims.
            </p>
          </div>
          <button
            type="button"
            data-testid="EL-060"
            className="btn btn--primary"
            onClick={handleOpenSelected}
            disabled={!selectedId}
          >
            Open selected owned donation
          </button>
        </div>

        {errorMsg && (
          <div className="error-banner" role="alert" style={{ marginBottom: '1.25rem' }}>
            <span aria-hidden="true">⚠ </span>
            {errorMsg}
          </div>
        )}

        {/* Filter Controls */}
        <div className="filter-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem', padding: '1rem', background: 'var(--color-canvas)', borderRadius: 'var(--radius-sm)' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="filter-status" className="form-label" style={{ fontSize: '0.75rem' }}>
              Filter: status
            </label>
            <select
              id="filter-status"
              data-testid="EL-061"
              className="form-input form-input--sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="Available">Available</option>
              <option value="Claimed">Claimed</option>
              <option value="Pickup Confirmed">Pickup Confirmed</option>
              <option value="Collected">Collected</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Expired">Expired</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="filter-category" className="form-label" style={{ fontSize: '0.75rem' }}>
              Filter: category
            </label>
            <select
              id="filter-category"
              data-testid="EL-062"
              className="form-input form-input--sm"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">All Categories</option>
              <option value="cooked">Cooked Meals</option>
              <option value="packed">Packaged Goods</option>
              <option value="produce">Raw Produce</option>
              <option value="bakery">Bakery & Breads</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="filter-query" className="form-label" style={{ fontSize: '0.75rem' }}>
              Filter: free-text query
            </label>
            <input
              id="filter-query"
              type="text"
              data-testid="EL-063"
              className="form-input form-input--sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search description..."
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="filter-deadline" className="form-label" style={{ fontSize: '0.75rem' }}>
              Filter: deadline range
            </label>
            <input
              id="filter-deadline"
              type="datetime-local"
              data-testid="EL-064"
              className="form-input form-input--sm"
              value={deadlineFilter}
              onChange={(e) => setDeadlineFilter(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
            <button
              type="button"
              data-testid="EL-065"
              className="btn btn--primary btn--sm"
              onClick={handleApplyFilters}
            >
              Apply filters
            </button>
            <button
              type="button"
              data-testid="EL-066"
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
            <p>Loading donations...</p>
          </div>
        ) : donations.length === 0 ? (
          <div className="empty-state" style={{ textAlign: 'center', padding: '2.5rem' }}>
            <p style={{ color: 'var(--color-secondary)' }}>No donations found matching criteria.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Status</th>
                  <th scope="col">Category</th>
                  <th scope="col">Description</th>
                  <th scope="col">Portions</th>
                  <th scope="col">Pickup Deadline</th>
                  <th scope="col">Claiming Agency</th>
                  <th scope="col">Action</th>
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
                        <span className={`badge ${d.status === 'Pickup Confirmed' ? 'badge--success' : d.status === 'Claimed' ? 'badge--warning' : d.status === 'Completed' ? 'badge--info' : 'badge--secondary'}`}>
                          {d.status.toUpperCase()}
                        </span>
                      </td>
                      <td><strong>{d.category}</strong></td>
                      <td>{d.description}</td>
                      <td>{d.offeredPortions}</td>
                      <td>{new Date(d.pickupDeadline).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      <td>{d.claimedByNgoName ? <span className="badge badge--warning">{d.claimedByNgoName}</span> : 'Unclaimed'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn--outline btn--sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/donor/donations/${d.id}`);
                          }}
                        >
                          Manage →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <div className="pagination-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
          <button
            type="button"
            data-testid="EL-068"
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
            data-testid="EL-067"
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
