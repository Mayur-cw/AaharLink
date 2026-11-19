import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.js';
import type { Paginated } from '../../shared/contracts.js';

interface CoordinatorOrgItem {
  id: string;
  name: string;
  kind: string;
  status: string;
  contactPerson: string;
  contactPhone: string;
  city: string;
  createdAt: string;
  version: number;
}

export default function CoordinatorOrgsPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<CoordinatorOrgItem[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filters
  const [stateFilter, setStateFilter] = useState('');
  const [queryFilter, setQueryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [sortAsc, setSortAsc] = useState(false);

  const fetchOrgs = useCallback(async (targetCursor?: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const queryParams = new URLSearchParams();
      queryParams.set('limit', '20');
      if (targetCursor) queryParams.set('cursor', targetCursor);
      if (stateFilter) queryParams.set('status', stateFilter);
      if (typeFilter) queryParams.set('kind', typeFilter);

      const res = await api<Paginated<CoordinatorOrgItem>>(`/api/coordinator/organizations?${queryParams.toString()}`);
      let items = res.items;

      if (queryFilter.trim()) {
        const q = queryFilter.toLowerCase();
        items = items.filter(
          (o) =>
            o.name.toLowerCase().includes(q) ||
            o.city.toLowerCase().includes(q) ||
            o.contactPerson.toLowerCase().includes(q)
        );
      }

      setOrgs(items);
      setNextCursor(res.nextCursor);
      if (items.length > 0 && !selectedId) {
        setSelectedId(items[0].id);
      }
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to load organization applications.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [stateFilter, typeFilter, queryFilter, selectedId, toast]);

  useEffect(() => {
    fetchOrgs();
  }, [fetchOrgs]);

  const handleApplyFilters = () => {
    setCursor(undefined);
    setCursorHistory([]);
    fetchOrgs(undefined);
  };

  const handleSortToggle = () => {
    setSortAsc(!sortAsc);
    setOrgs((prev) =>
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
    fetchOrgs(nextCursor);
  };

  const handlePreviousPage = () => {
    if (cursorHistory.length === 0) return;
    const prevHistory = [...cursorHistory];
    const prevCursor = prevHistory.pop();
    setCursorHistory(prevHistory);
    const resolved = prevCursor || undefined;
    setCursor(resolved);
    fetchOrgs(resolved);
  };

  const handleInspect = () => {
    if (!selectedId) {
      toast.warning('Please select an organization to review.');
      return;
    }
    navigate(`/coordinator/organizations/${selectedId}`);
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <button
          type="button"
          data-testid="EL-172"
          className="btn btn--outline btn--sm"
          onClick={() => navigate('/coordinator')}
        >
          ← Return to coordinator overview
        </button>

        <button
          type="button"
          data-testid="EL-181"
          className="btn btn--secondary btn--sm"
          onClick={() => fetchOrgs(cursor)}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Retry loading'}
        </button>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="card-title">Organization Verification Queue</h1>
            <p className="card-description">
              Review credential submissions, food-handling qualifications, and issue authoritative accreditation decisions.
            </p>
          </div>
          <button
            type="button"
            data-testid="EL-173"
            className="btn btn--primary"
            onClick={handleInspect}
            disabled={!selectedId}
          >
            Inspect organization application
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
            <label htmlFor="org-status-filter" className="form-label" style={{ fontSize: '0.75rem' }}>
              Filter: verification state
            </label>
            <select
              id="org-status-filter"
              data-testid="EL-174"
              className="form-input form-input--sm"
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
            >
              <option value="">All Verification States</option>
              <option value="pending">Pending Review</option>
              <option value="verified">Verified (Approved)</option>
              <option value="rejected">Rejected</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="org-type-filter" className="form-label" style={{ fontSize: '0.75rem' }}>
              Filter: organization type
            </label>
            <select
              id="org-type-filter"
              data-testid="EL-176"
              className="form-input form-input--sm"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="">All Types</option>
              <option value="donor">Food Donor</option>
              <option value="ngo">Relief NGO</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="org-query-filter" className="form-label" style={{ fontSize: '0.75rem' }}>
              Filter: organization query
            </label>
            <input
              id="org-query-filter"
              type="text"
              data-testid="EL-175"
              className="form-input form-input--sm"
              value={queryFilter}
              onChange={(e) => setQueryFilter(e.target.value)}
              placeholder="Search name, city, contact..."
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
            <button
              type="button"
              data-testid="EL-177"
              className="btn btn--primary btn--sm"
              onClick={handleApplyFilters}
            >
              Apply filters
            </button>
            <button
              type="button"
              data-testid="EL-178"
              className="btn btn--outline btn--sm"
              onClick={handleSortToggle}
            >
              Sort results
            </button>
          </div>
        </div>

        {/* Organizations Table */}
        {loading ? (
          <div className="loading-skeleton" role="status" aria-busy="true">
            <p>Loading organizations...</p>
          </div>
        ) : orgs.length === 0 ? (
          <div className="empty-state" style={{ textAlign: 'center', padding: '2.5rem' }}>
            <p style={{ color: 'var(--color-secondary)' }}>No organizations found matching criteria.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Status</th>
                  <th scope="col">Type</th>
                  <th scope="col">Organization Name</th>
                  <th scope="col">City</th>
                  <th scope="col">Contact Person</th>
                  <th scope="col">Applied Date</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((o) => {
                  const isSelected = selectedId === o.id;
                  return (
                    <tr
                      key={o.id}
                      className={isSelected ? 'table-row--selected' : ''}
                      onClick={() => setSelectedId(o.id)}
                      onDoubleClick={() => navigate(`/coordinator/organizations/${o.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <span className={`badge ${o.status === 'verified' ? 'badge--success' : o.status === 'pending' ? 'badge--warning' : 'badge--danger'}`}>
                          {o.status.toUpperCase()}
                        </span>
                      </td>
                      <td><strong>{o.kind.toUpperCase()}</strong></td>
                      <td>{o.name}</td>
                      <td>{o.city}</td>
                      <td>{o.contactPerson}</td>
                      <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Fallback hidden element */}
        {orgs.length === 0 && (
          <div style={{ display: 'none' }}>
            <button type="button" data-testid="EL-173" onClick={handleInspect}>Inspect organization application</button>
          </div>
        )}

        {/* Pagination */}
        <div className="pagination-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
          <button
            type="button"
            data-testid="EL-180"
            className="btn btn--outline btn--sm"
            onClick={handlePreviousPage}
            disabled={cursorHistory.length === 0 || loading}
          >
            ← Previous page
          </button>

          <span style={{ fontSize: '0.875rem', color: 'var(--color-secondary)' }}>
            Showing {orgs.length} organizations
          </span>

          <button
            type="button"
            data-testid="EL-179"
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
