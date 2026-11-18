import type { Project, ProjectHealth } from './types';
import { parseSafeDate } from './utils';

/**
 * Schedule-elapsed percentage: the fraction of the planned duration
 * (start → deadline) that has elapsed as of TODAY (real clock), capped 0–100.
 * This is a statement about the calendar, not a prediction of progress.
 * Returns 0 when either date is missing.
 */
export function scheduleElapsedPercent(start: string, deadline: string): number {
  const s = parseSafeDate(start);
  const d = parseSafeDate(deadline);
  if (!s || !d) return 0;
  const total = d.getTime() - s.getTime();
  if (total <= 0) return 0;
  const elapsed = Date.now() - s.getTime();
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
}

/**
 * Transparent, computed project health — NOT an AI score.
 *
 *   score = 100
 *         − schedule shortfall   min(60, max(0, scheduleElapsed% − progress%))
 *         − open-complaints load min(20, 5 × open complaints assigned to us)
 *         − overdue penalty      20 when past the contract deadline and not Completed
 *
 * Every input is a real field loaded from Supabase; the formula is shown in
 * the UI wherever the score is rendered.
 */
export function projectHealth(p: Project): ProjectHealth {
  const scheduleShortfall = Math.min(60, Math.max(0, p.planned - p.progress));
  const complaintsPenalty = Math.min(20, 5 * (p.openComplaints || 0));
  const deadline = parseSafeDate(p.deadline);
  const overdue = Boolean(deadline && deadline.getTime() < Date.now() && p.status !== 'Completed');
  const overduePenalty = overdue ? 20 : 0;
  const score = Math.max(0, Math.min(100, Math.round(100 - scheduleShortfall - complaintsPenalty - overduePenalty)));
  return {
    score,
    overall: score >= 75 ? 'GOOD' : score >= 50 ? 'FAIR' : 'POOR',
    scheduleShortfall,
    complaintsPenalty,
    overduePenalty,
    overdue,
  };
}
