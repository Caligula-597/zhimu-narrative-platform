/**
 * Named hooks for future wiring into 织幕 AI 创作流程.
 * None are attached to product routes in Phase 1.
 */
export const ZHIMU_INTEGRATION_HOOKS = [
  "on_creator_project_created",
  "on_writer_workspace_open",
  "on_world_engine_commit",
  "on_document_export_request",
  "on_host_manual_compile"
] as const;

export type ZhimuIntegrationHook = (typeof ZHIMU_INTEGRATION_HOOKS)[number];

export interface IntegrationHookRegistry {
  /** Register a handler; Phase 1 product code must not call this. */
  register(hook: ZhimuIntegrationHook, handler: (...args: unknown[]) => unknown): void;
}

/** Placeholder registry — no handlers until product integration. */
export function createEmptyHookRegistry(): IntegrationHookRegistry {
  const handlers = new Map<ZhimuIntegrationHook, Array<(...args: unknown[]) => unknown>>();
  return {
    register(hook, handler) {
      const list = handlers.get(hook) ?? [];
      list.push(handler);
      handlers.set(hook, list);
    }
  };
}
