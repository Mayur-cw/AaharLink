import { z } from 'zod';

// ============================================================================
// Roles & Enums
// ============================================================================

export const roleSchema = z.enum(['anonymous', 'donor', 'ngo', 'coordinator']);
export type Role = z.infer<typeof roleSchema>;

export const organizationKindSchema = z.enum(['donor', 'ngo']);
export type OrganizationKind = z.infer<typeof organizationKindSchema>;

export const organizationStatusSchema = z.enum(['pending', 'verified', 'rejected', 'suspended']);
export type OrganizationStatus = z.infer<typeof organizationStatusSchema>;

export const userStatusSchema = z.enum(['active', 'suspended']);
export type UserStatus = z.infer<typeof userStatusSchema>;

export const donationCategorySchema = z.enum(['cooked', 'packed', 'produce', 'bakery', 'other']);
export type DonationCategory = z.infer<typeof donationCategorySchema>;

export const donationStatusSchema = z.enum([
  'Available',
  'Claimed',
  'Pickup Confirmed',
  'Collected',
  'Completed',
  'Cancelled',
  'Expired',
  'Disputed',
]);
export type DonationStatus = z.infer<typeof donationStatusSchema>;

export const claimStatusSchema = z.enum([
  'Active',
  'Ready',
  'Collected',
  'Completed',
  'Cancelled',
  'Expired',
  'Disputed',
]);
export type ClaimStatus = z.infer<typeof claimStatusSchema>;

export const notificationKindSchema = z.enum([
  'claim',
  'ready',
  'completed',
  'expired',
  'verification',
  'cancelled',
  'disputed',
]);
export type NotificationKind = z.infer<typeof notificationKindSchema>;

export const notificationStatusSchema = z.enum(['unread', 'read']);
export type NotificationStatus = z.infer<typeof notificationStatusSchema>;

export const notificationObjectTypeSchema = z.enum(['donation', 'claim', 'organization']);
export type NotificationObjectType = z.infer<typeof notificationObjectTypeSchema>;

export const auditEventTypeSchema = z.enum([
  'register',
  'login',
  'login_failed_redacted',
  'password_change',
  'logout',
  'donation_create',
  'donation_update',
  'donation_cancel',
  'donation_ready',
  'claim_create',
  'claim_cancel',
  'handover_collected',
  'handover_completed',
  'organization_decision',
  'donation_resolve',
  'expire_reconciliation',
]);
export type AuditEventType = z.infer<typeof auditEventTypeSchema>;

// ============================================================================
// Response Codes & Standard Envelope
// ============================================================================

export const responseCode = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  INVALID_INPUT: 'INVALID_INPUT',
  CONFLICT: 'CONFLICT',
  GONE: 'GONE',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export const errorDetailsSchema = z.record(z.string(), z.array(z.string())).optional();

export const errorPayloadSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: errorDetailsSchema,
});

export const errorSchema = errorPayloadSchema;

export const successEnvelopeSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    ok: z.literal(true),
    data: dataSchema,
    correlationId: z.string(),
  });

export const failureEnvelopeSchema = z.object({
  ok: z.literal(false),
  error: errorPayloadSchema,
  correlationId: z.string(),
});

export const healthSchema = z.object({
  status: z.literal('ok'),
});

export function createSuccessEnvelope<T>(data: T, correlationId: string) {
  return {
    ok: true as const,
    data,
    correlationId,
  };
}

export function createErrorEnvelope(
  code: string,
  message: string,
  correlationId: string,
  details?: Record<string, string[]>
) {
  return {
    ok: false as const,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
    correlationId,
  };
}

// ============================================================================
// Request Schemas (Strict — reject unknown fields per VR-042)
// ============================================================================

// VR-001, VR-002
export const loginBodySchema = z
  .object({
    email: z
      .string({ message: 'Enter a valid email address.' })
      .trim()
      .toLowerCase()
      .email({ message: 'Enter a valid email address.' })
      .max(254, { message: 'Enter a valid email address.' }),
    password: z
      .string({ message: 'Use a password of at least 12 characters.' })
      .min(1, { message: 'Password is required.' })
      .max(128, { message: 'Password too long.' }),
  })
  .strict();
export type LoginBody = z.infer<typeof loginBodySchema>;

// VR-001 through VR-007
export const registerBodySchema = z
  .object({
    organizationKind: z.enum(['donor', 'ngo'], {
      message: 'Choose donor or NGO.',
    }),
    email: z
      .string({ message: 'Enter a valid email address.' })
      .trim()
      .toLowerCase()
      .email({ message: 'Enter a valid email address.' })
      .max(254, { message: 'Enter a valid email address.' }),
    password: z
      .string({ message: 'Use a password of at least 12 characters.' })
      .min(12, { message: 'Use a password of at least 12 characters.' })
      .max(128, { message: 'Password cannot exceed 128 characters.' }),
    organizationName: z
      .string({ message: 'Enter an organization name.' })
      .trim()
      .min(2, { message: 'Enter an organization name.' })
      .max(120, { message: 'Organization name cannot exceed 120 characters.' }),
    contactPerson: z
      .string({ message: 'Enter a contact person name.' })
      .trim()
      .min(2, { message: 'Enter a contact person name.' })
      .max(120, { message: 'Contact person name cannot exceed 120 characters.' }),
    contactPhone: z
      .string({ message: 'Enter a reachable contact number.' })
      .trim()
      .regex(/^\+?[0-9]{8,15}$/, { message: 'Enter a reachable contact number.' }),
    city: z
      .string({ message: 'Enter a city name.' })
      .trim()
      .min(2, { message: 'Enter a city name.' })
      .max(80, { message: 'City name cannot exceed 80 characters.' }),
    latitude: z
      .number({ message: 'Enter valid location coordinates.' })
      .min(-90, { message: 'Enter valid location coordinates.' })
      .max(90, { message: 'Enter valid location coordinates.' }),
    longitude: z
      .number({ message: 'Enter valid location coordinates.' })
      .min(-180, { message: 'Enter valid location coordinates.' })
      .max(180, { message: 'Enter valid location coordinates.' }),
    consent: z.literal(true, {
      message: 'Confirm consent before continuing.',
    }),
  })
  .strict();
export type RegisterBody = z.infer<typeof registerBodySchema>;

// VR-004, VR-005, VR-006, VR-011
export const accountPatchSchema = z
  .object({
    organizationName: z
      .string()
      .trim()
      .min(2, { message: 'Enter an organization name.' })
      .max(120, { message: 'Organization name cannot exceed 120 characters.' })
      .optional(),
    contactPerson: z
      .string()
      .trim()
      .min(2, { message: 'Enter a contact person name.' })
      .max(120, { message: 'Contact person name cannot exceed 120 characters.' })
      .optional(),
    contactPhone: z
      .string()
      .trim()
      .regex(/^\+?[0-9]{8,15}$/, { message: 'Enter a reachable contact number.' })
      .optional(),
    city: z
      .string()
      .trim()
      .min(2, { message: 'Enter a city name.' })
      .max(80, { message: 'City name cannot exceed 80 characters.' })
      .optional(),
    latitude: z
      .number()
      .min(-90, { message: 'Enter valid location coordinates.' })
      .max(90, { message: 'Enter valid location coordinates.' })
      .optional(),
    longitude: z
      .number()
      .min(-180, { message: 'Enter valid location coordinates.' })
      .max(180, { message: 'Enter valid location coordinates.' })
      .optional(),
    version: z.number().int().min(1, { message: 'Organization changed; reload and retry.' }),
  })
  .strict();
export type AccountPatchBody = z.infer<typeof accountPatchSchema>;

// VR-002
export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, { message: 'Current password is required.' }),
    newPassword: z
      .string()
      .min(12, { message: 'Use a password of at least 12 characters.' })
      .max(128, { message: 'Password cannot exceed 128 characters.' }),
  })
  .strict();
export type PasswordChangeBody = z.infer<typeof passwordChangeSchema>;

// Handling Declarations (4 factual checkboxes) + Recipient Assessment Acknowledgement (VR-019, VR-020)
export const handlingDeclarationsSchema = z
  .object({
    safePreparation: z.literal(true, {
      message: 'Confirm each required handling statement.',
    }),
    properTemperature: z.literal(true, {
      message: 'Confirm each required handling statement.',
    }),
    cleanPackaging: z.literal(true, {
      message: 'Confirm each required handling statement.',
    }),
    accurateInformation: z.literal(true, {
      message: 'Confirm each required handling statement.',
    }),
    recipientAssessmentAcknowledgement: z.literal(true, {
      message: 'Acknowledge independent recipient assessment.',
    }),
  })
  .strict();
export type HandlingDeclarations = z.infer<typeof handlingDeclarationsSchema>;

// VR-012 through VR-020
export const donationCreateSchema = z
  .object({
    category: donationCategorySchema,
    description: z
      .string({ message: 'Describe the donation in 4–300 characters.' })
      .trim()
      .min(4, { message: 'Describe the donation in 4–300 characters.' })
      .max(300, { message: 'Describe the donation in 4–300 characters.' }),
    offeredPortions: z
      .number({ message: 'Enter a valid positive quantity.' })
      .int({ message: 'Enter a valid positive quantity.' })
      .min(1, { message: 'Enter a valid positive quantity.' })
      .max(10000, { message: 'Quantity cannot exceed 10,000 portions.' }),
    preparedAt: z
      .string({ message: 'Enter a truthful preparation time.' })
      .datetime({ message: 'Enter a truthful preparation time.' }),
    pickupDeadline: z
      .string({ message: 'Choose a later, future pickup deadline.' })
      .datetime({ message: 'Choose a later, future pickup deadline.' }),
    pickupAddress: z
      .string({ message: 'Enter the pickup address.' })
      .trim()
      .min(5, { message: 'Enter the pickup address.' })
      .max(250, { message: 'Pickup address cannot exceed 250 characters.' }),
    pickupLatitude: z
      .number({ message: 'Enter valid pickup coordinates.' })
      .min(-90, { message: 'Enter valid pickup coordinates.' })
      .max(90, { message: 'Enter valid pickup coordinates.' }),
    pickupLongitude: z
      .number({ message: 'Enter valid pickup coordinates.' })
      .min(-180, { message: 'Enter valid pickup coordinates.' })
      .max(180, { message: 'Enter valid pickup coordinates.' }),
    handlingDeclarations: handlingDeclarationsSchema,
  })
  .strict();
export type DonationCreateBody = z.infer<typeof donationCreateSchema>;

// VR-013, VR-014, VR-016, VR-017, VR-021
export const donationPatchSchema = z
  .object({
    description: z
      .string()
      .trim()
      .min(4, { message: 'Describe the donation in 4–300 characters.' })
      .max(300, { message: 'Describe the donation in 4–300 characters.' })
      .optional(),
    offeredPortions: z
      .number()
      .int({ message: 'Enter a valid positive quantity.' })
      .min(1, { message: 'Enter a valid positive quantity.' })
      .max(10000, { message: 'Quantity cannot exceed 10,000 portions.' })
      .optional(),
    pickupDeadline: z.string().datetime({ message: 'Choose a later, future pickup deadline.' }).optional(),
    pickupAddress: z
      .string()
      .trim()
      .min(5, { message: 'Enter the pickup address.' })
      .max(250, { message: 'Pickup address cannot exceed 250 characters.' })
      .optional(),
    expectedVersion: z.number().int().min(1, { message: 'Donation changed; reload its current state.' }),
  })
  .strict();
export type DonationPatchBody = z.infer<typeof donationPatchSchema>;

// VR-035, VR-021
export const donationCancelSchema = z
  .object({
    reason: z
      .string({ message: 'Add a clear reason for this decision.' })
      .trim()
      .min(10, { message: 'Add a clear reason for this decision.' })
      .max(500, { message: 'Reason cannot exceed 500 characters.' }),
    expectedVersion: z.number().int().min(1, { message: 'Donation changed; reload its current state.' }),
  })
  .strict();
export type DonationCancelBody = z.infer<typeof donationCancelSchema>;

// VR-021, VR-032
export const pickupReadySchema = z
  .object({
    expectedVersion: z.number().int().min(1, { message: 'Donation changed; reload its current state.' }),
  })
  .strict();
export type PickupReadyBody = z.infer<typeof pickupReadySchema>;

// VR-024, VR-021, VR-029
export const claimCreateSchema = z
  .object({
    assessedDeclaration: z.literal(true, {
      message: 'Review suitability before claiming.',
    }),
    expectedVersion: z.number().int().min(1, { message: 'Donation changed; reload its current state.' }),
  })
  .strict();
export type ClaimCreateBody = z.infer<typeof claimCreateSchema>;

// VR-035, VR-021
export const claimCancelSchema = z
  .object({
    reason: z
      .string({ message: 'Add a clear reason for this decision.' })
      .trim()
      .min(10, { message: 'Add a clear reason for this decision.' })
      .max(500, { message: 'Reason cannot exceed 500 characters.' }),
    expectedVersion: z.number().int().min(1, { message: 'Claim changed; reload its current state.' }),
  })
  .strict();
export type ClaimCancelBody = z.infer<typeof claimCancelSchema>;

// VR-030, VR-031, VR-033, VR-021
export const claimCollectSchema = z
  .object({
    handoverCode: z
      .string({ message: 'That code is incorrect or expired.' })
      .trim()
      .regex(/^[0-9]{6}$/, { message: 'That code is incorrect or expired.' }),
    actualPortions: z
      .number({ message: 'Enter the quantity actually received.' })
      .int({ message: 'Enter the quantity actually received.' })
      .min(1, { message: 'Enter the quantity actually received.' })
      .max(10000, { message: 'Quantity cannot exceed 10,000 portions.' }),
    recipientAffirmation: z.literal(true, {
      message: 'Confirm you assessed the food before collecting.',
    }),
    expectedVersion: z.number().int().min(1, { message: 'Handover state has changed; refresh the receipt.' }),
  })
  .strict();
export type ClaimCollectBody = z.infer<typeof claimCollectSchema>;

// VR-008, VR-009, VR-006, VR-011
export const ngoCapacityPatchSchema = z
  .object({
    maxPortions: z
      .number()
      .int({ message: 'Enter a whole-number pickup capacity.' })
      .min(1, { message: 'Enter a whole-number pickup capacity.' })
      .max(10000, { message: 'Enter a whole-number pickup capacity.' })
      .optional(),
    operatingRadiusKm: z
      .number()
      .min(1, { message: 'Choose a distance from 1 to 200 km.' })
      .max(200, { message: 'Choose a distance from 1 to 200 km.' })
      .optional(),
    latitude: z
      .number()
      .min(-90, { message: 'Enter valid location coordinates.' })
      .max(90, { message: 'Enter valid location coordinates.' })
      .optional(),
    longitude: z
      .number()
      .min(-180, { message: 'Enter valid location coordinates.' })
      .max(180, { message: 'Enter valid location coordinates.' })
      .optional(),
    version: z.number().int().min(1, { message: 'Organization changed; reload and retry.' }),
  })
  .strict();
export type NgoCapacityPatchBody = z.infer<typeof ngoCapacityPatchSchema>;

// VR-035, VR-036, VR-011
export const coordinatorOrgDecisionSchema = z
  .object({
    decision: z.enum(['verify', 'reject', 'suspend'], {
      message: 'That resolution is not allowed in the current state.',
    }),
    reason: z
      .string({ message: 'Add a clear reason for this decision.' })
      .trim()
      .min(10, { message: 'Add a clear reason for this decision.' })
      .max(500, { message: 'Reason cannot exceed 500 characters.' }),
    expectedVersion: z.number().int().min(1, { message: 'Organization changed; reload and retry.' }),
  })
  .strict();
export type CoordinatorOrgDecisionBody = z.infer<typeof coordinatorOrgDecisionSchema>;

// VR-035, VR-036, VR-021
export const coordinatorDonationResolveSchema = z
  .object({
    decision: z.enum(['dispute', 'cancel'], {
      message: 'That resolution is not allowed in the current state.',
    }),
    reason: z
      .string({ message: 'Add a clear reason for this decision.' })
      .trim()
      .min(10, { message: 'Add a clear reason for this decision.' })
      .max(500, { message: 'Reason cannot exceed 500 characters.' }),
    expectedVersion: z.number().int().min(1, { message: 'Donation changed; reload its current state.' }),
  })
  .strict();
export type CoordinatorDonationResolveBody = z.infer<typeof coordinatorDonationResolveSchema>;

export const internalReconcileExpiredSchema = z
  .object({
    internalTaskNonce: z.string().min(1),
  })
  .strict();
export type InternalReconcileExpiredBody = z.infer<typeof internalReconcileExpiredSchema>;

// ============================================================================
// Query & Filter Schemas
// ============================================================================

export const cursorPaginationSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().optional(),
  })
  .strict();

export const donationFilterSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().optional(),
    category: donationCategorySchema.optional(),
    maxDistanceKm: z.coerce.number().min(1).max(200).optional(),
    status: donationStatusSchema.optional(),
  })
  .strict();

export const auditFilterSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(20),
    cursor: z.string().optional(),
    entityType: z.string().optional(),
    entityId: z.string().optional(),
  })
  .strict();

export const analyticsQuerySchema = z
  .object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
  })
  .strict();

// ============================================================================
// DTOs & Output Types
// ============================================================================

export interface SessionSummary {
  authenticated: boolean;
  user: {
    id: string;
    email: string;
    role: Role;
    organizationId: string | null;
  } | null;
  organization: {
    id: string;
    name: string;
    kind: OrganizationKind;
    status: OrganizationStatus;
    city: string;
    verified: boolean;
  } | null;
}

export interface RegistrationReceipt {
  userId: string;
  organizationId: string;
  role: Role;
  status: OrganizationStatus;
  message: string;
}

export interface OwnAccountProfile {
  user: {
    id: string;
    email: string;
    role: Role;
    createdAt: string;
  };
  organization: {
    id: string;
    name: string;
    kind: OrganizationKind;
    status: OrganizationStatus;
    contactPerson: string;
    contactPhone: string;
    city: string;
    latitude: number;
    longitude: number;
    maxPortions?: number;
    operatingRadiusKm?: number;
    version: number;
    updatedAt: string;
  } | null;
}

export interface SecurityChangeReceipt {
  success: boolean;
  message: string;
}

export interface OwnNotification {
  id: string;
  userId: string;
  kind: NotificationKind;
  message: string;
  objectType: NotificationObjectType;
  objectId: string;
  readAt: string | null;
  createdAt: string;
}

export interface DonorDashboardDTO {
  activeDonationsCount: number;
  completedDonationsCount: number;
  totalPortionsRescued: number;
  urgentDonations: DonationOwnerSummary[];
}

export interface DonationOwnerSummary {
  id: string;
  category: DonationCategory;
  description: string;
  offeredPortions: number;
  actualCollectedPortions: number;
  preparedAt: string;
  pickupDeadline: string;
  status: DonationStatus;
  activeClaimId?: string | null;
  claimedByNgoName?: string | null;
  version: number;
  createdAt: string;
}

export interface DonationOwnerDetail extends DonationOwnerSummary {
  pickupAddress: string;
  pickupLatitude: number;
  pickupLongitude: number;
  handlingDeclaredAt: string;
  declarationSnapshot: HandlingDeclarations;
  claimedBy?: {
    ngoId: string;
    ngoName: string;
    contactPerson: string;
    contactPhone: string;
  } | null;
  handoverCodeGenerated?: boolean;
}

export interface PickupReadinessReceipt {
  donationId: string;
  status: DonationStatus;
  handoverCode: string; // Special: returned to donor on ready action only
  expiresAt: string;
  version: number;
}

export interface NgoDashboardDTO {
  availableDonationsNearbyCount: number;
  activeClaimsCount: number;
  completedPickupsCount: number;
  currentCapacity: {
    maxPortions: number;
    usedPortions: number;
    availablePortions: number;
  };
  urgentPickups: OwnClaimSummary[];
}

export interface DonationPublicPreview {
  id: string;
  category: DonationCategory;
  description: string;
  offeredPortions: number;
  preparedAt: string;
  pickupDeadline: string;
  approximateCity: string;
  straightLineDistanceKm: number; // Straight-line approximation
  status: DonationStatus;
  donorOrganizationName: string;
  eligibleForMyCapacity: boolean;
  ineligibleReason?: string;
  version: number;
  createdAt: string;
}

export interface OwnClaimSummary {
  id: string;
  donationId: string;
  category: DonationCategory;
  description: string;
  claimedPortions: number;
  actualReceived: number | null;
  pickupDeadline: string;
  status: ClaimStatus;
  donorOrganizationName: string;
  donorCity: string;
  version: number;
  claimedAt: string;
  readyAt: string | null;
}

export interface OwnClaimDetail extends OwnClaimSummary {
  pickupAddress?: string; // Revealed ONLY after verified claim
  pickupLatitude?: number;
  pickupLongitude?: number;
  donorContactPerson?: string;
  donorContactPhone?: string;
  handoverReady: boolean;
  handoverAttemptsRemaining: number;
  declarationSnapshot: HandlingDeclarations;
}

export interface CollectionReceipt {
  claimId: string;
  donationId: string;
  status: ClaimStatus;
  claimedPortions: number;
  actualReceived: number;
  completedAt: string;
  version: number;
}

export interface OwnCapacity {
  maxPortions: number;
  operatingRadiusKm: number;
  latitude: number;
  longitude: number;
  activeReservedPortions: number;
  availableRemainingPortions: number;
  version: number;
}

export interface CoordinatorDashboardDTO {
  pendingOrganizationsCount: number;
  activeDonationsCount: number;
  urgentClaimsCount: number;
  disputedCount: number;
  totalPortionsRescued: number;
  recentAuditEvents: RedactedAuditEvent[];
}

export interface CoordinatorOrganizationSummary {
  id: string;
  name: string;
  kind: OrganizationKind;
  status: OrganizationStatus;
  city: string;
  contactPerson: string;
  contactPhone: string;
  version: number;
  createdAt: string;
}

export interface CoordinatorOrganizationDetail extends CoordinatorOrganizationSummary {
  ownerEmail: string;
  latitude: number;
  longitude: number;
  maxPortions?: number;
  operatingRadiusKm?: number;
  activeDonationsOrClaimsCount: number;
  updatedAt: string;
}

export interface CoordinatorDonationSummary {
  id: string;
  donorOrganizationName: string;
  category: DonationCategory;
  description: string;
  offeredPortions: number;
  actualCollectedPortions: number;
  status: DonationStatus;
  pickupDeadline: string;
  claimedByNgoName?: string | null;
  version: number;
  createdAt: string;
}

export interface CoordinatorDonationDetail extends CoordinatorDonationSummary {
  pickupAddress: string;
  pickupLatitude: number;
  pickupLongitude: number;
  preparedAt: string;
  handlingDeclaredAt: string;
  declarationSnapshot: HandlingDeclarations;
  activeClaim?: {
    id: string;
    ngoOrganizationName: string;
    status: ClaimStatus;
    claimedPortions: number;
    handoverAttempts: number;
  } | null;
  auditTrail: RedactedAuditEvent[];
}

export interface OperationalAnalytics {
  metrics: {
    totalPortionsOffered: number;
    totalPortionsRescued: number; // Based strictly on verified actual received receipts
    totalCompletedPickups: number;
    rescueEfficiencyPercentage: number;
    averageHandoverTimeMinutes: number;
    expiredDonationsCount: number;
  };
  byCategory: Array<{
    category: DonationCategory;
    portionsRescued: number;
    donationsCount: number;
  }>;
  byCity: Array<{
    city: string;
    donationsCount: number;
    portionsRescued: number;
  }>;
}

export interface RedactedAuditEvent {
  id: string;
  correlationId: string;
  actorRole: string;
  entityType: string;
  entityId: string;
  eventType: AuditEventType;
  fromStatus?: string | null;
  toStatus?: string | null;
  reason?: string | null;
  occurredAtUtc: string;
}

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
  totalCount?: number;
}

// ============================================================================
// Invariant Transition Oracle Tables & Pure Transition Guards
// ============================================================================

export const ALLOWED_DONATION_TRANSITIONS: Record<DonationStatus, readonly DonationStatus[]> = {
  Available: ['Claimed', 'Cancelled', 'Expired'],
  Claimed: ['Pickup Confirmed', 'Available', 'Cancelled', 'Expired', 'Disputed'],
  'Pickup Confirmed': ['Collected', 'Expired', 'Disputed'],
  Collected: ['Completed'], // Atomic transition inside same transaction
  Completed: [], // Terminal
  Cancelled: [], // Terminal
  Expired: [], // Terminal
  Disputed: ['Cancelled'], // Coordinator can cancel after dispute resolution
} as const;

export const ALLOWED_CLAIM_TRANSITIONS: Record<ClaimStatus, readonly ClaimStatus[]> = {
  Active: ['Ready', 'Cancelled', 'Expired', 'Disputed'],
  Ready: ['Collected', 'Expired', 'Disputed'],
  Collected: ['Completed'], // Atomic transition inside same transaction
  Completed: [], // Terminal
  Cancelled: [], // Terminal
  Expired: [], // Terminal
  Disputed: ['Cancelled'],
} as const;

export const ALLOWED_ORG_TRANSITIONS: Record<OrganizationStatus, readonly OrganizationStatus[]> = {
  pending: ['verified', 'rejected'],
  verified: ['suspended'],
  rejected: ['verified'], // Can re-verify after corrective review
  suspended: ['verified'], // Can be restored by coordinator
} as const;

export function isAllowedDonationTransition(from: DonationStatus, to: DonationStatus): boolean {
  return ALLOWED_DONATION_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isAllowedClaimTransition(from: ClaimStatus, to: ClaimStatus): boolean {
  return ALLOWED_CLAIM_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isAllowedOrgTransition(from: OrganizationStatus, to: OrganizationStatus): boolean {
  return ALLOWED_ORG_TRANSITIONS[from]?.includes(to) ?? false;
}

// ============================================================================
// Straight-Line Distance Calculation (Clearly Labeled Approximation)
// ============================================================================

export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 10) / 10; // Round to 1 decimal place
}
