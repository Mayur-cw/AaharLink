import type { DonationRecord } from '../repository.js';
import type {
  DonationOwnerSummary,
  DonationOwnerDetail,
  DonorDashboardDTO,
} from '../../shared/contracts.js';
import { repository } from '../repository.js';

export function formatDonationOwnerSummary(donation: DonationRecord): DonationOwnerSummary {
  const activeClaim = repository.getActiveClaimForDonation(donation.id);
  let claimedByNgoName: string | null = null;
  if (activeClaim) {
    const ngoOrg = repository.getOrgById(activeClaim.ngoOrganizationId);
    claimedByNgoName = ngoOrg?.name || null;
  }

  return {
    id: donation.id,
    category: donation.category,
    description: donation.description,
    offeredPortions: donation.offeredPortions,
    actualCollectedPortions: donation.actualCollectedPortions,
    preparedAt: donation.preparedAt,
    pickupDeadline: donation.pickupDeadline,
    status: donation.status,
    activeClaimId: activeClaim?.id || null,
    claimedByNgoName,
    version: donation.version,
    createdAt: donation.createdAt,
  };
}

export function formatDonationOwnerDetail(donation: DonationRecord): DonationOwnerDetail {
  const summary = formatDonationOwnerSummary(donation);
  const activeClaim = repository.getActiveClaimForDonation(donation.id);

  let claimedBy: DonationOwnerDetail['claimedBy'] = null;
  if (activeClaim) {
    const ngoOrg = repository.getOrgById(activeClaim.ngoOrganizationId);
    if (ngoOrg) {
      claimedBy = {
        ngoId: ngoOrg.id,
        ngoName: ngoOrg.name,
        contactPerson: ngoOrg.contactPerson,
        contactPhone: ngoOrg.contactPhone,
      };
    }
  }

  return {
    ...summary,
    pickupAddress: donation.pickupAddress,
    pickupLatitude: donation.pickupLatitude,
    pickupLongitude: donation.pickupLongitude,
    handlingDeclaredAt: donation.handlingDeclaredAt,
    declarationSnapshot: donation.declarationSnapshot,
    claimedBy,
    handoverCodeGenerated: donation.status === 'Pickup Confirmed' || donation.status === 'Collected' || donation.status === 'Completed',
  };
}

export function getDonorDashboardData(donorOrgId: string): DonorDashboardDTO {
  const { items } = repository.listDonationsForDonor(donorOrgId, 100);

  let activeCount = 0;
  let completedCount = 0;
  let portionsRescued = 0;

  const urgent: DonationOwnerSummary[] = [];

  for (const don of items) {
    if (['Available', 'Claimed', 'Pickup Confirmed'].includes(don.status)) {
      activeCount++;
      urgent.push(formatDonationOwnerSummary(don));
    } else if (don.status === 'Completed') {
      completedCount++;
      portionsRescued += don.actualCollectedPortions;
    }
  }

  // Sort urgent by deadline ASC
  urgent.sort((a, b) => new Date(a.pickupDeadline).getTime() - new Date(b.pickupDeadline).getTime());

  return {
    activeDonationsCount: activeCount,
    completedDonationsCount: completedCount,
    totalPortionsRescued: portionsRescued,
    urgentDonations: urgent.slice(0, 5),
  };
}
