export function msUntil(target: Date, now: Date): number {
  return Math.max(0, target.getTime() - now.getTime());
}

export function formatCountdown(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `resets in ${hours}h ${String(minutes).padStart(2, '0')}m`;
}
