import type {
  CoordinatorDashboardDTO,
  CoordinatorOrganizationDetail,
  CoordinatorDonationDetail,
  OperationalAnalytics,
  RedactedAuditEvent,
} from '../../shared/contracts.js';
import type { OrganizationRecord, DonationRecord } from '../repository.js';
import { repository } from '../repository.js';

export function getCoordinatorDashboard(): CoordinatorDashboardDTO {
  return repository.getCoordinatorDashboardMetrics();
}

export function formatCoordinatorOrgDetail(
  org: OrganizationRecord
): CoordinatorOrganizationDetail {
  const user = repository.getUserById(org.ownerUserId);
  const activeCount = org.kind === 'donor'
    ? repository.countActiveDonationsForOrg(org.id)
    : repository.countActiveClaimsForOrg(org.id);

  return {
    id: org.id,
    name: org.name,
    kind: org.kind,
    status: org.status,
    city: org.city,
    contactPerson: org.contactPerson,
    contactPhone: org.contactPhone,
    ownerEmail: user?.email || 'unknown@aaharlink.org',
    latitude: org.latitude,
    longitude: org.longitude,
    maxPortions: org.maxPortions,
    operatingRadiusKm: org.operatingRadiusKm,
    activeDonationsOrClaimsCount: activeCount,
    version: org.version,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
  };
}

export function formatCoordinatorDonationDetail(
  donation: DonationRecord
): CoordinatorDonationDetail {
  const donorOrg = repository.getOrgById(donation.donorOrganizationId);
  const activeClaim = repository.getActiveClaimForDonation(donation.id);

  let activeClaimDTO: CoordinatorDonationDetail['activeClaim'] = null;
  if (activeClaim) {
    const ngoOrg = repository.getOrgById(activeClaim.ngoOrganizationId);
    activeClaimDTO = {
      id: activeClaim.id,
      ngoOrganizationName: ngoOrg?.name || 'Assigned NGO',
      status: activeClaim.status,
      claimedPortions: activeClaim.claimedPortions,
      handoverAttempts: activeClaim.handoverAttempts,
    };
  }

  // Fetch audit trail for this donation
  const audits = repository.listAuditEvents(50, undefined, undefined, donation.id).items;
  const auditTrail: RedactedAuditEvent[] = audits.map((a) => ({
    id: a.id,
    correlationId: a.correlationId,
    actorRole: a.actorRole,
    entityType: a.entityType,
    entityId: a.entityId,
    eventType: a.eventType,
    fromStatus: a.fromStatus,
    toStatus: a.toStatus,
    reason: a.reason,
    occurredAtUtc: a.occurredAtUtc,
  }));

  return {
    id: donation.id,
    donorOrganizationName: donorOrg?.name || 'Verified Donor',
    category: donation.category,
    description: donation.description,
    offeredPortions: donation.offeredPortions,
    actualCollectedPortions: donation.actualCollectedPortions,
    status: donation.status,
    pickupDeadline: donation.pickupDeadline,
    claimedByNgoName: activeClaimDTO?.ngoOrganizationName ?? null,
    pickupAddress: donation.pickupAddress,
    pickupLatitude: donation.pickupLatitude,
    pickupLongitude: donation.pickupLongitude,
    preparedAt: donation.preparedAt,
    handlingDeclaredAt: donation.handlingDeclaredAt,
    declarationSnapshot: donation.declarationSnapshot,
    activeClaim: activeClaimDTO,
    auditTrail,
    version: donation.version,
    createdAt: donation.createdAt,
  };
}

export function getDerivedAnalytics(
  startDate?: string,
  endDate?: string
): OperationalAnalytics {
  return repository.getOperationalAnalytics(startDate, endDate);
}
