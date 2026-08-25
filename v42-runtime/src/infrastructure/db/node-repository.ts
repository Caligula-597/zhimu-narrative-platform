import type { AnyDesignNode } from "../../domain/shared/any-node.js";
import type { DependencyEdge } from "../../core/dependency/dependency.js";

export interface LockRecord {
  nodeId: string;
  level: number;
  locked: boolean;
  lockedVersion: number;
}

export interface UpdateNodeInput {
  id: string;
  expectedVersion: number;
  changes: Record<string, unknown>;
  updatedBy: string;
  /** Nodes allowed to be written despite lock (repair rollback scope). */
  rollbackNodeIds?: string[];
}

export interface NodeRepository {
  get(id: string): Promise<AnyDesignNode | null>;
  listByProject(projectId: string): Promise<AnyDesignNode[]>;
  create(node: AnyDesignNode): Promise<AnyDesignNode>;
  update(input: UpdateNodeInput): Promise<AnyDesignNode>;
  delete(id: string): Promise<void>;
  setLock(record: LockRecord): Promise<void>;
  getLock(nodeId: string): Promise<LockRecord | null>;
  addEdge(edge: DependencyEdge): Promise<void>;
  listEdges(projectId: string): Promise<DependencyEdge[]>;
  getDescendants(nodeId: string): Promise<string[]>;
}
