import type {
  DonationRecord,
  ClaimRecord,
  OrganizationRecord,
} from '../repository.js';
import type {
  DonationPublicPreview,
  OwnClaimSummary,
  OwnClaimDetail,
  NgoDashboardDTO,
} from '../../shared/contracts.js';
import { calculateHaversineDistanceKm } from '../../shared/contracts.js';
import { repository } from '../repository.js';

export function toDonationPublicPreview(
  donation: DonationRecord,
  ngoOrg: OrganizationRecord
): DonationPublicPreview {
  const donorOrg = repository.getOrgById(donation.donorOrganizationId);
  const donorLat = donorOrg?.latitude ?? donation.pickupLatitude;
  const donorLon = donorOrg?.longitude ?? donation.pickupLongitude;

  const dist = calculateHaversineDistanceKm(ngoOrg.latitude, ngoOrg.longitude, donorLat, donorLon);
  const capacity = repository.getNgoCapacity(ngoOrg.id);

  let eligible = true;
  let ineligibleReason: string | undefined;

  const now = new Date().toISOString();
  if (donation.status === 'Expired' || donation.pickupDeadline <= now) {
    eligible = false;
    ineligibleReason = 'This donation has expired and can no longer be claimed.';
  } else if (dist > ngoOrg.operatingRadiusKm) {
    eligible = false;
    ineligibleReason = `Distance (${dist} km) exceeds your radius (${ngoOrg.operatingRadiusKm} km).`;
  } else if (donation.offeredPortions > capacity.availableRemainingPortions) {
    eligible = false;
    ineligibleReason = `Portions (${donation.offeredPortions}) exceed your remaining capacity (${capacity.availableRemainingPortions}).`;
  }

  return {
    id: donation.id,
    category: donation.category,
    description: donation.description,
    offeredPortions: donation.offeredPortions,
    preparedAt: donation.preparedAt,
    pickupDeadline: donation.pickupDeadline,
    approximateCity: donorOrg?.city || 'Local area',
    straightLineDistanceKm: dist,
    status: (donation.status === 'Available' && donation.pickupDeadline <= now) ? 'Expired' : donation.status,
    donorOrganizationName: donorOrg?.name || 'Verified Donor',
    eligibleForMyCapacity: eligible,
    ineligibleReason,
    version: donation.version,
    createdAt: donation.createdAt,
  };
}

export function toOwnClaimSummary(
  claim: ClaimRecord,
  donation: DonationRecord,
  donorOrg: { name: string; city: string }
): OwnClaimSummary {
  return {
    id: claim.id,
    donationId: claim.donationId,
    category: donation.category,
    description: donation.description,
    claimedPortions: claim.claimedPortions,
    actualReceived: claim.actualReceived,
    pickupDeadline: donation.pickupDeadline,
    status: claim.status,
    donorOrganizationName: donorOrg.name,
    donorCity: donorOrg.city,
    version: claim.version,
    claimedAt: claim.claimedAt,
    readyAt: claim.readyAt,
  };
}

export function toOwnClaimDetail(
  claim: ClaimRecord,
  donation: DonationRecord,
  donorOrg: OrganizationRecord
): OwnClaimDetail {
  const summary = toOwnClaimSummary(claim, donation, donorOrg);

  return {
    ...summary,
    // Sensitive location and contact revealed ONLY to verified claimant
    pickupAddress: donation.pickupAddress,
    pickupLatitude: donation.pickupLatitude,
    pickupLongitude: donation.pickupLongitude,
    donorContactPerson: donorOrg.contactPerson,
    donorContactPhone: donorOrg.contactPhone,
    handoverReady: claim.status === 'Ready',
    handoverAttemptsRemaining: Math.max(0, 3 - claim.handoverAttempts),
    declarationSnapshot: donation.declarationSnapshot,
  };
}

export function getNgoDashboardData(ngoOrgId: string): NgoDashboardDTO {
  const ngoOrg = repository.getOrgById(ngoOrgId);
  if (!ngoOrg) throw new Error('NOT_FOUND: Organization not found');

  const capacity = repository.getNgoCapacity(ngoOrgId);
  const availableDonations = repository.listAvailableDonationsForNgo(ngoOrg, undefined, undefined, 50);
  const myClaims = repository.listClaimsForNgo(ngoOrgId, 100);

  let activeClaimsCount = 0;
  let readyForHandoverCount = 0;
  let completedPickupsCount = 0;
  const urgentPickups: OwnClaimSummary[] = [];
  const recentCompletedRescues: OwnClaimSummary[] = [];

  for (const c of myClaims.items) {
    if (c.status === 'Active') {
      activeClaimsCount++;
      urgentPickups.push(toOwnClaimSummary(c, c.donation, { name: c.donorOrgName, city: c.donorCity }));
    } else if (c.status === 'Ready') {
      activeClaimsCount++;
      readyForHandoverCount++;
      urgentPickups.push(toOwnClaimSummary(c, c.donation, { name: c.donorOrgName, city: c.donorCity }));
    } else if (c.status === 'Completed') {
      completedPickupsCount++;
      recentCompletedRescues.push(toOwnClaimSummary(c, c.donation, { name: c.donorOrgName, city: c.donorCity }));
    }
  }

  // Sort urgent by pickupDeadline ASC
  urgentPickups.sort((a, b) => new Date(a.pickupDeadline).getTime() - new Date(b.pickupDeadline).getTime());
  // Sort recent completed by deadline/date DESC
  recentCompletedRescues.sort((a, b) => new Date(b.pickupDeadline).getTime() - new Date(a.pickupDeadline).getTime());

  return {
    availableDonationsNearbyCount: availableDonations.items.length,
    activeClaimsCount,
    readyForHandoverCount,
    completedPickupsCount,
    currentCapacity: {
      maxPortions: capacity.maxPortions,
      usedPortions: capacity.activeReservedPortions,
      availablePortions: capacity.availableRemainingPortions,
    },
    urgentPickups: urgentPickups.slice(0, 5),
    recentCompletedRescues: recentCompletedRescues.slice(0, 5),
  };
}
