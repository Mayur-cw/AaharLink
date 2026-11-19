-- 001_initial.sql
-- AaharLink Initial Persistence Schema
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
  declaration_snapshot TEXT NOT NULL, -- JSON
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

-- Active-claim unique partial index prevents any two concurrent active allocations of the same donation
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
  metadata_redacted TEXT, -- JSON
  occurred_at_utc TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_events (entity_type, entity_id, occurred_at_utc DESC);
CREATE INDEX IF NOT EXISTS idx_audit_occurred_at ON audit_events (occurred_at_utc DESC);

-- Trigger to make audit_events strictly append-only
CREATE TRIGGER IF NOT EXISTS prevent_audit_update BEFORE UPDATE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events is append-only and cannot be modified');
END;

CREATE TRIGGER IF NOT EXISTS prevent_audit_delete BEFORE DELETE ON audit_events
BEGIN
  SELECT RAISE(ABORT, 'audit_events is append-only and cannot be deleted');
END;

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
