import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Role } from '../shared/contracts.js';

export interface SessionData {
  id: string;
  userId: string;
  role: Role;
  organizationId: string | null;
  csrfToken: string;
  createdAt: Date;
  lastActiveAt: Date;
  expiresAt: Date;
}

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const ABSOLUTE_TIMEOUT_MS = 12 * 60 * 60 * 1000; // 12 hours

// In-memory session store (can also be backed by DB; T-04 provides SQLite backing)
class SessionStore {
  private sessions = new Map<string, SessionData>();
  private userSessions = new Map<string, Set<string>>();

  createSession(userId: string, role: Role, organizationId: string | null): SessionData {
    const token = crypto.randomBytes(32).toString('hex');
    const csrfToken = crypto.randomBytes(24).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + IDLE_TIMEOUT_MS);

    const session: SessionData = {
      id: token,
      userId,
      role,
      organizationId,
      csrfToken,
      createdAt: now,
      lastActiveAt: now,
      expiresAt,
    };

    this.sessions.set(token, session);

    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId)!.add(token);

    return session;
  }

  getSession(token: string): SessionData | null {
    const session = this.sessions.get(token);
    if (!session) return null;

    const now = new Date();

    // Check absolute lifetime
    if (now.getTime() - session.createdAt.getTime() > ABSOLUTE_TIMEOUT_MS) {
      this.revokeSession(token);
      return null;
    }

    // Check idle timeout
    if (now.getTime() > session.expiresAt.getTime()) {
      this.revokeSession(token);
      return null;
    }

    // Touch idle expiry
    session.lastActiveAt = now;
    session.expiresAt = new Date(now.getTime() + IDLE_TIMEOUT_MS);
    return session;
  }

  revokeSession(token: string): boolean {
    const session = this.sessions.get(token);
    if (!session) return false;

    this.sessions.delete(token);
    const userSet = this.userSessions.get(session.userId);
    if (userSet) {
      userSet.delete(token);
      if (userSet.size === 0) {
        this.userSessions.delete(session.userId);
      }
    }
    return true;
  }

  revokeAllUserSessions(userId: string): number {
    const tokens = this.userSessions.get(userId);
    if (!tokens) return 0;

    let count = 0;
    for (const token of tokens) {
      this.sessions.delete(token);
      count++;
    }
    this.userSessions.delete(userId);
    return count;
  }

  cleanExpired(): void {
    const now = new Date();
    for (const [token, session] of this.sessions.entries()) {
      if (
        now.getTime() > session.expiresAt.getTime() ||
        now.getTime() - session.createdAt.getTime() > ABSOLUTE_TIMEOUT_MS
      ) {
        this.revokeSession(token);
      }
    }
  }

  clearAll(): void {
    this.sessions.clear();
    this.userSessions.clear();
  }
}

export const sessionStore = new SessionStore();

// ============================================================================
// Password & Handover Code Hashing Utilities
// ============================================================================

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function hashHandoverCode(code: string, salt: string): string {
  return crypto.createHmac('sha256', salt).update(code.trim()).digest('hex');
}

export function verifyHandoverCode(
  inputCode: string,
  salt: string,
  expectedHash: string
): boolean {
  const calculatedHash = hashHandoverCode(inputCode, salt);
  const bufA = Buffer.from(calculatedHash, 'hex');
  const bufB = Buffer.from(expectedHash, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
