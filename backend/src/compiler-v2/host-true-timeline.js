/**
 * Stage 3A — Host TRUE Timeline entry.
 * V2 Stateful Reader is the default (GlobalStoryMap + StoryMemory + 4 passes).
 * Legacy chunk→consolidate path removed (silent consolidate deletes forbidden).
 */

export { TIMELINE_TRACK } from "./host-timeline/constants.js";
export { buildHostTimelineChunks, buildCoverageWindows } from "./host-timeline/windows.js";
export { extractHostTrueTimelineV2 as extractHostTrueTimeline } from "./host-timeline/pipeline.js";
export { extractHostTrueTimelineV2 } from "./host-timeline/pipeline.js";
