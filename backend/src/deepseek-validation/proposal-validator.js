import { throwErr } from "../api-errors.js";
import { cleanText } from "../prompts/shared.js";
import { assertArray, uniqueKeys } from "./primitives.js";

export function validateDeepseekProposal(raw) {
  const proposal = raw && typeof raw === "object" ? raw : {};
  const chapters = assertArray(proposal.chapters, "chapters").slice(0, 12);
  const scenes = assertArray(proposal.scenes, "scenes").slice(0, 40);
  const points = assertArray(proposal.investigationPoints, "investigationPoints").slice(0, 80);
  const clues = assertArray(proposal.clues, "clues").slice(0, 80);
  const edges = assertArray(proposal.edges, "edges").slice(0, 160);
  if (!chapters.length || !scenes.length) throwErr("DEEPSEEK_OUTPUT_INVALID", "AI 提案至少需包含一个章节与一个场景");
  const keys = {
    chapter: uniqueKeys(chapters, "chapters"),
    scene: uniqueKeys(scenes, "scenes"),
    investigation_point: uniqueKeys(points, "investigationPoints"),
    clue: uniqueKeys(clues, "clues")
  };
  for (const scene of scenes) if (!keys.chapter.has(scene.chapterKey)) throwErr("DEEPSEEK_OUTPUT_INVALID", `场景引用了不存在的章节：${scene.chapterKey}`);
  for (const point of points) {
    if (!keys.scene.has(point.sceneKey)) throwErr("DEEPSEEK_OUTPUT_INVALID", `调查点引用了不存在的场景：${point.sceneKey}`);
    if (point.clueKey && !keys.clue.has(point.clueKey)) throwErr("DEEPSEEK_OUTPUT_INVALID", `调查点引用了不存在的线索：${point.clueKey}`);
  }
  for (const edge of edges) {
    if (!keys[edge.fromType]?.has(edge.fromKey) || !keys[edge.toType]?.has(edge.toKey)) throwErr("DEEPSEEK_OUTPUT_INVALID", "剧情边引用了不存在的节点");
    if (!["mainline", "parallel", "extension"].includes(edge.relationType)) throwErr("RELATION_TYPE_INVALID", `Unsupported edge relation: ${edge.relationType}`);
  }
  const normalizeMetadata = (metadata) => (metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {});
  return {
    title: cleanText(proposal.title, 160),
    logline: cleanText(proposal.logline, 600),
    writingPlan: proposal.writingPlan && typeof proposal.writingPlan === "object" ? proposal.writingPlan : {},
    chapters: chapters.map((chapter, index) => ({
      key: chapter.key,
      title: cleanText(chapter.title, 160) || `Chapter ${index + 1}`,
      summary: cleanText(chapter.summary, 2000),
      metadata: normalizeMetadata(chapter.metadata)
    })),
    scenes: scenes.map((scene, index) => ({
      key: scene.key,
      chapterKey: scene.chapterKey,
      name: cleanText(scene.name, 160) || `Scene ${index + 1}`,
      publicText: cleanText(scene.publicText, 8000),
      hostText: cleanText(scene.hostText, 8000),
      metadata: normalizeMetadata(scene.metadata)
    })),
    investigationPoints: points.map((point, index) => ({
      key: point.key,
      sceneKey: point.sceneKey,
      name: cleanText(point.name, 160) || `Point ${index + 1}`,
      description: cleanText(point.description, 4000),
      resultText: cleanText(point.resultText, 4000),
      clueKey: point.clueKey || null
    })),
    clues: clues.map((clue, index) => ({
      key: clue.key,
      name: cleanText(clue.name, 160) || `Clue ${index + 1}`,
      publicText: cleanText(clue.publicText ?? clue.description, 8000),
      description: cleanText(clue.description, 8000),
      hostText: cleanText(clue.hostText, 8000),
      visibility: ["public", "host", "role"].includes(clue.visibility) ? clue.visibility : "role",
      type: cleanText(clue.type, 80),
      clueType: cleanText(clue.clueType, 80),
      importance: cleanText(clue.importance, 80),
      metadata: normalizeMetadata(clue.metadata)
    })),
    edges: edges.map((edge) => ({
      fromType: edge.fromType,
      fromKey: edge.fromKey,
      toType: edge.toType,
      toKey: edge.toKey,
      relationType: edge.relationType,
      label: cleanText(edge.label, 160)
    })),
    suggestions: assertArray(proposal.suggestions ?? [], "suggestions").slice(0, 20).map((item) => cleanText(item, 500))
  };
}
