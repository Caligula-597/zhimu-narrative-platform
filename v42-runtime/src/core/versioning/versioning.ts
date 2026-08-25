/** Optimistic concurrency helpers used by NodeRepository.update. */
export function nextVersion(current: number): number {
  return current + 1;
}

export function assertExpectedVersion(
  actual: number,
  expected: number
): void {
  if (actual !== expected) {
    throw new Error(`expectedVersion ${expected} !== actual ${actual}`);
  }
}
