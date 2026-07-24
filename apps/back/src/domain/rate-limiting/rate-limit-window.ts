// "Midnight server time" (PRD §3.2.2) is treated as UTC midnight — deployment
// containers run in UTC, and anchoring to UTC avoids DST-related drift.

export function toCalendarDateKey(now: Date): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function msUntilNextMidnightUtc(now: Date): number {
  const nextMidnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );
  return nextMidnight - now.getTime();
}
