import type { AnyDesignNode } from "../../domain/shared/any-node.js";
import { AnyDesignNodeSchema } from "../../domain/shared/any-node.js";
import {
  LockViolationError,
  NotFoundError,
  VersionConflictError
} from "../../core/errors.js";
import type { DependencyEdge } from "../../core/dependency/dependency.js";
import type {
  LockRecord,
  NodeRepository,
  UpdateNodeInput
} from "./node-repository.js";

function cloneNode(node: AnyDesignNode): AnyDesignNode {
  return structuredClone(node);
}

export class MemoryNodeRepository implements NodeRepository {
  private readonly nodes = new Map<string, AnyDesignNode>();
  private readonly locks = new Map<string, LockRecord>();
  private readonly edges: DependencyEdge[] = [];

  async get(id: string): Promise<AnyDesignNode | null> {
    const node = this.nodes.get(id);
    return node ? cloneNode(node) : null;
  }

  async listByProject(projectId: string): Promise<AnyDesignNode[]> {
    return [...this.nodes.values()]
      .filter((n) => n.projectId === projectId)
      .map(cloneNode);
  }

  async create(node: AnyDesignNode): Promise<AnyDesignNode> {
    const parsed = AnyDesignNodeSchema.parse(node);
    if (this.nodes.has(parsed.id)) {
      throw new Error(`Node already exists: ${parsed.id}`);
    }
    this.nodes.set(parsed.id, cloneNode(parsed));
    return cloneNode(parsed);
  }

  async update(input: UpdateNodeInput): Promise<AnyDesignNode> {
    const current = this.nodes.get(input.id);
    if (!current) throw new NotFoundError(input.id);

    const lock = this.locks.get(input.id);
    const rollback = new Set(input.rollbackNodeIds ?? []);
    if (lock?.locked && !rollback.has(input.id)) {
      throw new LockViolationError(input.id);
    }

    if (current.version !== input.expectedVersion) {
      throw new VersionConflictError(
        input.id,
        input.expectedVersion,
        current.version
      );
    }

    const nextRaw = {
      ...current,
      ...input.changes,
      id: current.id,
      type: current.type,
      projectId: current.projectId,
      version: current.version + 1,
      updatedBy: input.updatedBy,
      updatedAt: new Date().toISOString()
    };
    const next = AnyDesignNodeSchema.parse(nextRaw);
    this.nodes.set(next.id, cloneNode(next));
    return cloneNode(next);
  }

  async delete(id: string): Promise<void> {
    const lock = this.locks.get(id);
    if (lock?.locked) throw new LockViolationError(id);
    this.nodes.delete(id);
    this.locks.delete(id);
  }

  async setLock(record: LockRecord): Promise<void> {
    this.locks.set(record.nodeId, { ...record });
  }

  async getLock(nodeId: string): Promise<LockRecord | null> {
    const lock = this.locks.get(nodeId);
    return lock ? { ...lock } : null;
  }

  async addEdge(edge: DependencyEdge): Promise<void> {
    this.edges.push({ ...edge });
  }

  async listEdges(projectId: string): Promise<DependencyEdge[]> {
    return this.edges.filter((e) => e.projectId === projectId).map((e) => ({ ...e }));
  }

  async getDescendants(nodeId: string): Promise<string[]> {
    const children = new Map<string, string[]>();
    for (const edge of this.edges) {
      // from depends_on to → to is upstream; descendant means nodes that depend on nodeId
      // Edge: fromNode depends_on toNode means from → depends on → to
      // Descendants of M3 = nodes whose dependency chain reaches M3 as upstream
      const list = children.get(edge.toNodeId) ?? [];
      list.push(edge.fromNodeId);
      children.set(edge.toNodeId, list);
    }

    const out = new Set<string>();
    const stack = [...(children.get(nodeId) ?? [])];
    while (stack.length) {
      const id = stack.pop()!;
      if (out.has(id)) continue;
      out.add(id);
      for (const child of children.get(id) ?? []) stack.push(child);
    }
    return [...out];
  }
}
