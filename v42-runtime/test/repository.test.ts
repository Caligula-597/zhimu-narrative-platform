import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MemoryNodeRepository } from "../src/infrastructure/db/memory-node-repository.js";
import {
  LockViolationError,
  VersionConflictError
} from "../src/core/errors.js";
import type { MotivationNode } from "../src/domain/motivation/motivation.js";

function motivation(partial: Partial<MotivationNode> & { id: string }): MotivationNode {
  const now = new Date().toISOString();
  return {
    id: partial.id,
    projectId: "proj_1",
    type: "motivation",
    version: partial.version ?? 1,
    status: "draft",
    createdBy: "test",
    updatedBy: "test",
    createdAt: now,
    updatedAt: now,
    lockLevel: 0,
    tags: [],
    characterId: "char_1",
    description: partial.description ?? "动机",
    sourceNodeIds: partial.sourceNodeIds ?? ["bg_1"],
    priority: "primary",
    conflictWithMotivationIds: [],
    active: true
  };
}

describe("MemoryNodeRepository version/lock/dependency", () => {
  it("rejects stale expectedVersion", async () => {
    const repo = new MemoryNodeRepository();
    await repo.create(motivation({ id: "M3", version: 7 }));
    await assert.rejects(
      () =>
        repo.update({
          id: "M3",
          expectedVersion: 6,
          changes: { description: "改" },
          updatedBy: "repair"
        }),
      (err: unknown) => err instanceof VersionConflictError
    );
  });

  it("rejects locked node updates", async () => {
    const repo = new MemoryNodeRepository();
    await repo.create(motivation({ id: "M3", version: 1 }));
    await repo.setLock({
      nodeId: "M3",
      level: 1,
      locked: true,
      lockedVersion: 1
    });
    await assert.rejects(
      () =>
        repo.update({
          id: "M3",
          expectedVersion: 1,
          changes: { description: "偷改" },
          updatedBy: "narrative_writer"
        }),
      (err: unknown) => err instanceof LockViolationError
    );

    const updated = await repo.update({
      id: "M3",
      expectedVersion: 1,
      changes: { description: "repair ok" },
      updatedBy: "repair",
      rollbackNodeIds: ["M3"]
    });
    assert.equal(updated.version, 2);
    assert.equal(updated.description, "repair ok");
  });

  it("computes descendants via depends_on edges", async () => {
    const repo = new MemoryNodeRepository();
    await repo.create(motivation({ id: "M3" }));
    await repo.create(motivation({ id: "O4", description: "目标" }));
    await repo.create(motivation({ id: "N7", description: "叙事依赖" }));
    await repo.addEdge({
      id: "e1",
      projectId: "proj_1",
      fromNodeId: "O4",
      toNodeId: "M3",
      relation: "depends_on"
    });
    await repo.addEdge({
      id: "e2",
      projectId: "proj_1",
      fromNodeId: "N7",
      toNodeId: "O4",
      relation: "depends_on"
    });
    const descendants = await repo.getDescendants("M3");
    assert.deepEqual(new Set(descendants), new Set(["O4", "N7"]));
  });
});
