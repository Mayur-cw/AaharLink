import { repository } from '../repository.js';

export function runDeadlineReconciliation(nowIso?: string): { reconciledCount: number } {
  return repository.reconcileExpiredDonations(nowIso);
}

export function isDeadlineElapsed(deadlineIso: string, now: Date = new Date()): boolean {
  return now.getTime() >= new Date(deadlineIso).getTime();
}
