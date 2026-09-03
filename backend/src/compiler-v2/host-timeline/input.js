/**
 * Build HostTimelineInput — HOST_BOOK only.
 * Never pull role scripts / clues / mechanisms into truth extraction.
 */

import { newCompilerId } from "../state.js";

export function buildHostTimelineInput(state = {}) {
  const host = (state.documents || []).find((d) => d.kind === "HOST_BOOK");
  if (!host) {
    return {
      hostSourceSections: [],
      confirmedStageSchema: state.stageSchema?.items?.length ? state.stageSchema : null,
      projectMeta: {
        title: state.project?.title || null,
        characters: (state.characters || []).map((c) => ({
          id: c.id,
          name: c.name
        }))
      },
      originalHostDocumentId: null
    };
  }

  const hostSourceSections = (state.sourceSections || []).filter(
    (s) => s.documentId === host.id
  );

  // If Stage 2 produced no sections, synthesize one section from host text
  // so Pass windows still have coverage targets (id is stable for this job).
  if (!hostSourceSections.length && host.text) {
    const sid = newCompilerId("src");
    return {
      hostSourceSections: [
        {
          id: sid,
          documentId: host.id,
          headingPath: ["host"],
          originalText: String(host.text),
          stageId: null,
          actId: null
        }
      ],
      confirmedStageSchema: state.stageSchema?.items?.length ? state.stageSchema : null,
      projectMeta: {
        title: state.project?.title || null,
        characters: (state.characters || []).map((c) => ({
          id: c.id,
          name: c.name
        }))
      },
      originalHostDocumentId: host.id,
      _syntheticSections: true
    };
  }

  return {
    hostSourceSections,
    confirmedStageSchema: state.stageSchema?.items?.length ? state.stageSchema : null,
    projectMeta: {
      title: state.project?.title || null,
      characters: (state.characters || []).map((c) => ({
        id: c.id,
        name: c.name
      }))
    },
    originalHostDocumentId: host.id
  };
}

export function assertHostOnlyInput(input) {
  // Soft guard for callers — never throw on empty; pipeline handles empty host.
  return {
    ok: Boolean(input?.originalHostDocumentId || input?.hostSourceSections?.length),
    sectionCount: input?.hostSourceSections?.length || 0
  };
}
