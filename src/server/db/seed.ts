import crypto from 'node:crypto';
import { hashPassword } from '../session.js';
import { repository } from '../repository.js';
import type { HandlingDeclarations } from '../../shared/contracts.js';

export async function runDemoSeed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FORBIDDEN: Demo accounts cannot be seeded in production.');
  }

  const now = new Date();
  const plus90Min = new Date(now.getTime() + 90 * 60 * 1000).toISOString();
  const minus60Min = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const minus2Hours = new Date(now.getTime() - 120 * 60 * 1000).toISOString();

  const standardDeclarations: HandlingDeclarations = {
    safePreparation: true,
    properTemperature: true,
    cleanPackaging: true,
    accurateInformation: true,
    recipientAssessmentAcknowledgement: true,
  };

  const donorHash = await hashPassword('DemoDonor!2026');
  const ngoAHash = await hashPassword('DemoNgoA!2026');
  const ngoBHash = await hashPassword('DemoNgoB!2026');
  const coordHash = await hashPassword('DemoCoord!2026');
  const pendingHash = await hashPassword('DemoPending!2026');

  return repository.withTransaction((db) => {
    // Clean existing demo data if any
    db.exec(`
      DELETE FROM audit_events;
      DELETE FROM notifications;
      DELETE FROM claims;
      DELETE FROM donations;
      DELETE FROM organizations;
      DELETE FROM users;
      DELETE FROM idempotency_keys;
    `);

    // 1. Donor Demo Account
    const donorUserId = 'usr-demo-donor';
    const donorOrgId = 'org-demo-donor';
    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, organization_id, session_revoked_at, created_at)
      VALUES (?, ?, ?, 'donor', ?, NULL, ?)
    `).run(donorUserId, 'donor@aaharlink.example', donorHash, donorOrgId, now.toISOString());

    db.prepare(`
      INSERT INTO organizations (
        id, owner_user_id, kind, name, status, contact_phone, contact_person,
        city, latitude, longitude, max_portions, operating_radius_km, version, created_at, updated_at
      ) VALUES (?, ?, 'donor', ?, 'verified', ?, ?, ?, ?, ?, 100, 25.0, 1, ?, ?)
    `).run(
      donorOrgId,
      donorUserId,
      'Annapurna Kitchen',
      '+919822011111',
      'Rajesh Sharma',
      'Chhatrapati Sambhaji Nagar',
      19.8700,
      75.3200,
      now.toISOString(),
      now.toISOString()
    );

    // 2. NGO A Demo Account (Capacity 60)
    const ngoAUserId = 'usr-demo-ngo-a';
    const ngoAOrgId = 'org-demo-ngo-a';
    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, organization_id, session_revoked_at, created_at)
      VALUES (?, ?, ?, 'ngo', ?, NULL, ?)
    `).run(ngoAUserId, 'ngo-a@aaharlink.example', ngoAHash, ngoAOrgId, now.toISOString());

    db.prepare(`
      INSERT INTO organizations (
        id, owner_user_id, kind, name, status, contact_phone, contact_person,
        city, latitude, longitude, max_portions, operating_radius_km, version, created_at, updated_at
      ) VALUES (?, ?, 'ngo', ?, 'verified', ?, ?, ?, ?, ?, 60, 25.0, 1, ?, ?)
    `).run(
      ngoAOrgId,
      ngoAUserId,
      'Seva Feed Foundation',
      '+919822022222',
      'Priya Patil',
      'Chhatrapati Sambhaji Nagar',
      19.8750,
      75.3300,
      now.toISOString(),
      now.toISOString()
    );

    // 3. NGO B Demo Account (Capacity 80)
    const ngoBUserId = 'usr-demo-ngo-b';
    const ngoBOrgId = 'org-demo-ngo-b';
    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, organization_id, session_revoked_at, created_at)
      VALUES (?, ?, ?, 'ngo', ?, NULL, ?)
    `).run(ngoBUserId, 'ngo-b@aaharlink.example', ngoBHash, ngoBOrgId, now.toISOString());

    db.prepare(`
      INSERT INTO organizations (
        id, owner_user_id, kind, name, status, contact_phone, contact_person,
        city, latitude, longitude, max_portions, operating_radius_km, version, created_at, updated_at
      ) VALUES (?, ?, 'ngo', ?, 'verified', ?, ?, ?, ?, ?, 80, 25.0, 1, ?, ?)
    `).run(
      ngoBOrgId,
      ngoBUserId,
      'Roti Relief Network',
      '+919822033333',
      'Amit Deshmukh',
      'Chhatrapati Sambhaji Nagar',
      19.8680,
      75.3100,
      now.toISOString(),
      now.toISOString()
    );

    // 4. Coordinator Demo Account
    const coordUserId = 'usr-demo-coord';
    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, organization_id, session_revoked_at, created_at)
      VALUES (?, ?, ?, 'coordinator', NULL, NULL, ?)
    `).run(coordUserId, 'coordinator@aaharlink.example', coordHash, now.toISOString());

    // 5. NGO Pending Applicant
    const ngoPendingUserId = 'usr-demo-ngo-pending';
    const ngoPendingOrgId = 'org-demo-ngo-pending';
    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, organization_id, session_revoked_at, created_at)
      VALUES (?, ?, ?, 'ngo', ?, NULL, ?)
    `).run(ngoPendingUserId, 'ngo-pending@aaharlink.example', pendingHash, ngoPendingOrgId, now.toISOString());

    db.prepare(`
      INSERT INTO organizations (
        id, owner_user_id, kind, name, status, contact_phone, contact_person,
        city, latitude, longitude, max_portions, operating_radius_km, version, created_at, updated_at
      ) VALUES (?, ?, 'ngo', ?, 'pending', ?, ?, ?, ?, ?, 50, 15.0, 1, ?, ?)
    `).run(
      ngoPendingOrgId,
      ngoPendingUserId,
      'Yuva Care Trust',
      '+919822044444',
      'Karan Joshi',
      'Chhatrapati Sambhaji Nagar',
      19.8800,
      75.3400,
      now.toISOString(),
      now.toISOString()
    );

    // Seed 1: 18-portion available listing with pickupDeadline = now + 90 min
    const donAvailableId = 'don-seed-available-18';
    db.prepare(`
      INSERT INTO donations (
        id, donor_organization_id, category, description, offered_portions,
        actual_collected_portions, prepared_at, pickup_deadline, pickup_address,
        pickup_latitude, pickup_longitude, handling_declared_at, declaration_snapshot,
        status, version, created_at, updated_at
      ) VALUES (?, ?, 'cooked', ?, 18, 0, ?, ?, ?, 19.8700, 75.3200, ?, ?, 'Available', 1, ?, ?)
    `).run(
      donAvailableId,
      donorOrgId,
      'Fresh steamed rice and dal pakwan',
      minus2Hours,
      plus90Min,
      'Shop 12, Station Road, Chhatrapati Sambhaji Nagar',
      now.toISOString(),
      JSON.stringify(standardDeclarations),
      now.toISOString(),
      now.toISOString()
    );

    // Seed 2: Distinctly labeled 12-portion expired donation with pickupDeadline = now - 60 min
    const donExpiredId = 'don-seed-expired-12';
    db.prepare(`
      INSERT INTO donations (
        id, donor_organization_id, category, description, offered_portions,
        actual_collected_portions, prepared_at, pickup_deadline, pickup_address,
        pickup_latitude, pickup_longitude, handling_declared_at, declaration_snapshot,
        status, version, created_at, updated_at
      ) VALUES (?, ?, 'bakery', ?, 12, 0, ?, ?, ?, 19.8700, 75.3200, ?, ?, 'Expired', 1, ?, ?)
    `).run(
      donExpiredId,
      donorOrgId,
      'Packed bread loaves and pav (EXPIRED FIXTURE)',
      minus2Hours,
      minus60Min,
      'Shop 12, Station Road, Chhatrapati Sambhaji Nagar',
      now.toISOString(),
      JSON.stringify(standardDeclarations),
      minus2Hours,
      now.toISOString()
    );

    // Seed Audit event for the seeded donation
    db.prepare(`
      INSERT INTO audit_events (
        id, correlation_id, actor_user_id, actor_role, entity_type, entity_id,
        event_type, from_status, to_status, reason, metadata_redacted, occurred_at_utc
      ) VALUES (?, 'seed-correlation', ?, 'donor', 'Donation', ?, 'donation_create', NULL, 'Available', 'Initial demo seed available listing', NULL, ?)
    `).run(crypto.randomUUID(), donorUserId, donAvailableId, now.toISOString());

    return {
      success: true,
      accounts: [
        { role: 'donor', email: 'donor@aaharlink.example', pass: 'DemoDonor!2026' },
        { role: 'ngo', email: 'ngo-a@aaharlink.example', pass: 'DemoNgoA!2026' },
        { role: 'ngo', email: 'ngo-b@aaharlink.example', pass: 'DemoNgoB!2026' },
        { role: 'coordinator', email: 'coordinator@aaharlink.example', pass: 'DemoCoord!2026' },
        { role: 'ngo (pending)', email: 'ngo-pending@aaharlink.example', pass: 'DemoPending!2026' },
      ],
      donations: [
        { id: donAvailableId, portions: 18, status: 'Available' },
        { id: donExpiredId, portions: 12, status: 'Expired' },
      ],
    };
  });
}

// When run directly as CLI: node --loader tsx src/server/db/seed.ts
if (process.argv[1]?.endsWith('seed.ts')) {
  // Update password hashes dynamically for standard passwords
  (async () => {
    try {
      const donorHash = await hashPassword('DemoDonor!2026');
      const ngoAHash = await hashPassword('DemoNgoA!2026');
      const ngoBHash = await hashPassword('DemoNgoB!2026');
      const coordHash = await hashPassword('DemoCoord!2026');
      const pendingHash = await hashPassword('DemoPending!2026');

      await runDemoSeed();

      // Update users with accurate individual bcrypt hashes
      const db = repository;
      db.updateUserPassword('usr-demo-donor', donorHash);
      db.updateUserPassword('usr-demo-ngo-a', ngoAHash);
      db.updateUserPassword('usr-demo-ngo-b', ngoBHash);
      db.updateUserPassword('usr-demo-coord', coordHash);
      db.updateUserPassword('usr-demo-ngo-pending', pendingHash);

      process.stdout.write('Demo seed completed successfully: 5 accounts, 1 available (18 portions), 1 expired (12 portions).\n');
    } catch (err) {
      process.stderr.write(`Seed failed: ${(err as Error).message}\n`);
      process.exit(1);
    }
  })();
}
