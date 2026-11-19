import { describe, it, expect, beforeEach } from 'vitest';
import {
  AppDatabase,
  setTestDatabase,
  repository,
} from '../../src/server/repository.js';
import { runDemoSeed } from '../../src/server/db/seed.js';

describe('Persistent SQLite Schema & Atomic Transaction Repository (T-04)', () => {
  beforeEach(() => {
    // Fresh isolated in-memory DB for each test run
    const testDb = new AppDatabase(':memory:');
    setTestDatabase(testDb);
  });

  describe('Demo Seed Invariants', () => {
    it('seeds 5 distinct role accounts and 1 available + 1 expired donation fixture', async () => {
      const result = await runDemoSeed();
      expect(result.success).toBe(true);
      expect(result.accounts).toHaveLength(5);
      expect(result.donations).toHaveLength(2);

      // Verify donor account
      const donor = repository.getUserByEmail('donor@aaharlink.example');
      expect(donor).not.toBeNull();
      expect(donor?.role).toBe('donor');

      // Verify NGO accounts
      const ngoA = repository.getUserByEmail('ngo-a@aaharlink.example');
      const ngoB = repository.getUserByEmail('ngo-b@aaharlink.example');
      expect(ngoA?.role).toBe('ngo');
      expect(ngoB?.role).toBe('ngo');

      // Verify coordinator account
      const coord = repository.getUserByEmail('coordinator@aaharlink.example');
      expect(coord?.role).toBe('coordinator');
      expect(coord?.organizationId).toBeNull();

      // Verify pending NGO account
      const ngoPending = repository.getUserByEmail('ngo-pending@aaharlink.example');
      expect(ngoPending).not.toBeNull();
      const pendingOrg = repository.getOrgById(ngoPending!.organizationId!);
      expect(pendingOrg?.status).toBe('pending');

      // Verify seeded available donation (18 portions)
      const donAvail = repository.getDonationById('don-seed-available-18');
      expect(donAvail?.status).toBe('Available');
      expect(donAvail?.offeredPortions).toBe(18);

      // Verify seeded expired donation (12 portions)
      const donExp = repository.getDonationById('don-seed-expired-12');
      expect(donExp?.status).toBe('Expired');
      expect(donExp?.offeredPortions).toBe(12);
    });
  });

  describe('Critical 8-Step Lifecycle & Race Prevention (40 Portions)', () => {
    it('guarantees atomic exclusive claim and rejects concurrent or second claim with conflict', async () => {
      await runDemoSeed();
      const donorUser = repository.getUserByEmail('donor@aaharlink.example')!;
      const ngoAUser = repository.getUserByEmail('ngo-a@aaharlink.example')!;
      const ngoBUser = repository.getUserByEmail('ngo-b@aaharlink.example')!;

      // Step 1: Donor publishes 40 meal portions
      const now = new Date();
      const donation = repository.createDonation(
        {
          id: 'don-40-portions',
          donorOrganizationId: donorUser.organizationId!,
          category: 'cooked',
          description: '40 hot packaged meal boxes from charity banquet',
          offeredPortions: 40,
          preparedAt: new Date(now.getTime() - 1800000).toISOString(),
          pickupDeadline: new Date(now.getTime() + 7200000).toISOString(), // +2 hours
          pickupAddress: 'Banquet Hall Gate 2, Station Road',
          pickupLatitude: 19.8700,
          pickupLongitude: 75.3200,
          handlingDeclaredAt: now.toISOString(),
          declarationSnapshot: {
            safePreparation: true,
            properTemperature: true,
            cleanPackaging: true,
            accurateInformation: true,
            recipientAssessmentAcknowledgement: true,
          },
          status: 'Available',
        },
        'corr-create-40',
        donorUser.id
      );

      expect(donation.status).toBe('Available');
      expect(donation.offeredPortions).toBe(40);
      expect(donation.version).toBe(1);

      // Step 2 & 3: NGO A assesses and claims all 40 portions
      const claimA = repository.createClaim(
        donation.id,
        ngoAUser.organizationId!,
        1, // expectedVersion
        'corr-claim-a',
        ngoAUser.id
      );

      expect(claimA.status).toBe('Active');
      expect(claimA.claimedPortions).toBe(40);

      // Verify donation status changed to Claimed
      const updatedDonation = repository.getDonationById(donation.id);
      expect(updatedDonation?.status).toBe('Claimed');
      expect(updatedDonation?.version).toBe(2);

      // Step 4: NGO B attempts to claim the same donation -> MUST be rejected with conflict
      expect(() => {
        repository.createClaim(
          donation.id,
          ngoBUser.organizationId!,
          1, // Stale version
          'corr-claim-b',
          ngoBUser.id
        );
      }).toThrow(/CONFLICT/);

      expect(() => {
        repository.createClaim(
          donation.id,
          ngoBUser.organizationId!,
          2, // Current version, but status is already Claimed
          'corr-claim-b',
          ngoBUser.id
        );
      }).toThrow(/CONFLICT/);

      // Step 5: Donor confirms pickup readiness and generates 6-digit one-time code
      const readyResult = repository.setDonationPickupReady(
        donation.id,
        donorUser.organizationId!,
        2, // expectedVersion
        'corr-ready-40',
        donorUser.id
      );

      expect(readyResult.handoverCode).toMatch(/^[0-9]{6}$/);
      expect(readyResult.donation.status).toBe('Pickup Confirmed');
      expect(readyResult.claim.status).toBe('Ready');

      // Step 6: NGO A confirms code with timing-safe check and enters actual 40 portions
      const handoverResult = repository.collectClaimAndCompleteDonation(
        claimA.id,
        ngoAUser.organizationId!,
        readyResult.handoverCode,
        40, // actual portions received
        readyResult.claim.version, // expected claim version (version 2 after marked Ready)
        'corr-collect-40',
        ngoAUser.id
      );

      // Step 7: Completed state with two distinct audit events
      expect(handoverResult.claim.status).toBe('Completed');
      expect(handoverResult.donation.status).toBe('Completed');
      expect(handoverResult.donation.actualCollectedPortions).toBe(40);

      // Step 8: Verify audit trail contains collected and completed events
      const audits = repository.listAuditEvents(50, undefined, 'Claim', claimA.id);
      const eventTypes = audits.items.map((a) => a.eventType);
      expect(eventTypes).toContain('claim_create');
      expect(eventTypes).toContain('handover_collected');

      const donAudits = repository.listAuditEvents(50, undefined, 'Donation', donation.id);
      const donEventTypes = donAudits.items.map((a) => a.eventType);
      expect(donEventTypes).toContain('donation_create');
      expect(donEventTypes).toContain('donation_ready');
      expect(donEventTypes).toContain('handover_completed');

      // Operational analytics reflects actual completed portions
      const analytics = repository.getOperationalAnalytics();
      expect(analytics.metrics.totalPortionsRescued).toBeGreaterThanOrEqual(40);
      expect(analytics.metrics.totalCompletedPickups).toBeGreaterThanOrEqual(1);
    });

    it('rejects claim on expired donation at database deadline', async () => {
      await runDemoSeed();
      const ngoAUser = repository.getUserByEmail('ngo-a@aaharlink.example')!;

      expect(() => {
        repository.createClaim(
          'don-seed-expired-12',
          ngoAUser.organizationId!,
          1,
          'corr-expired-claim',
          ngoAUser.id
        );
      }).toThrow(/GONE|CONFLICT/);
    });

    it('enforces NGO capacity limits atomically', async () => {
      await runDemoSeed();
      const donorUser = repository.getUserByEmail('donor@aaharlink.example')!;
      const ngoAUser = repository.getUserByEmail('ngo-a@aaharlink.example')!;
      // NGO A capacity is 60

      // Publish 70 portions (exceeds NGO A capacity of 60)
      const now = new Date();
      const bigDonation = repository.createDonation(
        {
          id: 'don-70-portions',
          donorOrganizationId: donorUser.organizationId!,
          category: 'packed',
          description: '70 food packages',
          offeredPortions: 70,
          preparedAt: now.toISOString(),
          pickupDeadline: new Date(now.getTime() + 7200000).toISOString(),
          pickupAddress: 'Storehouse 4',
          pickupLatitude: 19.8700,
          pickupLongitude: 75.3200,
          handlingDeclaredAt: now.toISOString(),
          declarationSnapshot: {
            safePreparation: true,
            properTemperature: true,
            cleanPackaging: true,
            accurateInformation: true,
            recipientAssessmentAcknowledgement: true,
          },
          status: 'Available',
        },
        'corr-70',
        donorUser.id
      );

      expect(() => {
        repository.createClaim(
          bigDonation.id,
          ngoAUser.organizationId!,
          1,
          'corr-claim-over-capacity',
          ngoAUser.id
        );
      }).toThrow(/exceeds your current capacity/);
    });
  });

  describe('Deadline Reconciliation', () => {
    it('reconciles expired available donations to Expired status', async () => {
      await runDemoSeed();
      const donorUser = repository.getUserByEmail('donor@aaharlink.example')!;

      // Create donation with deadline 1 second in the future
      const now = new Date();
      const soonExpired = repository.createDonation(
        {
          id: 'don-soon-expired',
          donorOrganizationId: donorUser.organizationId!,
          category: 'produce',
          description: 'Fresh vegetables',
          offeredPortions: 10,
          preparedAt: now.toISOString(),
          pickupDeadline: new Date(now.getTime() + 1000).toISOString(),
          pickupAddress: 'Farm Gate',
          pickupLatitude: 19.8700,
          pickupLongitude: 75.3200,
          handlingDeclaredAt: now.toISOString(),
          declarationSnapshot: {
            safePreparation: true,
            properTemperature: true,
            cleanPackaging: true,
            accurateInformation: true,
            recipientAssessmentAcknowledgement: true,
          },
          status: 'Available',
        },
        'corr-soon',
        donorUser.id
      );

      // Reconcile simulated in future
      const futureTime = new Date(now.getTime() + 5000).toISOString();
      const res = repository.reconcileExpiredDonations(futureTime);
      expect(res.reconciledCount).toBeGreaterThanOrEqual(1);

      const reconciled = repository.getDonationById(soonExpired.id);
      expect(reconciled?.status).toBe('Expired');
    });
  });
});
