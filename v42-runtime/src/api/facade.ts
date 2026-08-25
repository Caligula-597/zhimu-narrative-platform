import type { ProjectSpec } from "../domain/project/project-spec.js";
import { ProjectSpecSchema } from "../domain/project/project-spec.js";
import { routeRequirements } from "../core/router/requirement-router.js";
import { runProject } from "../core/orchestrator/run-project.js";
import type { NodeRepository } from "../infrastructure/db/node-repository.js";
import { MemoryNodeRepository } from "../infrastructure/db/memory-node-repository.js";

/**
 * Pure-function API facade for future backend route mounting.
 * No HTTP here.
 */
export function createMemoryRuntime() {
  const repo = new MemoryNodeRepository();
  return {
    repo,
    async route(spec: ProjectSpec) {
      const project = ProjectSpecSchema.parse(spec);
      return routeRequirements(project);
    },
    async run(spec: ProjectSpec) {
      const project = ProjectSpecSchema.parse(spec);
      return runProject(project, repo);
    }
  };
}

export async function runWithRepository(
  spec: ProjectSpec,
  repo: NodeRepository
) {
  const project = ProjectSpecSchema.parse(spec);
  return runProject(project, repo);
}
