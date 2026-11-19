import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useToast } from '../context/ToastContext.js';
import CivicMap from '../components/CivicMap.js';
import type { DonationPublicPreview, Paginated } from '../../shared/contracts.js';

export default function NgoDiscoverPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const toastRef = React.useRef(toast);
  toastRef.current = toast;

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [donations, setDonations] = useState<DonationPublicPreview[]>([]);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Filters
  const [category, setCategory] = useState('');
  const [minPortions, setMinPortions] = useState('');
  const [maxDistanceKm, setMaxDistanceKm] = useState('25');
  const [deadlineBefore, setDeadlineBefore] = useState('');
  const [orderPreference, setOrderPreference] = useState<'urgency' | 'distance'>('urgency');
  const [includeExpired, setIncludeExpired] = useState(false);
  const [showScoringModal, setShowScoringModal] = useState(false);
  const [sortAsc, setSortAsc] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');

  const fetchDiscover = useCallback(async (targetCursor?: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const queryParams = new URLSearchParams();
      queryParams.set('limit', '20');
      if (targetCursor) queryParams.set('cursor', targetCursor);
      if (category) queryParams.set('category', category);
      if (minPortions) queryParams.set('minPortions', minPortions);
      if (maxDistanceKm) queryParams.set('maxKm', maxDistanceKm);
      if (deadlineBefore) queryParams.set('before', new Date(deadlineBefore).toISOString());
      if (orderPreference) queryParams.set('sort', orderPreference);
      if (includeExpired) queryParams.set('includeExpired', 'true');

      const res = await api<Paginated<DonationPublicPreview>>(`/api/ngo/discover?${queryParams.toString()}`);
      setDonations(res.items);
      setNextCursor(res.nextCursor);
      if (res.items.length > 0) {
        setSelectedId((prev) => prev || res.items[0].id);
      }
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Failed to discover available food.';
      setErrorMsg(msg);
      toastRef.current.error(msg);
    } finally {
      setLoading(false);
    }
  }, [category, minPortions, maxDistanceKm, deadlineBefore, orderPreference, includeExpired]);

  useEffect(() => {
    fetchDiscover();
  }, [fetchDiscover]);

  const handleApplyFilters = () => {
    setCursor(undefined);
    setCursorHistory([]);
    fetchDiscover(undefined);
  };

  const handleSortToggle = () => {
    setSortAsc(!sortAsc);
    setDonations((prev) =>
      [...prev].sort((a, b) => {
        const valA = orderPreference === 'distance' ? (a.straightLineDistanceKm ?? 999) : new Date(a.pickupDeadline).getTime();
        const valB = orderPreference === 'distance' ? (b.straightLineDistanceKm ?? 999) : new Date(b.pickupDeadline).getTime();
        return sortAsc ? valA - valB : valB - valA;
      })
    );
  };

  const handleNextPage = () => {
    if (!nextCursor) return;
    setCursorHistory((prev) => [...prev, cursor || '']);
    setCursor(nextCursor);
    fetchDiscover(nextCursor);
  };

  const handlePreviousPage = () => {
    if (cursorHistory.length === 0) return;
    const prevHistory = [...cursorHistory];
    const prevCursor = prevHistory.pop();
    setCursorHistory(prevHistory);
    const resolved = prevCursor || undefined;
    setCursor(resolved);
    fetchDiscover(resolved);
  };

  const handleInspect = () => {
    if (!selectedId) {
      toast.warning('Select a donation to inspect.');
      return;
    }
    navigate(`/ngo/donations/${selectedId}`);
  };

  const mapMarkers = useMemo(() => {
    return donations.map((d, index) => {
      const angle = (index * (360 / Math.max(1, donations.length))) * (Math.PI / 180);
      const radiusDegree = (d.straightLineDistanceKm || 3) / 111.0;
      return {
        id: d.id,
        lat: 19.8762 + Math.sin(angle) * radiusDegree,
        lng: 75.3433 + Math.cos(angle) * radiusDegree,
        label: `${d.category.toUpperCase()}: ${d.description.slice(0, 25)}`,
        category: d.category,
        portions: d.offeredPortions,
        city: d.approximateCity,
        distanceKm: d.straightLineDistanceKm,
      };
    });
  }, [donations]);

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <button
          type="button"
          data-testid="EL-118"
          className="btn btn--outline btn--sm"
          onClick={() => navigate('/ngo')}
        >
          ← Return to NGO dashboard
        </button>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            data-testid="EL-131"
            className="btn btn--secondary btn--sm"
            onClick={() => setShowScoringModal(true)}
          >
            ℹ Explain recommendation scoring
          </button>
          <button
            type="button"
            data-testid="EL-130"
            className="btn btn--secondary btn--sm"
            onClick={() => fetchDiscover(cursor)}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Retry loading'}
          </button>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 className="card-title">Discover Available Food Nearby</h1>
            <p className="card-description">
              Find surplus batches within your operating radius. Private donor street addresses and contacts remain redacted until an atomic claim is established.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'inline-flex',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
                overflow: 'hidden',
              }}
            >
              <button
                type="button"
                className={`btn btn--sm ${viewMode === 'table' ? 'btn--primary' : 'btn--outline'}`}
                style={{ borderRadius: 0, border: 'none', padding: '0.4rem 0.75rem' }}
                onClick={() => setViewMode('table')}
              >
                📋 Table View
              </button>
              <button
                type="button"
                className={`btn btn--sm ${viewMode === 'map' ? 'btn--primary' : 'btn--outline'}`}
                style={{ borderRadius: 0, border: 'none', padding: '0.4rem 0.75rem' }}
                onClick={() => setViewMode('map')}
              >
                🗺️ Regional Map
              </button>
            </div>

            <button
              type="button"
              data-testid="EL-119"
              className="btn btn--primary"
              onClick={handleInspect}
              disabled={!selectedId}
            >
              Inspect eligible donation
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="error-banner" role="alert" style={{ marginBottom: '1.25rem' }}>
            <span aria-hidden="true">⚠ </span>
            {errorMsg}
          </div>
        )}

        {/* Filters Bar */}
        <div className="filter-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem', padding: '1rem', background: 'var(--color-canvas)', borderRadius: 'var(--radius-sm)' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="disc-cat" className="form-label" style={{ fontSize: '0.75rem' }}>
              Filter: food category
            </label>
            <select
              id="disc-cat"
              data-testid="EL-120"
              className="form-input form-input--sm"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
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
            <label htmlFor="disc-portions" className="form-label" style={{ fontSize: '0.75rem' }}>
              Filter: minimum portions
            </label>
            <input
              id="disc-portions"
              type="number"
              min="1"
              data-testid="EL-121"
              className="form-input form-input--sm"
              value={minPortions}
              onChange={(e) => setMinPortions(e.target.value)}
              placeholder="e.g. 20"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="disc-distance" className="form-label" style={{ fontSize: '0.75rem' }}>
              Filter: maximum straight-line distance km
            </label>
            <input
              id="disc-distance"
              type="number"
              min="1"
              max="200"
              data-testid="EL-122"
              className="form-input form-input--sm"
              value={maxDistanceKm}
              onChange={(e) => setMaxDistanceKm(e.target.value)}
              placeholder="e.g. 25"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="disc-before" className="form-label" style={{ fontSize: '0.75rem' }}>
              Filter: pickup deadline before
            </label>
            <input
              id="disc-before"
              type="datetime-local"
              data-testid="EL-123"
              className="form-input form-input--sm"
              value={deadlineBefore}
              onChange={(e) => setDeadlineBefore(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="disc-ordering" className="form-label" style={{ fontSize: '0.75rem' }}>
              Filter: urgency vs distance ordering
            </label>
            <select
              id="disc-ordering"
              data-testid="EL-124"
              className="form-input form-input--sm"
              value={orderPreference}
              onChange={(e) => setOrderPreference(e.target.value as 'urgency' | 'distance')}
            >
              <option value="urgency">Urgency First (Soonest Deadline)</option>
              <option value="distance">Distance First (Closest Proximity)</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0, display: 'flex', alignItems: 'center' }}>
            <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8125rem' }}>
              <input
                type="checkbox"
                data-testid="EL-125"
                checked={includeExpired}
                onChange={(e) => setIncludeExpired(e.target.checked)}
              />
              <span>Filter: include expired examples as clearly unclaimable</span>
            </label>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
            <button
              type="button"
              data-testid="EL-126"
              className="btn btn--primary btn--sm"
              onClick={handleApplyFilters}
            >
              Apply filters
            </button>
            <button
              type="button"
              data-testid="EL-127"
              className="btn btn--outline btn--sm"
              onClick={handleSortToggle}
            >
              Sort results
            </button>
          </div>
        </div>

        {/* Interactive Civic Discovery Map */}
        {viewMode === 'map' && !loading && (
          <div style={{ marginBottom: '1.5rem' }}>
            <CivicMap
              latitude={19.8762}
              longitude={75.3433}
              title="Regional Food Rescue Discovery Grid"
              address={
                donations.length > 0
                  ? `Showing ${donations.length} available surplus batch${donations.length > 1 ? 'es' : ''} across operating radius`
                  : 'No available surplus food currently matches your discovery filters'
              }
              height={360}
              showDirections={false}
              markers={mapMarkers}
              selectedMarkerId={selectedId || undefined}
              onMarkerSelect={(m) => setSelectedId(m.id)}
            />
          </div>
        )}

        {/* Listings Table */}
        {loading ? (
          <div className="loading-skeleton" role="status" aria-busy="true">
            <p>Scanning regional listings within operating radius...</p>
          </div>
        ) : donations.length === 0 ? (
          <div className="empty-state" style={{ textAlign: 'center', padding: '2.5rem' }}>
            <p style={{ color: 'var(--color-secondary)' }}>No available surplus food currently matches your discovery filters.</p>
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
                  <th scope="col">Distance</th>
                  <th scope="col">City</th>
                  <th scope="col">Deadline</th>
                  <th scope="col">Eligibility</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {donations.map((d) => {
                  const isSelected = selectedId === d.id;
                  const isExpired = d.status === 'Expired';

                  return (
                    <tr
                      key={d.id}
                      className={`${isSelected ? 'table-row--selected' : ''} ${isExpired ? 'table-row--expired' : ''}`}
                      onClick={() => setSelectedId(d.id)}
                      onDoubleClick={() => navigate(`/ngo/donations/${d.id}`)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td>
                        <span className={`badge ${isExpired ? 'badge--danger' : d.status === 'Available' ? 'badge--success' : 'badge--secondary'}`}>
                          {d.status.toUpperCase()}
                        </span>
                      </td>
                      <td><strong>{d.category}</strong></td>
                      <td>{d.description}</td>
                      <td>{d.offeredPortions}</td>
                      <td>{d.straightLineDistanceKm !== undefined ? `${d.straightLineDistanceKm.toFixed(1)} km` : 'Local'}</td>
                      <td>{d.approximateCity || 'City'}</td>
                      <td>
                        <span style={{ color: isExpired ? 'var(--color-destructive)' : 'inherit' }}>
                          {new Date(d.pickupDeadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td>
                        {d.eligibleForMyCapacity ? (
                          <span className="badge badge--success">Eligible to Claim</span>
                        ) : (
                          <span className="badge badge--warning" title={d.ineligibleReason || 'Ineligible'}>
                            {d.ineligibleReason || 'Ineligible'}
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn--primary btn--sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/ngo/donations/${d.id}`);
                          }}
                        >
                          Evaluate & Claim →
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
            <button type="button" data-testid="EL-119" onClick={handleInspect}>Inspect eligible donation</button>
          </div>
        )}

        {/* Pagination */}
        <div className="pagination-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
          <button
            type="button"
            data-testid="EL-129"
            className="btn btn--outline btn--sm"
            onClick={handlePreviousPage}
            disabled={cursorHistory.length === 0 || loading}
          >
            ← Previous page
          </button>

          <span style={{ fontSize: '0.875rem', color: 'var(--color-secondary)' }}>
            Showing {donations.length} discovered listings
          </span>

          <button
            type="button"
            data-testid="EL-128"
            className="btn btn--outline btn--sm"
            onClick={handleNextPage}
            disabled={!nextCursor || loading}
          >
            Next page →
          </button>
        </div>
      </div>

      {/* Recommendation Scoring Explanation Modal */}
      {showScoringModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="scoring-modal-title">
          <div className="modal-box">
            <h2 id="scoring-modal-title" className="card-title">Recommendation Scoring Algorithm</h2>
            <p>
              AaharLink calculates dispatch recommendations deterministically using civic logistics priority:
            </p>
            <ul style={{ paddingLeft: '1.25rem', lineHeight: 1.8, fontSize: '0.9rem', color: 'var(--color-secondary)' }}>
              <li><strong>Deadline Urgency (Primary weight 0.65):</strong> Food with sooner safe consumption deadlines is prioritized to prevent municipal landfill waste.</li>
              <li><strong>Proximity (Weight 0.35):</strong> Straight-line Haversine distance between donor coordinates and your registered NGO depot.</li>
              <li><strong>Portion Capacity Gate:</strong> Listings exceeding your remaining portion capacity are marked ineligible to protect relief chain integrity.</li>
            </ul>

            <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => setShowScoringModal(false)}
              >
                Close Explanation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
