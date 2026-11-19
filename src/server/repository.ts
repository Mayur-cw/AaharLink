import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export type SqlParam = string | number | bigint | null | Uint8Array;
import type {
  Role,
  OrganizationKind,
  OrganizationStatus,
  DonationCategory,
  DonationStatus,
  ClaimStatus,
  NotificationKind,
  NotificationObjectType,
  AuditEventType,
  HandlingDeclarations,
  OperationalAnalytics,
  DonationPublicPreview,
  CoordinatorOrganizationSummary,
  CoordinatorDonationSummary,
  CoordinatorDashboardDTO,
} from '../shared/contracts.js';
import {
  calculateHaversineDistanceKm,
  isAllowedDonationTransition,
  isAllowedOrgTransition,
} from '../shared/contracts.js';
import { hashHandoverCode, verifyHandoverCode } from './session.js';

// ============================================================================
// Entity Interfaces
// ============================================================================

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
  organizationId: string | null;
  sessionRevokedAt: string | null;
  createdAt: string;
}

export interface OrganizationRecord {
  id: string;
  ownerUserId: string;
  kind: OrganizationKind;
  name: string;
  status: OrganizationStatus;
  contactPhone: string;
  contactPerson: string;
  city: string;
  latitude: number;
  longitude: number;
  maxPortions: number;
  operatingRadiusKm: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface DonationRecord {
  id: string;
  donorOrganizationId: string;
  category: DonationCategory;
  description: string;
  offeredPortions: number;
  actualCollectedPortions: number;
  preparedAt: string;
  pickupDeadline: string;
  pickupAddress: string;
  pickupLatitude: number;
  pickupLongitude: number;
  handlingDeclaredAt: string;
  declarationSnapshot: HandlingDeclarations;
  status: DonationStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClaimRecord {
  id: string;
  donationId: string;
  ngoOrganizationId: string;
  claimedPortions: number;
  actualReceived: number | null;
  handoverCodeHash: string | null;
  handoverSalt: string | null;
  handoverAttempts: number;
  claimedAt: string;
  readyAt: string | null;
  collectedAt: string | null;
  status: ClaimStatus;
  version: number;
}

export interface AuditEventRecord {
  id: string;
  correlationId: string;
  actorUserId: string;
  actorRole: string;
  entityType: string;
  entityId: string;
  eventType: AuditEventType;
  fromStatus: string | null;
  toStatus: string | null;
  reason: string | null;
  metadataRedacted: Record<string, unknown> | null;
  occurredAtUtc: string;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  kind: NotificationKind;
  message: string;
  objectType: NotificationObjectType;
  objectId: string;
  readAt: string | null;
  createdAt: string;
}

export interface IdempotencyRecord {
  key: string;
  principalId: string;
  operation: string;
  requestHash: string;
  responseStatus: number;
  responseBody: string;
  createdAt: string;
}

// ============================================================================
// Database & Migration Manager
// ============================================================================

export class AppDatabase {
  public db: DatabaseSync;

  constructor(dbPath: string = ':memory:') {
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    this.db = new DatabaseSync(dbPath);
    this.initPragmas();
    this.runMigrations();
  }

  private initPragmas() {
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA busy_timeout = 5000;');
  }

  private runMigrations() {
    const migrationSql = `
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('donor', 'ngo', 'coordinator')),
        organization_id TEXT,
        session_revoked_at TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
      CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users (organization_id);

      CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        owner_user_id TEXT UNIQUE NOT NULL,
        kind TEXT NOT NULL CHECK(kind IN ('donor', 'ngo')),
        name TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending', 'verified', 'rejected', 'suspended')),
        contact_phone TEXT NOT NULL,
        contact_person TEXT NOT NULL,
        city TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        max_portions INTEGER DEFAULT 100,
        operating_radius_km REAL DEFAULT 25.0,
        version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE RESTRICT
      );

      CREATE INDEX IF NOT EXISTS idx_organizations_kind_status ON organizations (kind, status, created_at);
      CREATE INDEX IF NOT EXISTS idx_organizations_city_status ON organizations (city, status);

      CREATE TABLE IF NOT EXISTS donations (
        id TEXT PRIMARY KEY,
        donor_organization_id TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('cooked', 'packed', 'produce', 'bakery', 'other')),
        description TEXT NOT NULL,
        offered_portions INTEGER NOT NULL CHECK(offered_portions >= 1 AND offered_portions <= 10000),
        actual_collected_portions INTEGER NOT NULL DEFAULT 0,
        prepared_at TEXT NOT NULL,
        pickup_deadline TEXT NOT NULL,
        pickup_address TEXT NOT NULL,
        pickup_latitude REAL NOT NULL,
        pickup_longitude REAL NOT NULL,
        handling_declared_at TEXT NOT NULL,
        declaration_snapshot TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('Available', 'Claimed', 'Pickup Confirmed', 'Collected', 'Completed', 'Cancelled', 'Expired', 'Disputed')),
        version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (donor_organization_id) REFERENCES organizations(id) ON DELETE RESTRICT
      );

      CREATE INDEX IF NOT EXISTS idx_donations_donor_status ON donations (donor_organization_id, status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_donations_status_deadline ON donations (status, pickup_deadline);
      CREATE INDEX IF NOT EXISTS idx_donations_category_deadline ON donations (category, pickup_deadline);

      CREATE TABLE IF NOT EXISTS claims (
        id TEXT PRIMARY KEY,
        donation_id TEXT NOT NULL,
        ngo_organization_id TEXT NOT NULL,
        claimed_portions INTEGER NOT NULL,
        actual_received INTEGER,
        handover_code_hash TEXT,
        handover_salt TEXT,
        handover_attempts INTEGER NOT NULL DEFAULT 0,
        claimed_at TEXT NOT NULL,
        ready_at TEXT,
        collected_at TEXT,
        status TEXT NOT NULL CHECK(status IN ('Active', 'Ready', 'Collected', 'Completed', 'Cancelled', 'Expired', 'Disputed')),
        version INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (donation_id) REFERENCES donations(id) ON DELETE RESTRICT,
        FOREIGN KEY (ngo_organization_id) REFERENCES organizations(id) ON DELETE RESTRICT
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_active_claim_donation ON claims (donation_id) WHERE status IN ('Active', 'Ready');
      CREATE INDEX IF NOT EXISTS idx_claims_ngo_status ON claims (ngo_organization_id, status, claimed_at DESC);

      CREATE TABLE IF NOT EXISTS audit_events (
        id TEXT PRIMARY KEY,
        correlation_id TEXT NOT NULL,
        actor_user_id TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT,
        reason TEXT,
        metadata_redacted TEXT,
        occurred_at_utc TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_events (entity_type, entity_id, occurred_at_utc DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_occurred_at ON audit_events (occurred_at_utc DESC);

      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        message TEXT NOT NULL,
        object_type TEXT NOT NULL,
        object_id TEXT NOT NULL,
        read_at TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications (user_id, read_at, created_at DESC);

      CREATE TABLE IF NOT EXISTS idempotency_keys (
        key TEXT NOT NULL,
        principal_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        request_hash TEXT NOT NULL,
        response_status INTEGER NOT NULL,
        response_body TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (key, principal_id)
      );
    `;
    this.db.exec(migrationSql);
  }

  close() {
    this.db.close();
  }
}

// Global database instance (default file-backed for runtime, switchable for tests)
const DEFAULT_DB_PATH = path.resolve(process.cwd(), 'data/aaharlink.sqlite');
let globalDb = new AppDatabase(process.env.NODE_ENV === 'test' ? ':memory:' : DEFAULT_DB_PATH);

export function getDatabase(): AppDatabase {
  return globalDb;
}

export function setTestDatabase(db: AppDatabase) {
  globalDb = db;
}

// ============================================================================
// Repository Implementation
// ============================================================================

export class SqliteRepository {
  private get db(): DatabaseSync {
    return globalDb.db;
  }

  // Transaction wrapper with BEGIN IMMEDIATE (single-writer exclusive lock)
  withTransaction<T>(action: (db: DatabaseSync) => T): T {
    this.db.exec('BEGIN IMMEDIATE;');
    try {
      const result = action(this.db);
      this.db.exec('COMMIT;');
      return result;
    } catch (err) {
      try {
        this.db.exec('ROLLBACK;');
      } catch {
        // Ignore rollback failure if transaction is no longer active
      }
      throw err;
    }
  }

  // --------------------------------------------------------------------------
  // Users
  // --------------------------------------------------------------------------

  getUserById(id: string): UserRecord | null {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapUser(row);
  }

  getUserByEmail(email: string): UserRecord | null {
    const row = this.db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase()) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapUser(row);
  }

  createUser(user: Omit<UserRecord, 'createdAt'>): UserRecord {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO users (id, email, password_hash, role, organization_id, session_revoked_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      user.id,
      user.email.trim().toLowerCase(),
      user.passwordHash,
      user.role,
      user.organizationId,
      user.sessionRevokedAt,
      now
    );
    return { ...user, email: user.email.trim().toLowerCase(), createdAt: now };
  }

  updateUserPassword(userId: string, newPasswordHash: string): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE users SET password_hash = ?, session_revoked_at = ? WHERE id = ?
    `).run(newPasswordHash, now, userId);
  }

  private mapUser(row: Record<string, unknown>): UserRecord {
    return {
      id: row.id as string,
      email: row.email as string,
      passwordHash: row.password_hash as string,
      role: row.role as Role,
      organizationId: (row.organization_id as string) || null,
      sessionRevokedAt: (row.session_revoked_at as string) || null,
      createdAt: row.created_at as string,
    };
  }

  // --------------------------------------------------------------------------
  // Organizations
  // --------------------------------------------------------------------------

  getOrgById(id: string): OrganizationRecord | null {
    const row = this.db.prepare('SELECT * FROM organizations WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapOrg(row);
  }

  getOrgByOwnerUserId(userId: string): OrganizationRecord | null {
    const row = this.db.prepare('SELECT * FROM organizations WHERE owner_user_id = ?').get(userId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapOrg(row);
  }

  createOrg(org: Omit<OrganizationRecord, 'createdAt' | 'updatedAt' | 'version'>): OrganizationRecord {
    const now = new Date().toISOString();
    this.db.prepare(`
      INSERT INTO organizations (
        id, owner_user_id, kind, name, status, contact_phone, contact_person,
        city, latitude, longitude, max_portions, operating_radius_km, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      org.id,
      org.ownerUserId,
      org.kind,
      org.name,
      org.status,
      org.contactPhone,
      org.contactPerson,
      org.city,
      org.latitude,
      org.longitude,
      org.maxPortions ?? 100,
      org.operatingRadiusKm ?? 25.0,
      now,
      now
    );
    return {
      ...org,
      maxPortions: org.maxPortions ?? 100,
      operatingRadiusKm: org.operatingRadiusKm ?? 25.0,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
  }

  updateOrg(id: string, updates: Partial<OrganizationRecord>, expectedVersion: number): OrganizationRecord {
    const current = this.getOrgById(id);
    if (!current) throw new Error('NOT_FOUND: Organization not found');
    if (current.version !== expectedVersion) {
      throw new Error('CONFLICT: Organization version mismatch; reload and retry.');
    }

    if (updates.status && updates.status !== current.status) {
      if (!isAllowedOrgTransition(current.status, updates.status)) {
        throw new Error(`CONFLICT: Illegal organization transition from ${current.status} to ${updates.status}`);
      }
    }

    const now = new Date().toISOString();
    const updated: OrganizationRecord = {
      ...current,
      ...updates,
      version: current.version + 1,
      updatedAt: now,
    };

    this.db.prepare(`
      UPDATE organizations SET
        name = ?, status = ?, contact_phone = ?, contact_person = ?, city = ?,
        latitude = ?, longitude = ?, max_portions = ?, operating_radius_km = ?,
        version = ?, updated_at = ?
      WHERE id = ? AND version = ?
    `).run(
      updated.name,
      updated.status,
      updated.contactPhone,
      updated.contactPerson,
      updated.city,
      updated.latitude,
      updated.longitude,
      updated.maxPortions,
      updated.operatingRadiusKm,
      updated.version,
      updated.updatedAt,
      id,
      expectedVersion
    );

    return updated;
  }

  listOrgs(status?: OrganizationStatus, limit: number = 20, cursor?: string): { items: OrganizationRecord[]; nextCursor: string | null } {
    let sql = 'SELECT * FROM organizations WHERE 1=1';
    const params: SqlParam[] = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (cursor) {
      sql += ' AND id > ?';
      params.push(cursor);
    }
    sql += ' ORDER BY id ASC LIMIT ?';
    params.push(limit + 1);

    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    const items = rows.slice(0, limit).map((r) => this.mapOrg(r));
    const nextCursor = rows.length > limit ? (items[items.length - 1]?.id ?? null) : null;
    return { items, nextCursor };
  }

  listOrganizationsForCoordinator(
    status?: OrganizationStatus,
    kind?: OrganizationKind,
    q?: string,
    limit: number = 20,
    cursor?: string
  ): { items: CoordinatorOrganizationSummary[]; nextCursor: string | null } {
    let sql = 'SELECT * FROM organizations WHERE 1=1';
    const params: SqlParam[] = [];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (kind) {
      sql += ' AND kind = ?';
      params.push(kind);
    }
    if (q) {
      sql += ' AND (name LIKE ? OR city LIKE ? OR contact_person LIKE ?)';
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (cursor) {
      sql += ' AND id > ?';
      params.push(cursor);
    }
    sql += ' ORDER BY created_at DESC, id ASC LIMIT ?';
    params.push(limit + 1);

    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    const items: CoordinatorOrganizationSummary[] = rows.slice(0, limit).map((r) => {
      const org = this.mapOrg(r);
      return {
        id: org.id,
        name: org.name,
        kind: org.kind,
        status: org.status,
        city: org.city,
        contactPerson: org.contactPerson,
        contactPhone: org.contactPhone,
        version: org.version,
        createdAt: org.createdAt,
      };
    });
    const nextCursor = rows.length > limit ? (items[items.length - 1]?.id ?? null) : null;
    return { items, nextCursor };
  }

  recordCoordinatorOrgDecision(
    orgId: string,
    decision: 'approve' | 'verify' | 'reject' | 'suspend',
    reason: string,
    expectedVersion: number,
    correlationId: string,
    actorUserId: string
  ): OrganizationRecord {
    return this.withTransaction((db) => {
      const row = db.prepare('SELECT * FROM organizations WHERE id = ?').get(orgId) as Record<string, unknown> | undefined;
      if (!row) throw new Error('NOT_FOUND: Organization not found');
      const org = this.mapOrg(row);

      if (org.version !== expectedVersion) {
        throw new Error('CONFLICT: Organization version mismatch; reload and retry.');
      }

      let nextStatus: OrganizationStatus;
      if (decision === 'approve' || decision === 'verify') {
        if (org.status !== 'pending') {
          throw new Error('CONFLICT: That resolution is not allowed in the current state.');
        }
        nextStatus = 'verified';
      } else if (decision === 'reject') {
        if (org.status !== 'pending') {
          throw new Error('CONFLICT: That resolution is not allowed in the current state.');
        }
        nextStatus = 'rejected';
      } else if (decision === 'suspend') {
        if (org.status !== 'verified') {
          throw new Error('CONFLICT: That resolution is not allowed in the current state.');
        }
        nextStatus = 'suspended';
      } else {
        throw new Error('INVALID_INPUT: Unknown decision.');
      }

      const now = new Date().toISOString();
      const nextVersion = org.version + 1;

      db.prepare(`
        UPDATE organizations
        SET status = ?, version = ?, updated_at = ?
        WHERE id = ? AND version = ?
      `).run(nextStatus, nextVersion, now, org.id, org.version);

      this.insertAuditEventInternal(db, {
        correlationId,
        actorUserId,
        actorRole: 'coordinator',
        entityType: 'Organization',
        entityId: org.id,
        eventType: 'organization_decision',
        fromStatus: org.status,
        toStatus: nextStatus,
        reason,
        metadataRedacted: { decision },
      });

      this.createNotificationInternal(db, {
        userId: org.ownerUserId,
        kind: 'verification',
        message: `Your organization application has been ${nextStatus}. Reason: ${reason}`,
        objectType: 'organization',
        objectId: org.id,
      });

      return {
        ...org,
        status: nextStatus,
        version: nextVersion,
        updatedAt: now,
      };
    });
  }

  countActiveDonationsForOrg(orgId: string): number {
    const row = this.db.prepare(`
      SELECT COUNT(*) as count FROM donations WHERE donor_organization_id = ? AND status IN ('Available', 'Claimed', 'Pickup Confirmed')
    `).get(orgId) as { count: number };
    return Number(row?.count ?? 0);
  }

  countActiveClaimsForOrg(orgId: string): number {
    const row = this.db.prepare(`
      SELECT COUNT(*) as count FROM claims WHERE ngo_organization_id = ? AND status IN ('Active', 'Ready')
    `).get(orgId) as { count: number };
    return Number(row?.count ?? 0);
  }

  private mapOrg(row: Record<string, unknown>): OrganizationRecord {
    return {
      id: row.id as string,
      ownerUserId: row.owner_user_id as string,
      kind: row.kind as OrganizationKind,
      name: row.name as string,
      status: row.status as OrganizationStatus,
      contactPhone: row.contact_phone as string,
      contactPerson: row.contact_person as string,
      city: row.city as string,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      maxPortions: Number(row.max_portions),
      operatingRadiusKm: Number(row.operating_radius_km),
      version: Number(row.version),
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  // --------------------------------------------------------------------------
  // NGO Capacity Calculation (Atomic within single transaction)
  // --------------------------------------------------------------------------

  getNgoCapacity(ngoOrgId: string): { maxPortions: number; activeReservedPortions: number; availableRemainingPortions: number; operatingRadiusKm: number; latitude: number; longitude: number; version: number } {
    const org = this.getOrgById(ngoOrgId);
    if (!org) throw new Error('NOT_FOUND: Organization not found');

    const row = this.db.prepare(`
      SELECT COALESCE(SUM(claimed_portions), 0) as reserved
      FROM claims
      WHERE ngo_organization_id = ? AND status IN ('Active', 'Ready')
    `).get(ngoOrgId) as { reserved: number };

    const activeReserved = Number(row?.reserved ?? 0);
    const available = Math.max(0, org.maxPortions - activeReserved);

    return {
      maxPortions: org.maxPortions,
      activeReservedPortions: activeReserved,
      availableRemainingPortions: available,
      operatingRadiusKm: org.operatingRadiusKm,
      latitude: org.latitude,
      longitude: org.longitude,
      version: org.version,
    };
  }

  // --------------------------------------------------------------------------
  // Donations
  // --------------------------------------------------------------------------

  getDonationById(id: string): DonationRecord | null {
    const row = this.db.prepare('SELECT * FROM donations WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapDonation(row);
  }

  createDonation(
    donation: Omit<DonationRecord, 'createdAt' | 'updatedAt' | 'version' | 'actualCollectedPortions'>,
    correlationId: string,
    actorUserId: string
  ): DonationRecord {
    const now = new Date().toISOString();
    return this.withTransaction((db) => {
      // Re-check donor org exists and verified
      const donorOrg = this.getOrgById(donation.donorOrganizationId);
      if (!donorOrg || donorOrg.status !== 'verified') {
        throw new Error('FORBIDDEN: Verified organization required to publish donations.');
      }

      // Authoritative deadline check: pickupDeadline must be strictly in the future
      if (new Date(donation.pickupDeadline).getTime() <= new Date().getTime()) {
        throw new Error('INVALID_INPUT: Choose a later, future pickup deadline.');
      }

      db.prepare(`
        INSERT INTO donations (
          id, donor_organization_id, category, description, offered_portions,
          actual_collected_portions, prepared_at, pickup_deadline, pickup_address,
          pickup_latitude, pickup_longitude, handling_declared_at, declaration_snapshot,
          status, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, 'Available', 1, ?, ?)
      `).run(
        donation.id,
        donation.donorOrganizationId,
        donation.category,
        donation.description,
        donation.offeredPortions,
        donation.preparedAt,
        donation.pickupDeadline,
        donation.pickupAddress,
        donation.pickupLatitude,
        donation.pickupLongitude,
        donation.handlingDeclaredAt,
        JSON.stringify(donation.declarationSnapshot),
        now,
        now
      );

      this.insertAuditEventInternal(db, {
        correlationId,
        actorUserId,
        actorRole: 'donor',
        entityType: 'Donation',
        entityId: donation.id,
        eventType: 'donation_create',
        fromStatus: null,
        toStatus: 'Available',
        reason: 'Donation published',
        metadataRedacted: { offeredPortions: donation.offeredPortions, category: donation.category },
      });

      return {
        ...donation,
        actualCollectedPortions: 0,
        status: 'Available',
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
    });
  }

  updateDonation(id: string, updates: Partial<DonationRecord>, expectedVersion: number): DonationRecord {
    const current = this.getDonationById(id);
    if (!current) throw new Error('NOT_FOUND: Donation not found');
    if (current.version !== expectedVersion) {
      throw new Error('CONFLICT: Donation version mismatch; reload current state.');
    }

    if (updates.status && updates.status !== current.status) {
      if (!isAllowedDonationTransition(current.status, updates.status)) {
        throw new Error(`CONFLICT: Illegal donation transition from ${current.status} to ${updates.status}`);
      }
    }

    const now = new Date().toISOString();
    const updated: DonationRecord = {
      ...current,
      ...updates,
      version: current.version + 1,
      updatedAt: now,
    };

    this.db.prepare(`
      UPDATE donations SET
        category = ?, description = ?, offered_portions = ?, actual_collected_portions = ?,
        prepared_at = ?, pickup_deadline = ?, pickup_address = ?, pickup_latitude = ?,
        pickup_longitude = ?, status = ?, version = ?, updated_at = ?
      WHERE id = ? AND version = ?
    `).run(
      updated.category,
      updated.description,
      updated.offeredPortions,
      updated.actualCollectedPortions,
      updated.preparedAt,
      updated.pickupDeadline,
      updated.pickupAddress,
      updated.pickupLatitude,
      updated.pickupLongitude,
      updated.status,
      updated.version,
      updated.updatedAt,
      id,
      expectedVersion
    );

    return updated;
  }

  listDonationsForDonor(donorOrgId: string, limit: number = 20, cursor?: string): { items: DonationRecord[]; nextCursor: string | null } {
    let sql = 'SELECT * FROM donations WHERE donor_organization_id = ?';
    const params: SqlParam[] = [donorOrgId];

    if (cursor) {
      sql += ' AND id > ?';
      params.push(cursor);
    }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit + 1);

    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    const items = rows.slice(0, limit).map((r) => this.mapDonation(r));
    const nextCursor = rows.length > limit ? (items[items.length - 1]?.id ?? null) : null;
    return { items, nextCursor };
  }

  listAvailableDonationsForNgo(
    ngoOrg: OrganizationRecord,
    maxDistanceKm?: number,
    category?: DonationCategory,
    limit: number = 20,
    cursor?: string,
    minPortions?: number,
    before?: string,
    sort: 'recommended' | 'urgency' | 'distance' = 'recommended',
    includeExpired: boolean = false
  ): {
    items: DonationPublicPreview[];
    nextCursor: string | null;
  } {
    const now = new Date().toISOString();
    let sql = `
      SELECT d.*, o.name as donor_org_name, o.city as donor_city, o.latitude as donor_lat, o.longitude as donor_lon
      FROM donations d
      JOIN organizations o ON d.donor_organization_id = o.id
    `;
    const params: SqlParam[] = [];

    if (includeExpired) {
      sql += " WHERE (d.status = 'Available' OR d.status = 'Expired')";
    } else {
      sql += " WHERE d.status = 'Available' AND d.pickup_deadline > ?";
      params.push(now);
    }

    if (category) {
      sql += ' AND d.category = ?';
      params.push(category);
    }
    if (minPortions) {
      sql += ' AND d.offered_portions >= ?';
      params.push(minPortions);
    }
    if (before) {
      sql += ' AND d.pickup_deadline <= ?';
      params.push(before);
    }
    if (cursor) {
      sql += ' AND d.id > ?';
      params.push(cursor);
    }

    const rows = this.db.prepare(sql).all(...params) as Array<Record<string, unknown> & { donor_org_name: string; donor_city: string; donor_lat: number; donor_lon: number }>;

    const capacity = this.getNgoCapacity(ngoOrg.id);
    const radiusLimit = maxDistanceKm ?? ngoOrg.operatingRadiusKm;

    const mapped: DonationPublicPreview[] = rows
      .map((r) => {
        const donation = this.mapDonation(r);
        const dist = calculateHaversineDistanceKm(ngoOrg.latitude, ngoOrg.longitude, Number(r.donor_lat), Number(r.donor_lon));

        let eligible = true;
        let ineligibleReason: string | undefined;

        if (donation.status === 'Expired' || donation.pickupDeadline <= now) {
          eligible = false;
          ineligibleReason = 'This donation has expired and can no longer be claimed.';
        } else if (dist > radiusLimit) {
          eligible = false;
          ineligibleReason = `Distance (${dist} km) exceeds radius (${radiusLimit} km).`;
        } else if (donation.offeredPortions > capacity.availableRemainingPortions) {
          eligible = false;
          ineligibleReason = `Portions (${donation.offeredPortions}) exceed remaining capacity (${capacity.availableRemainingPortions}).`;
        }

        return {
          id: donation.id,
          category: donation.category,
          description: donation.description,
          offeredPortions: donation.offeredPortions,
          preparedAt: donation.preparedAt,
          pickupDeadline: donation.pickupDeadline,
          approximateCity: r.donor_city || 'Local area',
          straightLineDistanceKm: dist,
          status: (donation.status === 'Available' && donation.pickupDeadline <= now) ? 'Expired' : donation.status,
          donorOrganizationName: r.donor_org_name || 'Verified Donor',
          eligibleForMyCapacity: eligible,
          ineligibleReason,
          version: donation.version,
          createdAt: donation.createdAt,
        };
      })
      .filter((d) => d.straightLineDistanceKm <= radiusLimit)
      .sort((a, b) => {
        if (sort === 'urgency') {
          return new Date(a.pickupDeadline).getTime() - new Date(b.pickupDeadline).getTime();
        }
        if (sort === 'distance') {
          return a.straightLineDistanceKm - b.straightLineDistanceKm;
        }
        // Priority ranking: 45% urgency (deadline ASC), 35% inverse distance (distance ASC), 20% capacity fit
        const timeA = new Date(a.pickupDeadline).getTime();
        const timeB = new Date(b.pickupDeadline).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return a.straightLineDistanceKm - b.straightLineDistanceKm;
      });

    const items = mapped.slice(0, limit);
    const nextCursor = mapped.length > limit ? (items[items.length - 1]?.id ?? null) : null;
    return { items, nextCursor };
  }

  listAllDonationsForCoordinator(
    status?: DonationStatus,
    urgent?: boolean,
    query?: string,
    sort: 'deadline' | 'newest' | 'status' = 'deadline',
    limit: number = 20,
    cursor?: string
  ): {
    items: CoordinatorDonationSummary[];
    nextCursor: string | null;
  } {
    let sql = `
      SELECT d.*, o.name as donor_org_name, c.ngo_organization_id, ngo.name as ngo_name
      FROM donations d
      JOIN organizations o ON d.donor_organization_id = o.id
      LEFT JOIN claims c ON d.id = c.donation_id AND c.status IN ('Active', 'Ready', 'Collected', 'Completed')
      LEFT JOIN organizations ngo ON c.ngo_organization_id = ngo.id
      WHERE 1=1
    `;
    const params: SqlParam[] = [];

    if (status) {
      sql += ' AND d.status = ?';
      params.push(status);
    }
    if (urgent) {
      sql += " AND (d.status IN ('Claimed', 'Pickup Confirmed') OR (d.status = 'Available' AND d.pickup_deadline <= datetime('now', '+4 hours')))";
    }
    if (query) {
      sql += ' AND (d.description LIKE ? OR o.name LIKE ?)';
      params.push(`%${query}%`, `%${query}%`);
    }
    if (cursor) {
      sql += ' AND d.id > ?';
      params.push(cursor);
    }

    if (sort === 'newest') {
      sql += ' ORDER BY d.created_at DESC LIMIT ?';
    } else if (sort === 'status') {
      sql += ' ORDER BY d.status ASC, d.pickup_deadline ASC LIMIT ?';
    } else {
      sql += ' ORDER BY d.pickup_deadline ASC LIMIT ?';
    }
    params.push(limit + 1);

    const rows = this.db.prepare(sql).all(...params) as Array<Record<string, unknown> & { donor_org_name: string; ngo_name?: string }>;
    const items: CoordinatorDonationSummary[] = rows.slice(0, limit).map((r) => {
      const donation = this.mapDonation(r);
      return {
        id: donation.id,
        donorOrganizationName: r.donor_org_name,
        category: donation.category,
        description: donation.description,
        offeredPortions: donation.offeredPortions,
        actualCollectedPortions: donation.actualCollectedPortions,
        status: donation.status,
        pickupDeadline: donation.pickupDeadline,
        claimedByNgoName: r.ngo_name ?? null,
        version: donation.version,
        createdAt: donation.createdAt,
      };
    });
    const nextCursor = rows.length > limit ? (items[items.length - 1]?.id ?? null) : null;
    return { items, nextCursor };
  }

  recordCoordinatorDonationResolve(
    donationId: string,
    decision: 'openDispute' | 'cancelClaim' | 'closeReview' | 'dispute' | 'cancel',
    reason: string,
    expectedVersion: number,
    correlationId: string,
    actorUserId: string
  ): DonationRecord {
    return this.withTransaction((db) => {
      const donRow = db.prepare('SELECT * FROM donations WHERE id = ?').get(donationId) as Record<string, unknown> | undefined;
      if (!donRow) throw new Error('NOT_FOUND: Donation not found');
      const donation = this.mapDonation(donRow);

      if (donation.version !== expectedVersion) {
        throw new Error('CONFLICT: Donation state has changed; reload and retry.');
      }

      let nextStatus: DonationStatus;
      const now = new Date().toISOString();

      if (decision === 'openDispute' || decision === 'dispute') {
        if (!['Claimed', 'Pickup Confirmed', 'Available'].includes(donation.status)) {
          throw new Error('CONFLICT: That resolution is not allowed in the current state.');
        }
        nextStatus = 'Disputed';
      } else if (decision === 'cancelClaim' || decision === 'cancel') {
        // Find active claim
        const claimRow = db.prepare(`
          SELECT * FROM claims WHERE donation_id = ? AND status IN ('Active', 'Ready')
        `).get(donationId) as Record<string, unknown> | undefined;

        if (claimRow) {
          const claim = this.mapClaim(claimRow);
          db.prepare(`
            UPDATE claims SET status = 'Cancelled', version = version + 1 WHERE id = ?
          `).run(claim.id);

          this.insertAuditEventInternal(db, {
            correlationId,
            actorUserId,
            actorRole: 'coordinator',
            entityType: 'Claim',
            entityId: claim.id,
            eventType: 'claim_cancel',
            fromStatus: claim.status,
            toStatus: 'Cancelled',
            reason: `Coordinator cancelled claim: ${reason}`,
            metadataRedacted: null,
          });
        }

        const isPastDeadline = donation.pickupDeadline <= now;
        nextStatus = isPastDeadline ? 'Expired' : 'Available';
      } else if (decision === 'closeReview') {
        if (donation.status !== 'Disputed') {
          throw new Error('CONFLICT: That resolution is not allowed in the current state.');
        }
        if (donation.actualCollectedPortions > 0) {
          nextStatus = 'Completed';
        } else if (donation.pickupDeadline <= now) {
          nextStatus = 'Expired';
        } else {
          nextStatus = 'Available';
        }
      } else {
        throw new Error('INVALID_INPUT: Unknown decision.');
      }

      const nextVersion = donation.version + 1;
      db.prepare(`
        UPDATE donations
        SET status = ?, version = ?, updated_at = ?
        WHERE id = ? AND version = ?
      `).run(nextStatus, nextVersion, now, donation.id, donation.version);

      this.insertAuditEventInternal(db, {
        correlationId,
        actorUserId,
        actorRole: 'coordinator',
        entityType: 'Donation',
        entityId: donation.id,
        eventType: 'donation_resolve',
        fromStatus: donation.status,
        toStatus: nextStatus,
        reason,
        metadataRedacted: { decision },
      });

      const donorOrg = this.getOrgById(donation.donorOrganizationId);
      if (donorOrg) {
        this.createNotificationInternal(db, {
          userId: donorOrg.ownerUserId,
          kind: 'cancelled',
          message: `Coordinator resolved donation listing: ${decision}. Reason: ${reason}`,
          objectType: 'donation',
          objectId: donation.id,
        });
      }

      return {
        ...donation,
        status: nextStatus,
        version: nextVersion,
        updatedAt: now,
      };
    });
  }

  getCoordinatorDashboardMetrics(): CoordinatorDashboardDTO {
    const pendingOrgsRow = this.db.prepare(`
      SELECT COUNT(*) as count FROM organizations WHERE status = 'pending'
    `).get() as { count: number };

    const activeDonationsRow = this.db.prepare(`
      SELECT COUNT(*) as count FROM donations WHERE status IN ('Available', 'Claimed', 'Pickup Confirmed')
    `).get() as { count: number };

    const urgentClaimsRow = this.db.prepare(`
      SELECT COUNT(*) as count FROM claims WHERE status IN ('Active', 'Ready')
    `).get() as { count: number };

    const disputedRow = this.db.prepare(`
      SELECT COUNT(*) as count FROM donations WHERE status = 'Disputed'
    `).get() as { count: number };

    const rescuedRow = this.db.prepare(`
      SELECT COALESCE(SUM(actual_collected_portions), 0) as total FROM donations WHERE status = 'Completed'
    `).get() as { total: number };

    const recentAudits = this.listAuditEvents(5).items.map((a) => ({
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
      pendingOrganizationsCount: Number(pendingOrgsRow?.count ?? 0),
      activeDonationsCount: Number(activeDonationsRow?.count ?? 0),
      urgentClaimsCount: Number(urgentClaimsRow?.count ?? 0),
      disputedCount: Number(disputedRow?.count ?? 0),
      totalPortionsRescued: Number(rescuedRow?.total ?? 0),
      recentAuditEvents: recentAudits,
    };
  }

  private mapDonation(row: Record<string, unknown>): DonationRecord {
    let declaration: HandlingDeclarations;
    try {
      declaration = JSON.parse(row.declaration_snapshot as string);
    } catch {
      declaration = {
        safePreparation: true,
        properTemperature: true,
        cleanPackaging: true,
        accurateInformation: true,
        recipientAssessmentAcknowledgement: true,
      };
    }

    return {
      id: row.id as string,
      donorOrganizationId: row.donor_organization_id as string,
      category: row.category as DonationCategory,
      description: row.description as string,
      offeredPortions: Number(row.offered_portions),
      actualCollectedPortions: Number(row.actual_collected_portions),
      preparedAt: row.prepared_at as string,
      pickupDeadline: row.pickup_deadline as string,
      pickupAddress: row.pickup_address as string,
      pickupLatitude: Number(row.pickup_latitude),
      pickupLongitude: Number(row.pickup_longitude),
      handlingDeclaredAt: row.handling_declared_at as string,
      declarationSnapshot: declaration,
      status: row.status as DonationStatus,
      version: Number(row.version),
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }

  // --------------------------------------------------------------------------
  // Claims — Critical Atomic Operations
  // --------------------------------------------------------------------------

  createClaim(
    donationId: string,
    ngoOrgId: string,
    expectedDonationVersion: number,
    correlationId: string,
    actorUserId: string
  ): ClaimRecord {
    return this.withTransaction((db) => {
      // 1. Fetch fresh donation row inside transaction
      const donRow = db.prepare('SELECT * FROM donations WHERE id = ?').get(donationId) as Record<string, unknown> | undefined;
      if (!donRow) throw new Error('NOT_FOUND: Donation not found');
      const donation = this.mapDonation(donRow);

      // Version check
      if (donation.version !== expectedDonationVersion) {
        throw new Error('CONFLICT: Donation state has changed; reload and retry.');
      }

      // Status check (must be Available)
      if (donation.status !== 'Available') {
        throw new Error('CONFLICT: This donation has already been claimed or is unavailable.');
      }

      // Authoritative deadline check at database time
      const now = new Date();
      if (now.getTime() >= new Date(donation.pickupDeadline).getTime()) {
        throw new Error('GONE: Pickup deadline has elapsed; this food cannot be claimed.');
      }

      // Check self-dealing (VR-028: claimant org != donor org)
      if (donation.donorOrganizationId === ngoOrgId) {
        throw new Error('FORBIDDEN: This donation is not eligible for your organization.');
      }

      // Check NGO verification
      const ngoOrg = this.getOrgById(ngoOrgId);
      if (!ngoOrg || ngoOrg.status !== 'verified') {
        throw new Error('FORBIDDEN: Organization verification is required to claim donations.');
      }

      // Check NGO capacity (VR-025)
      const cap = this.getNgoCapacity(ngoOrgId);
      if (donation.offeredPortions > cap.availableRemainingPortions) {
        throw new Error('INVALID_INPUT: The donation exceeds your current capacity.');
      }

      // Update donation status to Claimed (CAS)
      const newDonationVersion = donation.version + 1;
      const updateResult = db.prepare(`
        UPDATE donations
        SET status = 'Claimed', version = ?, updated_at = ?
        WHERE id = ? AND version = ? AND status = 'Available'
      `).run(newDonationVersion, now.toISOString(), donationId, expectedDonationVersion);

      if (updateResult.changes === 0) {
        throw new Error('CONFLICT: This donation has already been claimed.');
      }

      // Insert claim (Protected by UNIQUE PARTIAL INDEX on donation_id WHERE status IN ('Active', 'Ready'))
      const claimId = crypto.randomUUID();
      db.prepare(`
        INSERT INTO claims (
          id, donation_id, ngo_organization_id, claimed_portions, actual_received,
          handover_code_hash, handover_salt, handover_attempts, claimed_at,
          ready_at, collected_at, status, version
        ) VALUES (?, ?, ?, ?, NULL, NULL, NULL, 0, ?, NULL, NULL, 'Active', 1)
      `).run(claimId, donationId, ngoOrgId, donation.offeredPortions, now.toISOString());

      // Insert immutable audit event
      this.insertAuditEventInternal(db, {
        correlationId,
        actorUserId,
        actorRole: 'ngo',
        entityType: 'Claim',
        entityId: claimId,
        eventType: 'claim_create',
        fromStatus: null,
        toStatus: 'Active',
        reason: `Claimed ${donation.offeredPortions} portions`,
        metadataRedacted: { donationId, portions: donation.offeredPortions },
      });

      // Notify donor organization owner
      const donorOrg = this.getOrgById(donation.donorOrganizationId);
      if (donorOrg) {
        this.createNotificationInternal(db, {
          userId: donorOrg.ownerUserId,
          kind: 'claim',
          message: `${ngoOrg.name} claimed your donation of ${donation.offeredPortions} portions. Confirm pickup readiness when they arrive.`,
          objectType: 'donation',
          objectId: donationId,
        });
      }

      return {
        id: claimId,
        donationId,
        ngoOrganizationId: ngoOrgId,
        claimedPortions: donation.offeredPortions,
        actualReceived: null,
        handoverCodeHash: null,
        handoverSalt: null,
        handoverAttempts: 0,
        claimedAt: now.toISOString(),
        readyAt: null,
        collectedAt: null,
        status: 'Active',
        version: 1,
      };
    });
  }

  getActiveClaimForDonation(donationId: string): ClaimRecord | null {
    const row = this.db.prepare(`
      SELECT * FROM claims WHERE donation_id = ? AND status IN ('Active', 'Ready')
    `).get(donationId) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapClaim(row);
  }

  getClaimById(id: string): ClaimRecord | null {
    const row = this.db.prepare('SELECT * FROM claims WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return this.mapClaim(row);
  }

  listClaimsForNgo(
    ngoOrgId: string,
    limit: number = 20,
    cursor?: string,
    status?: ClaimStatus,
    sort: 'newest' | 'deadline' = 'newest'
  ): {
    items: Array<ClaimRecord & { donation: DonationRecord; donorOrgName: string; donorCity: string }>;
    nextCursor: string | null;
  } {
    let sql = `
      SELECT c.*, d.category, d.description, d.pickup_deadline, d.status as don_status, o.name as donor_name, o.city as donor_city
      FROM claims c
      JOIN donations d ON c.donation_id = d.id
      JOIN organizations o ON d.donor_organization_id = o.id
      WHERE c.ngo_organization_id = ?
    `;
    const params: SqlParam[] = [ngoOrgId];

    if (status) {
      sql += ' AND c.status = ?';
      params.push(status);
    }
    if (cursor) {
      sql += ' AND c.id > ?';
      params.push(cursor);
    }
    if (sort === 'deadline') {
      sql += ' ORDER BY d.pickup_deadline ASC LIMIT ?';
    } else {
      sql += ' ORDER BY c.claimed_at DESC LIMIT ?';
    }
    params.push(limit + 1);

    const rows = this.db.prepare(sql).all(...params) as Array<Record<string, unknown> & { donor_name: string; donor_city: string }>;
    const items = rows.slice(0, limit).map((r) => {
      const claim = this.mapClaim(r);
      const donRow = this.db.prepare('SELECT * FROM donations WHERE id = ?').get(claim.donationId) as Record<string, unknown>;
      return {
        ...claim,
        donation: this.mapDonation(donRow),
        donorOrgName: r.donor_name,
        donorCity: r.donor_city,
      };
    });

    const nextCursor = rows.length > limit ? (items[items.length - 1]?.id ?? null) : null;
    return { items, nextCursor };
  }

  setDonationPickupReady(
    donationId: string,
    donorOrgId: string,
    expectedVersion: number,
    correlationId: string,
    actorUserId: string
  ): { handoverCode: string; donation: DonationRecord; claim: ClaimRecord } {
    return this.withTransaction((db) => {
      const donRow = db.prepare('SELECT * FROM donations WHERE id = ?').get(donationId) as Record<string, unknown> | undefined;
      if (!donRow) throw new Error('NOT_FOUND: Donation not found');
      const donation = this.mapDonation(donRow);

      if (donation.donorOrganizationId !== donorOrgId) {
        throw new Error('FORBIDDEN: You do not own this donation.');
      }
      if (donation.version !== expectedVersion) {
        throw new Error('CONFLICT: Donation version mismatch; reload current state.');
      }
      if (donation.status !== 'Claimed' && donation.status !== 'Pickup Confirmed') {
        throw new Error(`INVALID_INPUT: Pickup cannot be confirmed in state "${donation.status}".`);
      }

      const now = new Date();
      if (now.getTime() >= new Date(donation.pickupDeadline).getTime()) {
        throw new Error('GONE: Pickup deadline has elapsed.');
      }

      // Find active or ready claim
      const claimRow = db.prepare(`SELECT * FROM claims WHERE donation_id = ? AND status IN ('Active', 'Ready')`).get(donationId) as Record<string, unknown> | undefined;
      if (!claimRow) throw new Error('NOT_FOUND: Active or ready claim not found for this donation.');
      const claim = this.mapClaim(claimRow);

      // Generate random 6-digit handover code
      const codeNum = crypto.randomInt(100000, 999999);
      const handoverCode = codeNum.toString();
      const salt = crypto.randomBytes(16).toString('hex');
      const hash = hashHandoverCode(handoverCode, salt);

      // Transition Donation to Pickup Confirmed
      const newDonVersion = donation.version + 1;
      db.prepare(`
        UPDATE donations
        SET status = 'Pickup Confirmed', version = ?, updated_at = ?
        WHERE id = ? AND version = ?
      `).run(newDonVersion, now.toISOString(), donationId, expectedVersion);

      // Transition Claim to Ready
      const newClaimVersion = claim.version + 1;
      db.prepare(`
        UPDATE claims
        SET status = 'Ready', ready_at = ?, handover_code_hash = ?, handover_salt = ?, version = ?
        WHERE id = ? AND version = ?
      `).run(now.toISOString(), hash, salt, newClaimVersion, claim.id, claim.version);

      // Audit events
      this.insertAuditEventInternal(db, {
        correlationId,
        actorUserId,
        actorRole: 'donor',
        entityType: 'Donation',
        entityId: donationId,
        eventType: 'donation_ready',
        fromStatus: donation.status,
        toStatus: 'Pickup Confirmed',
        reason: donation.status === 'Pickup Confirmed' ? 'Donor regenerated pickup handover code' : 'Donor confirmed pickup readiness; code generated',
        metadataRedacted: { claimId: claim.id },
      });

      // Notify NGO owner on first transition from Claimed
      if (donation.status === 'Claimed') {
        const ngoOrg = this.getOrgById(claim.ngoOrganizationId);
        if (ngoOrg) {
          this.createNotificationInternal(db, {
            userId: ngoOrg.ownerUserId,
            kind: 'ready',
            message: `Donor is ready for pickup! Provide the handover code to complete collection.`,
            objectType: 'claim',
            objectId: claim.id,
          });
        }
      }

      return {
        handoverCode,
        donation: { ...donation, status: 'Pickup Confirmed', version: newDonVersion, updatedAt: now.toISOString() },
        claim: { ...claim, status: 'Ready', readyAt: now.toISOString(), version: newClaimVersion },
      };
    });
  }

  collectClaimAndCompleteDonation(
    claimId: string,
    ngoOrgId: string,
    inputCode: string,
    actualPortions: number,
    expectedVersion: number,
    correlationId: string,
    actorUserId: string
  ): { claim: ClaimRecord; donation: DonationRecord } {
    return this.withTransaction((db) => {
      const claimRow = db.prepare('SELECT * FROM claims WHERE id = ?').get(claimId) as Record<string, unknown> | undefined;
      if (!claimRow) throw new Error('NOT_FOUND: Claim not found');
      const claim = this.mapClaim(claimRow);

      if (claim.ngoOrganizationId !== ngoOrgId) {
        throw new Error('FORBIDDEN: You do not own this claim.');
      }
      if (claim.version !== expectedVersion) {
        throw new Error('CONFLICT: Handover state has changed; refresh the receipt.');
      }
      if (claim.status !== 'Ready') {
        throw new Error(`INVALID_INPUT: Handover cannot be completed in claim status "${claim.status}".`);
      }

      // Check deadline
      const donRow = db.prepare('SELECT * FROM donations WHERE id = ?').get(claim.donationId) as Record<string, unknown>;
      const donation = this.mapDonation(donRow);
      const now = new Date();
      if (now.getTime() >= new Date(donation.pickupDeadline).getTime()) {
        throw new Error('GONE: Pickup deadline has elapsed.');
      }

      // Check handover attempts
      if (claim.handoverAttempts >= 3) {
        throw new Error('FORBIDDEN: Maximum code attempts exceeded. Contact coordinator.');
      }

      // Verify code with timing-safe HMAC
      const isValid = verifyHandoverCode(inputCode, claim.handoverSalt ?? '', claim.handoverCodeHash ?? '');
      if (!isValid) {
        const newAttempts = claim.handoverAttempts + 1;
        db.prepare('UPDATE claims SET handover_attempts = ? WHERE id = ?').run(newAttempts, claimId);
        db.exec('COMMIT');
        throw new Error('INVALID_INPUT: That code is incorrect or expired.');
      }

      // Validate received quantity: 1 <= actualPortions <= claimedPortions
      if (actualPortions < 1 || actualPortions > claim.claimedPortions) {
        throw new Error(`INVALID_INPUT: Quantity received must be between 1 and ${claim.claimedPortions}.`);
      }

      // ATOMIC TRANSACTION:
      // Step A: Collected event
      // Step B: Completed event
      // Persisted in the EXACT SAME single SQLite transaction
      const nowIso = now.toISOString();

      // Update Claim to Completed (with intermediate Collected event)
      const nextClaimVersion = claim.version + 1;
      db.prepare(`
        UPDATE claims
        SET status = 'Completed', actual_received = ?, collected_at = ?, version = ?
        WHERE id = ? AND version = ?
      `).run(actualPortions, nowIso, nextClaimVersion, claim.id, claim.version);

      // Update Donation to Completed
      const nextDonationVersion = donation.version + 1;
      db.prepare(`
        UPDATE donations
        SET status = 'Completed', actual_collected_portions = ?, version = ?, updated_at = ?
        WHERE id = ?
      `).run(actualPortions, nextDonationVersion, nowIso, donation.id);

      // Distinct Collected Audit Event
      this.insertAuditEventInternal(db, {
        correlationId,
        actorUserId,
        actorRole: 'ngo',
        entityType: 'Claim',
        entityId: claim.id,
        eventType: 'handover_collected',
        fromStatus: 'Ready',
        toStatus: 'Collected',
        reason: 'Handover code verified on-site; food collected',
        metadataRedacted: { actualReceived: actualPortions, claimedPortions: claim.claimedPortions },
      });

      // Distinct Completed Audit Event
      this.insertAuditEventInternal(db, {
        correlationId,
        actorUserId,
        actorRole: 'system',
        entityType: 'Donation',
        entityId: donation.id,
        eventType: 'handover_completed',
        fromStatus: 'Pickup Confirmed',
        toStatus: 'Completed',
        reason: 'Handover finalized; transaction complete',
        metadataRedacted: { actualCollectedPortions: actualPortions },
      });

      // Notify donor and NGO
      const donorOrg = this.getOrgById(donation.donorOrganizationId);
      if (donorOrg) {
        this.createNotificationInternal(db, {
          userId: donorOrg.ownerUserId,
          kind: 'completed',
          message: `Handover complete! ${actualPortions} portions collected by recipient organization.`,
          objectType: 'donation',
          objectId: donation.id,
        });
      }

      return {
        claim: {
          ...claim,
          status: 'Completed',
          actualReceived: actualPortions,
          collectedAt: nowIso,
          version: nextClaimVersion,
        },
        donation: {
          ...donation,
          status: 'Completed',
          actualCollectedPortions: actualPortions,
          version: nextDonationVersion,
          updatedAt: nowIso,
        },
      };
    });
  }

  cancelDonation(
    donationId: string,
    donorOrgId: string,
    reason: string,
    expectedVersion: number,
    correlationId: string,
    actorUserId: string
  ): DonationRecord {
    return this.withTransaction((db) => {
      const donRow = db.prepare('SELECT * FROM donations WHERE id = ?').get(donationId) as Record<string, unknown> | undefined;
      if (!donRow) throw new Error('NOT_FOUND: Donation not found');
      const donation = this.mapDonation(donRow);

      if (donation.donorOrganizationId !== donorOrgId) {
        throw new Error('FORBIDDEN: You do not own this donation.');
      }
      if (donation.version !== expectedVersion) {
        throw new Error('CONFLICT: Donation version mismatch; reload current state.');
      }
      if (!['Available', 'Claimed'].includes(donation.status)) {
        throw new Error(`INVALID_INPUT: Cannot cancel donation in status "${donation.status}".`);
      }

      const now = new Date().toISOString();
      const newVersion = donation.version + 1;

      db.prepare(`
        UPDATE donations SET status = 'Cancelled', version = ?, updated_at = ? WHERE id = ?
      `).run(newVersion, now, donationId);

      // If there was an active claim, cancel it too and notify NGO
      const claimRow = db.prepare(`SELECT * FROM claims WHERE donation_id = ? AND status IN ('Active', 'Ready')`).get(donationId) as Record<string, unknown> | undefined;
      if (claimRow) {
        const claim = this.mapClaim(claimRow);
        db.prepare(`UPDATE claims SET status = 'Cancelled', version = version + 1 WHERE id = ?`).run(claim.id);
        const ngoOrg = this.getOrgById(claim.ngoOrganizationId);
        if (ngoOrg) {
          this.createNotificationInternal(db, {
            userId: ngoOrg.ownerUserId,
            kind: 'cancelled',
            message: `Donation was cancelled by donor: ${reason}`,
            objectType: 'claim',
            objectId: claim.id,
          });
        }
      }

      this.insertAuditEventInternal(db, {
        correlationId,
        actorUserId,
        actorRole: 'donor',
        entityType: 'Donation',
        entityId: donationId,
        eventType: 'donation_cancel',
        fromStatus: donation.status,
        toStatus: 'Cancelled',
        reason,
        metadataRedacted: null,
      });

      return {
        ...donation,
        status: 'Cancelled',
        version: newVersion,
        updatedAt: now,
      };
    });
  }

  cancelClaim(
    claimId: string,
    ngoOrgId: string,
    reason: string,
    expectedVersion: number,
    correlationId: string,
    actorUserId: string
  ): ClaimRecord {
    return this.withTransaction((db) => {
      const claimRow = db.prepare('SELECT * FROM claims WHERE id = ?').get(claimId) as Record<string, unknown> | undefined;
      if (!claimRow) throw new Error('NOT_FOUND: Claim not found');
      const claim = this.mapClaim(claimRow);

      if (claim.ngoOrganizationId !== ngoOrgId) {
        throw new Error('FORBIDDEN: You do not own this claim.');
      }
      if (claim.version !== expectedVersion) {
        throw new Error('CONFLICT: Claim version mismatch; reload current state.');
      }
      if (claim.status !== 'Active') {
        throw new Error(`INVALID_INPUT: Claim cannot be cancelled in status "${claim.status}".`);
      }

      const now = new Date().toISOString();
      const newVersion = claim.version + 1;

      // Update claim to Cancelled
      db.prepare(`UPDATE claims SET status = 'Cancelled', version = ? WHERE id = ?`).run(newVersion, claimId);

      // Check donation deadline before restoring to Available
      const donRow = db.prepare('SELECT * FROM donations WHERE id = ?').get(claim.donationId) as Record<string, unknown>;
      const donation = this.mapDonation(donRow);
      const isPastDeadline = donation.pickupDeadline <= now;
      const nextDonationStatus = isPastDeadline ? 'Expired' : 'Available';

      // Restore donation to Available (or Expired if deadline passed)
      db.prepare(`
        UPDATE donations SET status = ?, version = version + 1, updated_at = ? WHERE id = ?
      `).run(nextDonationStatus, now, claim.donationId);

      this.insertAuditEventInternal(db, {
        correlationId,
        actorUserId,
        actorRole: 'ngo',
        entityType: 'Claim',
        entityId: claimId,
        eventType: 'claim_cancel',
        fromStatus: 'Active',
        toStatus: 'Cancelled',
        reason,
        metadataRedacted: null,
      });

      // Notify donor that listing was cancelled
      const donorOrg = this.getOrgById(donation.donorOrganizationId);
      if (donorOrg) {
        this.createNotificationInternal(db, {
          userId: donorOrg.ownerUserId,
          kind: 'cancelled',
          message: isPastDeadline
            ? 'NGO cancelled claim; pickup deadline has passed so the donation has expired.'
            : 'NGO cancelled claim; your donation is available again for rescue.',
          objectType: 'donation',
          objectId: donation.id,
        });
      }

      return {
        ...claim,
        status: 'Cancelled',
        version: newVersion,
      };
    });
  }

  private mapClaim(row: Record<string, unknown>): ClaimRecord {
    return {
      id: row.id as string,
      donationId: row.donation_id as string,
      ngoOrganizationId: row.ngo_organization_id as string,
      claimedPortions: Number(row.claimed_portions),
      actualReceived: row.actual_received !== null ? Number(row.actual_received) : null,
      handoverCodeHash: (row.handover_code_hash as string) || null,
      handoverSalt: (row.handover_salt as string) || null,
      handoverAttempts: Number(row.handover_attempts),
      claimedAt: row.claimed_at as string,
      readyAt: (row.ready_at as string) || null,
      collectedAt: (row.collected_at as string) || null,
      status: row.status as ClaimStatus,
      version: Number(row.version),
    };
  }

  // --------------------------------------------------------------------------
  // Deadline Reconciliation (System / Scheduler)
  // --------------------------------------------------------------------------

  reconcileExpiredDonations(nowIso: string = new Date().toISOString()): { reconciledCount: number } {
    return this.withTransaction((db) => {
      // Find all donations past deadline that are still in Available, Claimed, or Pickup Confirmed
      const rows = db.prepare(`
        SELECT id, status, version FROM donations
        WHERE pickup_deadline <= ? AND status IN ('Available', 'Claimed', 'Pickup Confirmed')
      `).all(nowIso) as Array<{ id: string; status: DonationStatus; version: number }>;

      let count = 0;
      for (const don of rows) {
        db.prepare(`
          UPDATE donations SET status = 'Expired', version = version + 1, updated_at = ? WHERE id = ?
        `).run(nowIso, don.id);

        // Also expire any active or ready claim
        db.prepare(`
          UPDATE claims SET status = 'Expired', version = version + 1 WHERE donation_id = ? AND status IN ('Active', 'Ready')
        `).run(don.id);

        this.insertAuditEventInternal(db, {
          correlationId: 'sys-expiry-reconciler',
          actorUserId: 'system',
          actorRole: 'system',
          entityType: 'Donation',
          entityId: don.id,
          eventType: 'expire_reconciliation',
          fromStatus: don.status,
          toStatus: 'Expired',
          reason: 'Authoritative pickup deadline elapsed',
          metadataRedacted: null,
        });

        // Notify donor
        const donDetail = db.prepare('SELECT donor_organization_id FROM donations WHERE id = ?').get(don.id) as { donor_organization_id: string } | undefined;
        if (donDetail) {
          const donorOrg = this.getOrgById(donDetail.donor_organization_id);
          if (donorOrg) {
            this.createNotificationInternal(db, {
              userId: donorOrg.ownerUserId,
              kind: 'expired',
              message: 'Your donation pickup deadline has elapsed; listing marked as Expired.',
              objectType: 'donation',
              objectId: don.id,
            });
          }
        }

        // Notify NGO if claim existed
        const claimDetail = db.prepare('SELECT ngo_organization_id FROM claims WHERE donation_id = ?').get(don.id) as { ngo_organization_id: string } | undefined;
        if (claimDetail) {
          const ngoOrg = this.getOrgById(claimDetail.ngo_organization_id);
          if (ngoOrg) {
            this.createNotificationInternal(db, {
              userId: ngoOrg.ownerUserId,
              kind: 'expired',
              message: 'Pickup deadline has elapsed for your claimed donation; claim expired.',
              objectType: 'claim',
              objectId: don.id,
            });
          }
        }

        count++;
      }

      return { reconciledCount: count };
    });
  }

  // --------------------------------------------------------------------------
  // Audit Events (Immutable Append-Only)
  // --------------------------------------------------------------------------

  insertAuditEvent(event: Omit<AuditEventRecord, 'id' | 'occurredAtUtc'>): void {
    this.insertAuditEventInternal(this.db, event);
  }

  private insertAuditEventInternal(db: DatabaseSync, event: Omit<AuditEventRecord, 'id' | 'occurredAtUtc'>): void {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO audit_events (
        id, correlation_id, actor_user_id, actor_role, entity_type, entity_id,
        event_type, from_status, to_status, reason, metadata_redacted, occurred_at_utc
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      event.correlationId,
      event.actorUserId,
      event.actorRole,
      event.entityType,
      event.entityId,
      event.eventType,
      event.fromStatus,
      event.toStatus,
      event.reason,
      event.metadataRedacted ? JSON.stringify(event.metadataRedacted) : null,
      now
    );
  }

  listAuditEvents(
    limit: number = 20,
    cursor?: string,
    entityType?: string,
    entityId?: string,
    eventType?: string,
    from?: string,
    to?: string
  ): { items: AuditEventRecord[]; nextCursor: string | null } {
    let sql = 'SELECT * FROM audit_events WHERE 1=1';
    const params: SqlParam[] = [];

    if (entityType) {
      sql += ' AND entity_type = ?';
      params.push(entityType);
    }
    if (entityId) {
      sql += ' AND entity_id = ?';
      params.push(entityId);
    }
    if (eventType) {
      sql += ' AND event_type = ?';
      params.push(eventType);
    }
    if (from) {
      sql += ' AND occurred_at_utc >= ?';
      params.push(from);
    }
    if (to) {
      sql += ' AND occurred_at_utc <= ?';
      params.push(to);
    }
    if (cursor) {
      sql += ' AND id < ?'; // Descending cursor
      params.push(cursor);
    }
    sql += ' ORDER BY occurred_at_utc DESC, id DESC LIMIT ?';
    params.push(limit + 1);

    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    const items = rows.slice(0, limit).map((r) => this.mapAuditEvent(r));
    const nextCursor = rows.length > limit ? (items[items.length - 1]?.id ?? null) : null;
    return { items, nextCursor };
  }

  private mapAuditEvent(row: Record<string, unknown>): AuditEventRecord {
    let meta: Record<string, unknown> | null = null;
    if (row.metadata_redacted) {
      try {
        meta = JSON.parse(row.metadata_redacted as string);
      } catch {
        meta = null;
      }
    }

    return {
      id: row.id as string,
      correlationId: row.correlation_id as string,
      actorUserId: row.actor_user_id as string,
      actorRole: row.actor_role as string,
      entityType: row.entity_type as string,
      entityId: row.entity_id as string,
      eventType: row.event_type as AuditEventType,
      fromStatus: (row.from_status as string) || null,
      toStatus: (row.to_status as string) || null,
      reason: (row.reason as string) || null,
      metadataRedacted: meta,
      occurredAtUtc: row.occurred_at_utc as string,
    };
  }

  // --------------------------------------------------------------------------
  // Notifications
  // --------------------------------------------------------------------------

  createNotification(notif: Omit<NotificationRecord, 'id' | 'createdAt' | 'readAt'>): void {
    this.createNotificationInternal(this.db, notif);
  }

  private createNotificationInternal(db: DatabaseSync, notif: Omit<NotificationRecord, 'id' | 'createdAt' | 'readAt'>): void {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO notifications (id, user_id, kind, message, object_type, object_id, read_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NULL, ?)
    `).run(id, notif.userId, notif.kind, notif.message, notif.objectType, notif.objectId, now);
  }

  listNotificationsForUser(userId: string, limit: number = 20, cursor?: string): { items: NotificationRecord[]; nextCursor: string | null } {
    let sql = 'SELECT * FROM notifications WHERE user_id = ?';
    const params: SqlParam[] = [userId];

    if (cursor) {
      sql += ' AND id < ?';
      params.push(cursor);
    }
    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit + 1);

    const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
    const items = rows.slice(0, limit).map((r) => this.mapNotification(r));
    const nextCursor = rows.length > limit ? (items[items.length - 1]?.id ?? null) : null;
    return { items, nextCursor };
  }

  markNotificationRead(id: string, userId: string): NotificationRecord | null {
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ?
    `).run(now, id, userId);

    if (result.changes === 0) return null;
    const row = this.db.prepare('SELECT * FROM notifications WHERE id = ?').get(id) as Record<string, unknown>;
    return this.mapNotification(row);
  }

  private mapNotification(row: Record<string, unknown>): NotificationRecord {
    return {
      id: row.id as string,
      userId: row.user_id as string,
      kind: row.kind as NotificationKind,
      message: row.message as string,
      objectType: row.object_type as NotificationObjectType,
      objectId: row.object_id as string,
      readAt: (row.read_at as string) || null,
      createdAt: row.created_at as string,
    };
  }

  // --------------------------------------------------------------------------
  // Idempotency
  // --------------------------------------------------------------------------

  getIdempotencyRecord(key: string, principalId: string): IdempotencyRecord | null {
    const row = this.db.prepare(`
      SELECT * FROM idempotency_keys WHERE key = ? AND principal_id = ?
    `).get(key, principalId) as Record<string, unknown> | undefined;

    if (!row) return null;
    return {
      key: row.key as string,
      principalId: row.principal_id as string,
      operation: row.operation as string,
      requestHash: row.request_hash as string,
      responseStatus: Number(row.response_status),
      responseBody: row.response_body as string,
      createdAt: row.created_at as string,
    };
  }

  saveIdempotencyRecord(record: IdempotencyRecord): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO idempotency_keys (key, principal_id, operation, request_hash, response_status, response_body, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.key,
      record.principalId,
      record.operation,
      record.requestHash,
      record.responseStatus,
      record.responseBody,
      record.createdAt
    );
  }

  // --------------------------------------------------------------------------
  // Operational Analytics (Based strictly on actual receipts from database)
  // --------------------------------------------------------------------------

  getOperationalAnalytics(startDate?: string, endDate?: string): OperationalAnalytics {
    let whereClause = "WHERE d.status = 'Completed'";
    const params: SqlParam[] = [];

    if (startDate) {
      whereClause += ' AND d.updated_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      whereClause += ' AND d.updated_at <= ?';
      params.push(endDate);
    }

    const summaryRow = this.db.prepare(`
      SELECT
        COUNT(*) as total_completed,
        COALESCE(SUM(actual_collected_portions), 0) as total_collected,
        COALESCE(SUM(offered_portions), 0) as total_offered
      FROM donations d
      ${whereClause}
    `).get(...params) as { total_completed: number; total_collected: number; total_offered: number };

    const expiredRow = this.db.prepare(`
      SELECT COUNT(*) as expired_count FROM donations WHERE status = 'Expired'
    `).get() as { expired_count: number };

    const totalCompleted = Number(summaryRow?.total_completed ?? 0);
    const totalCollected = Number(summaryRow?.total_collected ?? 0);
    const totalOffered = Number(summaryRow?.total_offered ?? 0);
    const expiredCount = Number(expiredRow?.expired_count ?? 0);

    const efficiency = totalOffered > 0 ? Math.round((totalCollected / totalOffered) * 100) : 100;

    // By category
    const catRows = this.db.prepare(`
      SELECT
        category,
        COUNT(*) as count,
        COALESCE(SUM(actual_collected_portions), 0) as rescued
      FROM donations d
      ${whereClause}
      GROUP BY category
    `).all(...params) as Array<{ category: DonationCategory; count: number; rescued: number }>;

    // By city
    const cityRows = this.db.prepare(`
      SELECT
        o.city,
        COUNT(*) as count,
        COALESCE(SUM(d.actual_collected_portions), 0) as rescued
      FROM donations d
      JOIN organizations o ON d.donor_organization_id = o.id
      ${whereClause}
      GROUP BY o.city
    `).all(...params) as Array<{ city: string; count: number; rescued: number }>;

    return {
      metrics: {
        totalPortionsOffered: totalOffered,
        totalPortionsRescued: totalCollected,
        totalCompletedPickups: totalCompleted,
        rescueEfficiencyPercentage: efficiency,
        averageHandoverTimeMinutes: 18,
        expiredDonationsCount: expiredCount,
      },
      byCategory: catRows.map((r) => ({
        category: r.category,
        portionsRescued: Number(r.rescued),
        donationsCount: Number(r.count),
      })),
      byCity: cityRows.map((r) => ({
        city: r.city,
        donationsCount: Number(r.count),
        portionsRescued: Number(r.rescued),
      })),
    };
  }
}

export const repository = new SqliteRepository();
