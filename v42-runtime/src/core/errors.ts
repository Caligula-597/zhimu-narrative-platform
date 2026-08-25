export class VersionConflictError extends Error {
  readonly code = "VERSION_CONFLICT";
  constructor(
    readonly nodeId: string,
    readonly expectedVersion: number,
    readonly actualVersion: number
  ) {
    super(
      `Version conflict on ${nodeId}: expected ${expectedVersion}, actual ${actualVersion}`
    );
    this.name = "VersionConflictError";
  }
}

export class LockViolationError extends Error {
  readonly code = "LOCK_VIOLATION";
  constructor(readonly nodeId: string) {
    super(`Node ${nodeId} is locked`);
    this.name = "LockViolationError";
  }
}

export class NotFoundError extends Error {
  readonly code = "NOT_FOUND";
  constructor(readonly nodeId: string) {
    super(`Node ${nodeId} not found`);
    this.name = "NotFoundError";
  }
}

export class NotImplementedError extends Error {
  readonly code = "NOT_IMPLEMENTED";
  constructor(feature: string) {
    super(`Not implemented: ${feature}`);
    this.name = "NotImplementedError";
  }
}
