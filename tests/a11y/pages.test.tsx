import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render } from '@testing-library/react';
import { axe } from 'vitest-axe';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../../src/client/context/AuthContext.js';
import { ToastProvider } from '../../src/client/context/ToastContext.js';

// Import all 26 page views
import P001_Welcome from '../../src/client/pages/P001_Welcome.js';
import P002_SignIn from '../../src/client/pages/P002_SignIn.js';
import P003_Register from '../../src/client/pages/P003_Register.js';
import P004_Account from '../../src/client/pages/P004_Account.js';
import P005_Notifications from '../../src/client/pages/P005_Notifications.js';
import P006_DonorDashboard from '../../src/client/pages/P006_DonorDashboard.js';
import P007_DonorDonations from '../../src/client/pages/P007_DonorDonations.js';
import P008_PublishDonation from '../../src/client/pages/P008_PublishDonation.js';
import P009_DonorDonationDetail from '../../src/client/pages/P009_DonorDonationDetail.js';
import P010_DonorEditDonation from '../../src/client/pages/P010_DonorEditDonation.js';
import P011_DonorHistory from '../../src/client/pages/P011_DonorHistory.js';
import P012_NgoDashboard from '../../src/client/pages/P012_NgoDashboard.js';
import P013_NgoDiscover from '../../src/client/pages/P013_NgoDiscover.js';
import P014_NgoEvaluateDonation from '../../src/client/pages/P014_NgoEvaluateDonation.js';
import P015_NgoPickups from '../../src/client/pages/P015_NgoPickups.js';
import P016_NgoHandover from '../../src/client/pages/P016_NgoHandover.js';
import P017_NgoCapacity from '../../src/client/pages/P017_NgoCapacity.js';
import P018_CoordinatorDashboard from '../../src/client/pages/P018_CoordinatorDashboard.js';
import P019_CoordinatorOrgs from '../../src/client/pages/P019_CoordinatorOrgs.js';
import P020_CoordinatorOrgReview from '../../src/client/pages/P020_CoordinatorOrgReview.js';
import P021_CoordinatorDonations from '../../src/client/pages/P021_CoordinatorDonations.js';
import P022_CoordinatorDonationInvestigate from '../../src/client/pages/P022_CoordinatorDonationInvestigate.js';
import P023_CoordinatorAnalytics from '../../src/client/pages/P023_CoordinatorAnalytics.js';
import P024_CoordinatorAudit from '../../src/client/pages/P024_CoordinatorAudit.js';
import P025_Forbidden from '../../src/client/pages/P025_Forbidden.js';
import P026_NotFound from '../../src/client/pages/P026_NotFound.js';

beforeAll(() => {
  // Suppress jsdom canvas getContext warning during axe color-contrast checks
  HTMLCanvasElement.prototype.getContext = () => null;

  // Mock global fetch for API calls in pages
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = typeof input === 'string' ? input : input.toString();

    const envelope = (data: unknown) =>
      new Response(JSON.stringify({ success: true, data, correlationId: 'test-corr-id' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'test-csrf-token' },
      });

    if (url.includes('/api/auth/session')) {
      return envelope({
        authenticated: true,
        user: { id: 'u-1', email: 'test@demo.org', role: 'donor', organizationId: 'org-1' },
        organization: { id: 'org-1', name: 'Demo Donor Kitchen', kind: 'donor', status: 'verified', city: 'Delhi', verified: true },
      });
    }

    if (url.includes('/api/account')) {
      return envelope({
        user: { id: 'u-1', email: 'test@demo.org', role: 'donor', createdAt: '2026-01-01' },
        organization: { id: 'org-1', name: 'Demo Donor Kitchen', kind: 'donor', status: 'verified', city: 'Delhi', latitude: 28.6, longitude: 77.2, version: 1, contactPerson: 'Officer', contactPhone: '+919876543210' },
      });
    }

    if (url.includes('/api/notifications')) {
      return envelope({ items: [], nextCursor: null });
    }

    if (url.includes('/api/donor/dashboard')) {
      return envelope({
        organizationName: 'Demo Donor Kitchen',
        verificationStatus: 'verified',
        activeListingsCount: 1,
        claimedPendingReadyCount: 0,
        readyForPickupCount: 0,
        completedRescuesCount: 5,
        totalPortionsRescued: 200,
        urgentDonations: [],
      });
    }

    if (url.includes('/api/donor/donations/don-1')) {
      return envelope({
        id: 'don-1',
        category: 'cooked',
        description: 'Test vegetable biryani',
        offeredPortions: 40,
        actualCollectedPortions: 0,
        preparedAt: '2026-11-19T10:00:00Z',
        pickupDeadline: '2026-11-19T18:00:00Z',
        pickupAddress: '12 Civic Lane, Delhi',
        pickupLatitude: 28.6139,
        pickupLongitude: 77.209,
        status: 'Available',
        version: 1,
        createdAt: '2026-11-19T10:00:00Z',
        handlingDeclaredAt: '2026-11-19T10:00:00Z',
        declarationSnapshot: {
          safePreparation: true,
          properTemperature: true,
          cleanPackaging: true,
          accurateInformation: true,
          recipientAssessmentAcknowledgement: true,
        },
      });
    }

    if (url.includes('/api/donor/donations')) {
      return envelope({ items: [], nextCursor: null });
    }

    if (url.includes('/api/ngo/dashboard')) {
      return envelope({
        organizationName: 'Relief NGO A',
        verificationStatus: 'verified',
        maxPortions: 200,
        remainingCapacity: 160,
        operatingRadiusKm: 25,
        activeClaimsCount: 1,
        pendingPickupCount: 0,
        completedRescuesCount: 12,
        activeClaims: [],
      });
    }

    if (url.includes('/api/ngo/donations/don-1')) {
      return envelope({
        id: 'don-1',
        category: 'cooked',
        description: 'Test vegetable biryani',
        offeredPortions: 40,
        preparedAt: '2026-11-19T10:00:00Z',
        pickupDeadline: '2026-11-19T18:00:00Z',
        approximateCity: 'Delhi',
        straightLineDistanceKm: 4.2,
        status: 'Available',
        donorOrganizationName: 'Demo Donor Kitchen',
        eligibleForMyCapacity: true,
        version: 1,
        createdAt: '2026-11-19T10:00:00Z',
      });
    }

    if (url.includes('/api/ngo/discover')) {
      return envelope({ items: [], nextCursor: null });
    }

    if (url.includes('/api/ngo/claims/claim-1')) {
      return envelope({
        id: 'claim-1',
        donationId: 'don-1',
        category: 'cooked',
        description: 'Test vegetable biryani',
        claimedPortions: 40,
        actualReceived: null,
        pickupDeadline: '2026-11-19T18:00:00Z',
        status: 'Active',
        donorOrganizationName: 'Demo Donor Kitchen',
        donorCity: 'Delhi',
        pickupAddress: '12 Civic Lane, Delhi',
        donorContactPerson: 'Chef Sharma',
        donorContactPhone: '+919876543210',
        handoverReady: false,
        handoverAttemptsRemaining: 3,
        version: 1,
        claimedAt: '2026-11-19T11:00:00Z',
        readyAt: null,
        declarationSnapshot: {
          safePreparation: true,
          properTemperature: true,
          cleanPackaging: true,
          accurateInformation: true,
          recipientAssessmentAcknowledgement: true,
        },
      });
    }

    if (url.includes('/api/ngo/claims')) {
      return envelope({ items: [], nextCursor: null });
    }

    if (url.includes('/api/ngo/capacity')) {
      return envelope({
        maxPortions: 200,
        operatingRadiusKm: 25,
        latitude: 28.6,
        longitude: 77.2,
        activeReservedPortions: 40,
        availableRemainingPortions: 160,
        version: 1,
      });
    }

    if (url.includes('/api/coordinator/dashboard')) {
      return envelope({
        pendingOrganizationsCount: 0,
        activeDonationsCount: 3,
        urgentExceptionsCount: 0,
        completedRescuesCount: 15,
        totalPortionsRescued: 540,
        recentExceptions: [],
      });
    }

    if (url.includes('/api/coordinator/organizations/org-1')) {
      return envelope({
        id: 'org-1',
        name: 'Demo Donor Kitchen',
        kind: 'donor',
        status: 'verified',
        city: 'Delhi',
        contactPerson: 'Chef Sharma',
        contactPhone: '+919876543210',
        latitude: 28.6,
        longitude: 77.2,
        version: 1,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      });
    }

    if (url.includes('/api/coordinator/organizations')) {
      return envelope({ items: [], nextCursor: null });
    }

    if (url.includes('/api/coordinator/donations/don-1')) {
      return envelope({
        id: 'don-1',
        donorOrganizationName: 'Demo Donor Kitchen',
        category: 'cooked',
        description: 'Test vegetable biryani',
        offeredPortions: 40,
        actualCollectedPortions: 0,
        status: 'Available',
        pickupDeadline: '2026-11-19T18:00:00Z',
        pickupAddress: '12 Civic Lane, Delhi',
        pickupLatitude: 28.6,
        pickupLongitude: 77.2,
        preparedAt: '2026-11-19T10:00:00Z',
        handlingDeclaredAt: '2026-11-19T10:00:00Z',
        version: 1,
        createdAt: '2026-11-19T10:00:00Z',
        declarationSnapshot: {
          safePreparation: true,
          properTemperature: true,
          cleanPackaging: true,
          accurateInformation: true,
          recipientAssessmentAcknowledgement: true,
        },
        auditTrail: [],
      });
    }

    if (url.includes('/api/coordinator/donations')) {
      return envelope({ items: [], nextCursor: null });
    }

    if (url.includes('/api/coordinator/analytics')) {
      return envelope({
        metrics: {
          totalPortionsOffered: 540,
          totalPortionsRescued: 540,
          totalCompletedPickups: 15,
          rescueEfficiencyPercentage: 100,
          averageHandoverTimeMinutes: 22,
          expiredDonationsCount: 0,
        },
        byCategory: [],
        byCity: [],
      });
    }

    if (url.includes('/api/coordinator/audit')) {
      return envelope({ items: [], nextCursor: null });
    }

    return envelope({});
  });
});

function renderWithProviders(element: React.ReactElement, initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <ToastProvider>
          {element}
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('T-QA-2: Contractual Accessibility & Screen Reader Audit (P-001..P-026)', () => {
  it('P-001: Welcome and service orientation has zero axe violations', async () => {
    const view = renderWithProviders(<P001_Welcome />);
    const results = await axe(view.container);
    expect(results.violations).toHaveLength(0);
  });

  it('P-002: Sign in has zero axe violations', async () => {
    const view = renderWithProviders(<P002_SignIn />);
    const results = await axe(view.container);
    expect(results.violations).toHaveLength(0);
  });

  it('P-003: Create organization has zero axe violations', async () => {
    const view = renderWithProviders(<P003_Register />);
    const results = await axe(view.container);
    expect(results.violations).toHaveLength(0);
  });

  it('P-004: My organization and account has zero axe violations', async () => {
    const view = renderWithProviders(<P004_Account />);
    const results = await axe(view.container);
    expect(results.violations).toHaveLength(0);
  });

  it('P-005: Notification inbox has zero axe violations', async () => {
    const view = renderWithProviders(<P005_Notifications />);
    const results = await axe(view.container);
    expect(results.violations).toHaveLength(0);
  });

  it('P-006: Donor command center has zero axe violations', async () => {
    const view = renderWithProviders(<P006_DonorDashboard />);
    const results = await axe(view.container);
    expect(results.violations).toHaveLength(0);
  });

  it('P-007: Manage my donations has zero axe violations', async () => {
    const view = renderWithProviders(<P007_DonorDonations />);
    const results = await axe(view.container);
    expect(results.violations).toHaveLength(0);
  });

  it('P-008: Publish a donation has zero axe violations', async () => {
    const view = renderWithProviders(<P008_PublishDonation />);
    const results = await axe(view.container);
    expect(results.violations).toHaveLength(0);
  });

  it('P-009: Donor donation and pickup progress has zero axe violations', async () => {
    const view = renderWithProviders(
      <Routes>
        <Route path="/donor/donations/:id" element={<P009_DonorDonationDetail />} />
      </Routes>,
      '/donor/donations/don-1'
    );
    const results = await axe(view.container);
    expect(results.violations).toHaveLength(0);
  });

  it('P-010: Edit available donation has zero axe violations', async () => {
    const view = renderWithProviders(
      <Routes>
        <Route path="/donor/donations/:id/edit" element={<P010_DonorEditDonation />} />
      </Routes>,
      '/donor/donations/don-1/edit'
    );
    const results = await axe(view.container);
    expect(results.violations).toHaveLength(0);
  });

  it('P-011: Past donations and outcomes has zero axe violations', async () => {
    const view = renderWithProviders(<P011_DonorHistory />);
    const results = await axe(view.container);
    expect(results.violations).toHaveLength(0);
  });

  it('P-012: NGO mission control has zero axe violations', async () => {
    const view = renderWithProviders(<P012_NgoDashboard />);
    const results = await axe(view.container);
    expect(results.violations).toHaveLength(0);
  });

  it('P-013: Find available food / Discovery has zero axe violations', async () => {
    const view = renderWithProviders(<P013_NgoDiscover />);
    const results = await axe(view.container);
    expect(results.violations).toHaveLength(0);
  });

  it('P-014: Evaluate available donation has zero axe violations', async () => {
    const view = renderWithProviders(
      <Routes>
        <Route path="/ngo/donations/:id" element={<P014_NgoEvaluateDonation />} />
      </Routes>,
      '/ngo/donations/don-1'
    );
    const results = await axe(view.container);
    expect(results.violations).toHaveLength(0);
  });

  it('P-015: My pickups and claims has zero axe violations', async () => {
    const view = renderWithProviders(<P015_NgoPickups />);
    const results = await axe(view.container);
    expect(results.violations).toHaveLength(0);
  });

  it('P-016: Handover and collection has zero axe violations', async () => {
    const view = renderWithProviders(
      <Routes>
        <Route path="/ngo/pickups/:id" element={<P016_NgoHandover />} />
      </Routes>,
      '/ngo/pickups/claim-1'
    );
    const results = await axe(view.container);
    expect(results.violations).toHaveLength(0);
  });

  it('P-017: NGO capacity and preferences has zero axe violations', async () => {
    const view = renderWithProviders(<P017_NgoCapacity />);
    const results = await axe(view.container);
    expect(results.violations).toHaveLength(0);
  });

  it('P-018: Coordinator operations overview has zero axe violations', async () => {
    const view = renderWithProviders(<P018_CoordinatorDashboard />);
    const results = await axe(view.container);
    expect(results.violations).toHaveLength(0);
  });

  it('P-019: Organization verification queue has zero axe violations', async () => {
    const view = renderWithProviders(<P019_CoordinatorOrgs />);
    const results = await axe(view.container);
    expect(results.violations).toHaveLength(0);
  });

  it('P-020: Review one organization has zero axe violations', async () => {
    const view = renderWithProviders(
      <Routes>
        <Route path="/coordinator/organizations/:id" element={<P020_CoordinatorOrgReview />} />
      </Routes>,
      '/coordinator/organizations/org-1'
    );
    const results = await axe(view.container);
    expect(results.violations).toHaveLength(0);
  });

  it('P-021: All donations and urgent claims has zero axe violations', async () => {
    const view = renderWithProviders(<P021_CoordinatorDonations />);
    const results = await axe(view.container);
    expect(results.violations).toHaveLength(0);
  });

  it('P-022: Investigate donation or claim has zero axe violations', async () => {
    const view = renderWithProviders(
      <Routes>
        <Route path="/coordinator/donations/:id" element={<P022_CoordinatorDonationInvestigate />} />
      </Routes>,
      '/coordinator/donations/don-1'
    );
    const results = await axe(view.container);
    expect(results.violations).toHaveLength(0);
  });

  it('P-023: Operational impact analytics has zero axe violations', async () => {
    const view = renderWithProviders(<P023_CoordinatorAnalytics />);
    const results = await axe(view.container);
    expect(results.violations).toHaveLength(0);
  });

  it('P-024: Audit and event history has zero axe violations', async () => {
    const view = renderWithProviders(<P024_CoordinatorAudit />);
    const results = await axe(view.container);
    expect(results.violations).toHaveLength(0);
  });

  it('P-025: Access denied guidance has zero axe violations', async () => {
    const view = renderWithProviders(<P025_Forbidden />);
    const results = await axe(view.container);
    expect(results.violations).toHaveLength(0);
  });

  it('P-026: Page not found guidance has zero axe violations', async () => {
    const view = renderWithProviders(<P026_NotFound />);
    const results = await axe(view.container);
    expect(results.violations).toHaveLength(0);
  });
});
