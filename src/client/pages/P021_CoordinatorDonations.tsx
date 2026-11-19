import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.js';
import type { Paginated } from '../../shared/contracts.js';

interface CoordinatorDonationItem {
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

export default function CoordinatorDonationsPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [donations, setDonations] = useState<CoordinatorDonationItem[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [disputeOnly, setDisputeOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [deadlineSort, setDeadlineSort] = useState<'asc' | 'desc'>('asc');
  const [sortAsc, setSortAsc] = useState(false);

  const fetchDonations = useCallback(async (targetCursor?: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const queryParams = new URLSearchParams();
      queryParams.set('limit', '20');
      if (targetCursor) queryParams.set('cursor', targetCursor);
      if (statusFilter) queryParams.set('status', statusFilter);
      if (disputeOnly) queryParams.set('disputed', 'true');

      const res = await api<Paginated<CoordinatorDonationItem>>(`/api/coordinator/donations?${queryParams.toString()}`);
      let items = res.items;

      if (urgentOnly) {
        const twoHoursFromNow = Date.now() + 2 * 3600 * 1000;
        items = items.filter(
          (d) =>
            new Date(d.pickupDeadline).getTime() <= twoHoursFromNow &&
            d.status !== 'Completed' &&
            d.status !== 'Expired'
        );
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        items = items.filter(
          (d) =>
            d.description.toLowerCase().includes(q) ||
            d.donorOrgName.toLowerCase().includes(q) ||
            (d.category || d.foodCategory || '').toLowerCase().includes(q)
        );
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
  }, [statusFilter, disputeOnly, urgentOnly, searchQuery, selectedId, toast]);

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

  const handleInspect = () => {
    if (!selectedId) {
      toast.warning('Select a donation to investigate.');
      return;
    }
    navigate(`/coordinator/donations/${selectedId}`);
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <button
          type="button"
          data-testid="EL-187"
          className="btn btn--outline btn--sm"
          onClick={() => navigate('/coordinator')}
        >
          ← Return to coordinator overview
        </button>

        <button
          type="button"
          data-testid="EL-198"
          className="btn btn--secondary btn--sm"
          onClick={() => fetchDonations(cursor)}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Retry loading'}
        </button>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="card-title">All Donations and Urgent Claims</h1>
            <p className="card-description">
              Platform-wide visibility into food rescue lifecycles, active claims, expired batches, and delivery exceptions.
            </p>
          </div>
          <button
            type="button"
            data-testid="EL-188"
            className="btn btn--primary"
            onClick={handleInspect}
            disabled={!selectedId}
          >
            Inspect donation exception
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
            <label htmlFor="cd-status" className="form-label" style={{ fontSize: '0.75rem' }}>
              Filter: status
            </label>
            <select
              id="cd-status"
              data-testid="EL-189"
              className="form-input form-input--sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="Available">Available</option>
              <option value="Claimed">Claimed</option>
              <option value="Ready">Ready</option>
              <option value="Completed">Completed</option>
              <option value="Expired">Expired</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Disputed">Disputed</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0, display: 'flex', alignItems: 'center' }}>
            <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8125rem' }}>
              <input
                type="checkbox"
                data-testid="EL-190"
                checked={urgentOnly}
                onChange={(e) => setUrgentOnly(e.target.checked)}
              />
              <span>Filter: urgent before deadline (&lt;2h)</span>
            </label>
          </div>

          <div className="form-group" style={{ marginBottom: 0, display: 'flex', alignItems: 'center' }}>
            <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8125rem' }}>
              <input
                type="checkbox"
                data-testid="EL-191"
                checked={disputeOnly}
                onChange={(e) => setDisputeOnly(e.target.checked)}
              />
              <span>Filter: dispute marker</span>
            </label>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="cd-search" className="form-label" style={{ fontSize: '0.75rem' }}>
              Filter: text search
            </label>
            <input
              id="cd-search"
              type="text"
              data-testid="EL-192"
              className="form-input form-input--sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search donor, item..."
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="cd-sort-order" className="form-label" style={{ fontSize: '0.75rem' }}>
              Filter: deadline sort
            </label>
            <select
              id="cd-sort-order"
              data-testid="EL-193"
              className="form-input form-input--sm"
              value={deadlineSort}
              onChange={(e) => setDeadlineSort(e.target.value as 'asc' | 'desc')}
            >
              <option value="asc">Deadline (Ascending - Soonest)</option>
              <option value="desc">Deadline (Descending - Furthest)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
            <button
              type="button"
              data-testid="EL-194"
              className="btn btn--primary btn--sm"
              onClick={handleApplyFilters}
            >
              Apply filters
            </button>
            <button
              type="button"
              data-testid="EL-195"
              className="btn btn--outline btn--sm"
              onClick={handleSortToggle}
            >
              Sort results
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="loading-skeleton" role="status" aria-busy="true">
            <p>Loading platform donations...</p>
          </div>
        ) : donations.length === 0 ? (
          <div className="empty-state" style={{ textAlign: 'center', padding: '2.5rem' }}>
            <p style={{ color: 'var(--color-secondary)' }}>No donations match the specified criteria.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Status</th>
                  <th scope="col">Donor</th>
                  <th scope="col">Category</th>
                  <th scope="col">Description</th>
                  <th scope="col">Portions</th>
                  <th scope="col">Pickup Deadline</th>
                  <th scope="col">Claiming NGO</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {donations.map((d) => {
                  const isSelected = selectedId === d.id;
                  const isDisputed = d.status === 'Disputed';

                  return (
                    <tr
                      key={d.id}
                      className={`${isSelected ? 'table-row--selected' : ''} ${isDisputed ? 'table-row--danger' : ''}`}
                      onClick={() => setSelectedId(d.id)}
                      onDoubleClick={() => navigate(`/coordinator/donations/${d.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <span className={`badge ${d.status === 'Completed' ? 'badge--success' : d.status === 'Disputed' ? 'badge--danger' : d.status === 'Ready' ? 'badge--info' : 'badge--secondary'}`}>
                          {d.status.toUpperCase()}
                        </span>
                      </td>
                      <td><strong>{d.donorOrgName}</strong></td>
                      <td>
                        <span className="badge badge--info" style={{ textTransform: 'capitalize' }}>
                          {d.category || d.foodCategory || 'Standard'}
                        </span>
                      </td>
                      <td>{d.description}</td>
                      <td>{d.offeredPortions ?? d.portionsOffered ?? 0} portions</td>
                      <td>{new Date(d.pickupDeadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                      <td>{d.claimNgoName || (d.claimStatus ? `Claim: ${d.claimStatus}` : '—')}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn--outline btn--sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/coordinator/donations/${d.id}`);
                          }}
                        >
                          Investigate →
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
        {donations.length === 0 && (
          <div style={{ display: 'none' }}>
            <button type="button" data-testid="EL-188" onClick={handleInspect}>Inspect donation exception</button>
          </div>
        )}

        {/* Pagination */}
        <div className="pagination-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
          <button
            type="button"
            data-testid="EL-197"
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
            data-testid="EL-196"
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
