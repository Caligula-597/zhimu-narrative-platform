import type { ProjectSpec } from "../domain/project/project-spec.js";
import type { FactNode, KnowledgeNode } from "../domain/knowledge/knowledge.js";

/**
 * 织幕 → V4.2：把现有创作输入转成 ProjectSpec。
 * 未接线：实现方日后由 backend/creator 侧提供。
 */
export interface ProjectSpecAdapter {
  fromCreatorInput(input: unknown): ProjectSpec;
}

/**
 * V4.2 → 织幕：把 IR / NarrativeSection 导出给现有 Writer / 文档系统。
 * 未接线。
 */
export interface DeliveryAdapter {
  toCreatorDocuments(projectId: string): Promise<unknown>;
}

/**
 * 与 shared/world-engine 事实层桥接（日后）。
 * 未接线。
 */
export interface WorldEngineBridge {
  importFacts?(nodes: FactNode[]): unknown;
  exportObservations?(ledger: unknown): KnowledgeNode[];
}

export class UnwiredAdapterError extends Error {
  readonly code = "UNWIRED_ADAPTER";
  constructor(adapter: string) {
    super(`Integration adapter not wired: ${adapter}`);
    this.name = "UnwiredAdapterError";
  }
}

export const unwiredProjectSpecAdapter: ProjectSpecAdapter = {
  fromCreatorInput() {
    throw new UnwiredAdapterError("ProjectSpecAdapter");
  }
};

export const unwiredDeliveryAdapter: DeliveryAdapter = {
  async toCreatorDocuments() {
    throw new UnwiredAdapterError("DeliveryAdapter");
  }
};

export const unwiredWorldEngineBridge: WorldEngineBridge = {
  importFacts() {
    throw new UnwiredAdapterError("WorldEngineBridge.importFacts");
  },
  exportObservations() {
    throw new UnwiredAdapterError("WorldEngineBridge.exportObservations");
  }
};
