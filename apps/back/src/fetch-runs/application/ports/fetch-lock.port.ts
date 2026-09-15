// A short-lived, signature-scoped lock (ADR 0021 §6): prevents two
// concurrent match requests for the same stale signature from both
// triggering a fetch. The losing request waits briefly for the in-flight
// fetch instead of firing its own duplicate upstream call.
export interface FetchLockPort {
  /** Returns true if the lock was acquired, false if another holder has it. */
  acquire(querySignature: string): Promise<boolean>;
  release(querySignature: string): Promise<void>;
  /** Resolves once the lock is released, or after a short timeout — whichever comes first. */
  waitForRelease(querySignature: string): Promise<void>;
}
