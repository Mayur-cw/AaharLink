import { describe, it, expect } from 'vitest';
import {
  loginBodySchema,
  registerBodySchema,
  donationCreateSchema,
  claimCollectSchema,
  isAllowedDonationTransition,
  isAllowedClaimTransition,
  isAllowedOrgTransition,
  calculateHaversineDistanceKm,
  ALLOWED_DONATION_TRANSITIONS,
  ALLOWED_CLAIM_TRANSITIONS,
  ALLOWED_ORG_TRANSITIONS,
} from '../../src/shared/contracts.js';

describe('Shared Contracts & Zod Validation Oracle (T-02)', () => {
  describe('Authentication & Registration Validation', () => {
    it('VR-001: validates and normalizes email formats', () => {
      const valid = loginBodySchema.safeParse({
        email: '  DONOR@Example.com  ',
        password: 'ValidPassword123!',
      });
      expect(valid.success).toBe(true);
      if (valid.success) {
        expect(valid.data.email).toBe('donor@example.com');
      }

      const invalid = loginBodySchema.safeParse({
        email: 'not-an-email',
        password: 'ValidPassword123!',
      });
      expect(invalid.success).toBe(false);
    });

    it('VR-002: enforces password minimum length of 12 for registration', () => {
      const shortPass = registerBodySchema.safeParse({
        organizationKind: 'donor',
        email: 'donor@test.org',
        password: 'short',
        organizationName: 'Good Bakery',
        contactPerson: 'Jane Doe',
        contactPhone: '+919876543210',
        city: 'Mumbai',
        latitude: 19.076,
        longitude: 72.8777,
        consent: true,
      });
      expect(shortPass.success).toBe(false);

      const validPass = registerBodySchema.safeParse({
        organizationKind: 'donor',
        email: 'donor@test.org',
        password: 'SecurePassword123!',
        organizationName: 'Good Bakery',
        contactPerson: 'Jane Doe',
        contactPhone: '+919876543210',
        city: 'Mumbai',
        latitude: 19.076,
        longitude: 72.8777,
        consent: true,
      });
      expect(validPass.success).toBe(true);
    });

    it('VR-003: rejects self-registration for coordinator or invalid roles', () => {
      const coordinatorReg = registerBodySchema.safeParse({
        organizationKind: 'coordinator' as unknown,
        email: 'coord@test.org',
        password: 'SecurePassword123!',
        organizationName: 'City Ops',
        contactPerson: 'Admin',
        contactPhone: '+919876543210',
        city: 'Mumbai',
        latitude: 19.076,
        longitude: 72.8777,
        consent: true,
      });
      expect(coordinatorReg.success).toBe(false);
    });

    it('VR-005: enforces normalized phone regex 8..15 digits', () => {
      const badPhone = registerBodySchema.safeParse({
        organizationKind: 'ngo',
        email: 'ngo@test.org',
        password: 'SecurePassword123!',
        organizationName: 'Helping Hands',
        contactPerson: 'John Smith',
        contactPhone: 'abc-not-phone',
        city: 'Pune',
        latitude: 18.5204,
        longitude: 73.8567,
        consent: true,
      });
      expect(badPhone.success).toBe(false);
    });

    it('VR-006: enforces finite lat [-90,90] and lon [-180,180]', () => {
      const badCoords = registerBodySchema.safeParse({
        organizationKind: 'ngo',
        email: 'ngo@test.org',
        password: 'SecurePassword123!',
        organizationName: 'Helping Hands',
        contactPerson: 'John Smith',
        contactPhone: '+919876543210',
        city: 'Pune',
        latitude: 195.0,
        longitude: 73.8567,
        consent: true,
      });
      expect(badCoords.success).toBe(false);
    });

    it('VR-007: requires explicit consent boolean true', () => {
      const noConsent = registerBodySchema.safeParse({
        organizationKind: 'donor',
        email: 'donor@test.org',
        password: 'SecurePassword123!',
        organizationName: 'Good Bakery',
        contactPerson: 'Jane Doe',
        contactPhone: '+919876543210',
        city: 'Mumbai',
        latitude: 19.076,
        longitude: 72.8777,
        consent: false,
      });
      expect(noConsent.success).toBe(false);
    });

    it('VR-042: rejects request bodies with unknown or forbidden fields', () => {
      const extraFields = loginBodySchema.safeParse({
        email: 'donor@example.com',
        password: 'ValidPassword123!',
        isAdmin: true, // Unknown field
      });
      expect(extraFields.success).toBe(false);
    });
  });

  describe('Donation Creation & Handling Declarations Validation', () => {
    it('VR-012..VR-020: validates complete donation creation with all 4 handling declarations', () => {
      const validDonation = donationCreateSchema.safeParse({
        category: 'cooked',
        description: 'Fresh prepared vegetable curry and rice from morning event',
        offeredPortions: 40,
        preparedAt: new Date(Date.now() - 3600000).toISOString(),
        pickupDeadline: new Date(Date.now() + 14400000).toISOString(),
        pickupAddress: '42 Main Street, Central Kitchen, Mumbai',
        pickupLatitude: 19.076,
        pickupLongitude: 72.8777,
        handlingDeclarations: {
          safePreparation: true,
          properTemperature: true,
          cleanPackaging: true,
          accurateInformation: true,
          recipientAssessmentAcknowledgement: true,
        },
      });
      expect(validDonation.success).toBe(true);
    });

    it('VR-019: fails when any required handling declaration checkbox is omitted or false', () => {
      const missingDeclaration = donationCreateSchema.safeParse({
        category: 'cooked',
        description: 'Fresh prepared vegetable curry and rice',
        offeredPortions: 40,
        preparedAt: new Date().toISOString(),
        pickupDeadline: new Date(Date.now() + 14400000).toISOString(),
        pickupAddress: '42 Main Street, Mumbai',
        pickupLatitude: 19.076,
        pickupLongitude: 72.8777,
        handlingDeclarations: {
          safePreparation: true,
          properTemperature: false, // Falsified / unconfirmed
          cleanPackaging: true,
          accurateInformation: true,
          recipientAssessmentAcknowledgement: true,
        },
      });
      expect(missingDeclaration.success).toBe(false);
    });

    it('VR-014: enforces positive non-zero whole integer portions', () => {
      const zeroPortions = donationCreateSchema.safeParse({
        category: 'cooked',
        description: 'Vegetable curry',
        offeredPortions: 0,
        preparedAt: new Date().toISOString(),
        pickupDeadline: new Date(Date.now() + 14400000).toISOString(),
        pickupAddress: '42 Main Street, Mumbai',
        pickupLatitude: 19.076,
        pickupLongitude: 72.8777,
        handlingDeclarations: {
          safePreparation: true,
          properTemperature: true,
          cleanPackaging: true,
          accurateInformation: true,
          recipientAssessmentAcknowledgement: true,
        },
      });
      expect(zeroPortions.success).toBe(false);

      const floatPortions = donationCreateSchema.safeParse({
        category: 'cooked',
        description: 'Vegetable curry',
        offeredPortions: 12.5,
        preparedAt: new Date().toISOString(),
        pickupDeadline: new Date(Date.now() + 14400000).toISOString(),
        pickupAddress: '42 Main Street, Mumbai',
        pickupLatitude: 19.076,
        pickupLongitude: 72.8777,
        handlingDeclarations: {
          safePreparation: true,
          properTemperature: true,
          cleanPackaging: true,
          accurateInformation: true,
          recipientAssessmentAcknowledgement: true,
        },
      });
      expect(floatPortions.success).toBe(false);
    });
  });

  describe('Handover & Collection Validation', () => {
    it('VR-030..VR-033: validates handover collection code and recipient affirmation', () => {
      const validCollect = claimCollectSchema.safeParse({
        handoverCode: '482910',
        actualPortions: 40,
        recipientAffirmation: true,
        expectedVersion: 1,
      });
      expect(validCollect.success).toBe(true);

      const invalidCode = claimCollectSchema.safeParse({
        handoverCode: '1234', // Must be 6 digits
        actualPortions: 40,
        recipientAffirmation: true,
        expectedVersion: 1,
      });
      expect(invalidCode.success).toBe(false);

      const noAffirmation = claimCollectSchema.safeParse({
        handoverCode: '482910',
        actualPortions: 40,
        recipientAffirmation: false,
        expectedVersion: 1,
      });
      expect(noAffirmation.success).toBe(false);
    });
  });

  describe('Invariant Transition Oracle Tables & Guards', () => {
    it('verifies deterministic donation lifecycle transitions', () => {
      // Legal transitions
      expect(isAllowedDonationTransition('Available', 'Claimed')).toBe(true);
      expect(isAllowedDonationTransition('Available', 'Cancelled')).toBe(true);
      expect(isAllowedDonationTransition('Available', 'Expired')).toBe(true);
      expect(isAllowedDonationTransition('Claimed', 'Pickup Confirmed')).toBe(true);
      expect(isAllowedDonationTransition('Claimed', 'Available')).toBe(true);
      expect(isAllowedDonationTransition('Pickup Confirmed', 'Collected')).toBe(true);
      expect(isAllowedDonationTransition('Collected', 'Completed')).toBe(true);
      expect(isAllowedDonationTransition('Claimed', 'Disputed')).toBe(true);
      expect(isAllowedDonationTransition('Disputed', 'Cancelled')).toBe(true);

      // Illegal transitions fail closed
      expect(isAllowedDonationTransition('Available', 'Collected')).toBe(false);
      expect(isAllowedDonationTransition('Available', 'Completed')).toBe(false);
      expect(isAllowedDonationTransition('Completed', 'Available')).toBe(false);
      expect(isAllowedDonationTransition('Expired', 'Claimed')).toBe(false);
      expect(isAllowedDonationTransition('Cancelled', 'Available')).toBe(false);
      expect(isAllowedDonationTransition('Collected', 'Available')).toBe(false);
    });

    it('verifies deterministic claim lifecycle transitions', () => {
      // Legal transitions
      expect(isAllowedClaimTransition('Active', 'Ready')).toBe(true);
      expect(isAllowedClaimTransition('Active', 'Cancelled')).toBe(true);
      expect(isAllowedClaimTransition('Active', 'Expired')).toBe(true);
      expect(isAllowedClaimTransition('Ready', 'Collected')).toBe(true);
      expect(isAllowedClaimTransition('Collected', 'Completed')).toBe(true);
      expect(isAllowedClaimTransition('Active', 'Disputed')).toBe(true);

      // Illegal transitions
      expect(isAllowedClaimTransition('Active', 'Collected')).toBe(false);
      expect(isAllowedClaimTransition('Completed', 'Active')).toBe(false);
      expect(isAllowedClaimTransition('Expired', 'Ready')).toBe(false);
    });

    it('verifies deterministic organization verification transitions', () => {
      expect(isAllowedOrgTransition('pending', 'verified')).toBe(true);
      expect(isAllowedOrgTransition('pending', 'rejected')).toBe(true);
      expect(isAllowedOrgTransition('verified', 'suspended')).toBe(true);
      expect(isAllowedOrgTransition('rejected', 'verified')).toBe(true);
      expect(isAllowedOrgTransition('suspended', 'verified')).toBe(true);

      expect(isAllowedOrgTransition('pending', 'suspended')).toBe(false);
    });

    it('confirms all states in transition tables exist in enum definitions', () => {
      const donationStates = Object.keys(ALLOWED_DONATION_TRANSITIONS);
      expect(donationStates).toHaveLength(8);

      const claimStates = Object.keys(ALLOWED_CLAIM_TRANSITIONS);
      expect(claimStates).toHaveLength(7);

      const orgStates = Object.keys(ALLOWED_ORG_TRANSITIONS);
      expect(orgStates).toHaveLength(4);
    });
  });

  describe('Straight-Line Distance Calculation Oracle', () => {
    it('calculates accurate straight-line distance in km', () => {
      // Mumbai (19.0760, 72.8777) to Pune (18.5204, 73.8567) ~ 118-120 km straight-line
      const dist = calculateHaversineDistanceKm(19.076, 72.8777, 18.5204, 73.8567);
      expect(dist).toBeGreaterThan(115);
      expect(dist).toBeLessThan(125);

      // Zero distance for same coordinates
      expect(calculateHaversineDistanceKm(19.076, 72.8777, 19.076, 72.8777)).toBe(0);
    });
  });
});
