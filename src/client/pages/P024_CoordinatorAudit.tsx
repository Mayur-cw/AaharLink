import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.js';
import type { RedactedAuditEvent, Paginated } from '../../shared/contracts.js';

export default function CoordinatorAuditPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [events, setEvents] = useState<RedactedAuditEvent[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filters
  const [eventFilter, setEventFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [correlationIdFilter, setCorrelationIdFilter] = useState('');
  const [sortAsc, setSortAsc] = useState(false);

  const fetchAudit = useCallback(async (targetCursor?: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const queryParams = new URLSearchParams();
      queryParams.set('limit', '25');
      if (targetCursor) queryParams.set('cursor', targetCursor);
      if (eventFilter) queryParams.set('event', eventFilter);
      if (entityFilter) queryParams.set('entity', entityFilter);
      if (dateFilter) queryParams.set('from', new Date(dateFilter).toISOString());

      const res = await api<Paginated<RedactedAuditEvent>>(`/api/coordinator/audit?${queryParams.toString()}`);
      let items = res.items;

      if (correlationIdFilter.trim()) {
        const q = correlationIdFilter.trim().toLowerCase();
        items = items.filter((e) => e.correlationId.toLowerCase().includes(q));
      }

      setEvents(items);
      setNextCursor(res.nextCursor);
      if (items.length > 0 && !selectedId) {
        setSelectedId(items[0].id);
      }
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to load audit events.';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [eventFilter, entityFilter, dateFilter, correlationIdFilter, selectedId, toast]);

  useEffect(() => {
    fetchAudit();
  }, [fetchAudit]);

  const handleApplyFilters = () => {
    setCursor(undefined);
    setCursorHistory([]);
    fetchAudit(undefined);
  };

  const handleSortToggle = () => {
    setSortAsc(!sortAsc);
    setEvents((prev) =>
      [...prev].sort((a, b) => {
        const diff = new Date(a.occurredAtUtc).getTime() - new Date(b.occurredAtUtc).getTime();
        return sortAsc ? diff : -diff;
      })
    );
  };

  const handleNextPage = () => {
    if (!nextCursor) return;
    setCursorHistory((prev) => [...prev, cursor || '']);
    setCursor(nextCursor);
    fetchAudit(nextCursor);
  };

  const handlePreviousPage = () => {
    if (cursorHistory.length === 0) return;
    const prevHistory = [...cursorHistory];
    const prevCursor = prevHistory.pop();
    setCursorHistory(prevHistory);
    const resolved = prevCursor || undefined;
    setCursor(resolved);
    fetchAudit(resolved);
  };

  const handleOpenAuditedDonation = () => {
    const ev = events.find((e) => e.id === selectedId);
    if (!ev) {
      toast.warning('Select an audit event first.');
      return;
    }
    if (ev.entityType === 'Donation' || ev.entityType === 'donation') {
      navigate(`/coordinator/donations/${ev.entityId}`);
    } else {
      toast.info(`Event belongs to entity: ${ev.entityType} (${ev.entityId})`);
    }
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <button
          type="button"
          data-testid="EL-209"
          className="btn btn--outline btn--sm"
          onClick={() => navigate('/coordinator')}
        >
          ← Return to coordinator overview
        </button>

        <button
          type="button"
          data-testid="EL-219"
          className="btn btn--secondary btn--sm"
          onClick={() => fetchAudit(cursor)}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Retry loading'}
        </button>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="card-title">Immutable Audit Trail & Event History</h1>
            <p className="card-description">
              Tamper-evident, append-only SQLite audit log recording every session mutation, claim transition, and handover verification.
            </p>
          </div>
          <button
            type="button"
            data-testid="EL-210"
            className="btn btn--primary"
            onClick={handleOpenAuditedDonation}
            disabled={!selectedId}
          >
            Open audited donation
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
            <label htmlFor="aud-event-kind" className="form-label" style={{ fontSize: '0.75rem' }}>
              Filter: event kind
            </label>
            <select
              id="aud-event-kind"
              data-testid="EL-211"
              className="form-input form-input--sm"
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
            >
              <option value="">All Event Kinds</option>
              <option value="login">login</option>
              <option value="register">register</option>
              <option value="donation_create">donation_create</option>
              <option value="donation_update">donation_update</option>
              <option value="claim_create">claim_create</option>
              <option value="claim_collect">claim_collect</option>
              <option value="claim_cancel">claim_cancel</option>
              <option value="donation_complete">donation_complete</option>
              <option value="reconcile_expired">reconcile_expired</option>
              <option value="org_decision">org_decision</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="aud-entity-type" className="form-label" style={{ fontSize: '0.75rem' }}>
              Filter: entity type
            </label>
            <select
              id="aud-entity-type"
              data-testid="EL-212"
              className="form-input form-input--sm"
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
            >
              <option value="">All Entity Types</option>
              <option value="Donation">Donation</option>
              <option value="Claim">Claim</option>
              <option value="Organization">Organization</option>
              <option value="User">User</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="aud-date" className="form-label" style={{ fontSize: '0.75rem' }}>
              Filter: date range
            </label>
            <input
              id="aud-date"
              type="date"
              data-testid="EL-213"
              className="form-input form-input--sm"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="aud-correlation" className="form-label" style={{ fontSize: '0.75rem' }}>
              Filter: correlation ID
            </label>
            <input
              id="aud-correlation"
              type="text"
              data-testid="EL-214"
              className="form-input form-input--sm"
              value={correlationIdFilter}
              onChange={(e) => setCorrelationIdFilter(e.target.value)}
              placeholder="UUID prefix..."
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
            <button
              type="button"
              data-testid="EL-215"
              className="btn btn--primary btn--sm"
              onClick={handleApplyFilters}
            >
              Apply filters
            </button>
            <button
              type="button"
              data-testid="EL-216"
              className="btn btn--outline btn--sm"
              onClick={handleSortToggle}
            >
              Sort results
            </button>
          </div>
        </div>

        {/* Audit Log Table */}
        {loading ? (
          <div className="loading-skeleton" role="status" aria-busy="true">
            <p>Querying immutable audit log...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="empty-state" style={{ textAlign: 'center', padding: '2.5rem' }}>
            <p style={{ color: 'var(--color-secondary)' }}>No audit events found matching criteria.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Event Kind</th>
                  <th scope="col">Entity</th>
                  <th scope="col">Actor Role</th>
                  <th scope="col">Reason / Transition</th>
                  <th scope="col">Correlation ID</th>
                  <th scope="col">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => {
                  const isSelected = selectedId === e.id;
                  return (
                    <tr
                      key={e.id}
                      className={isSelected ? 'table-row--selected' : ''}
                      onClick={() => setSelectedId(e.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td><strong>{e.eventType}</strong></td>
                      <td>{e.entityType} ({e.entityId.slice(0, 8)}…)</td>
                      <td><span className="badge badge--secondary">{e.actorRole}</span></td>
                      <td>
                        {e.fromStatus && e.toStatus ? `${e.fromStatus} → ${e.toStatus} ` : ''}
                        {e.reason ? `(${e.reason})` : ''}
                      </td>
                      <td><code style={{ fontSize: '0.75rem' }}>{e.correlationId.slice(0, 8)}…</code></td>
                      <td>{new Date(e.occurredAtUtc).toLocaleString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Fallback hidden element */}
        {events.length === 0 && (
          <div style={{ display: 'none' }}>
            <button type="button" data-testid="EL-210" onClick={handleOpenAuditedDonation}>Open audited donation</button>
          </div>
        )}

        {/* Pagination */}
        <div className="pagination-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
          <button
            type="button"
            data-testid="EL-218"
            className="btn btn--outline btn--sm"
            onClick={handlePreviousPage}
            disabled={cursorHistory.length === 0 || loading}
          >
            ← Previous page
          </button>

          <span style={{ fontSize: '0.875rem', color: 'var(--color-secondary)' }}>
            Showing {events.length} audit records
          </span>

          <button
            type="button"
            data-testid="EL-217"
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
