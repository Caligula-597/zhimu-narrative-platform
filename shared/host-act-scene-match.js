import { resolveChapterSegmentKey } from "./segment-contract.js";

export function sceneMatchesActUnlock(scene, chapters = [], { actKey, sequence, chapterId } = {}) {
  if (chapterId && String(scene?.chapter_id || scene?.chapterId || "") === String(chapterId)) {
    return true;
  }
  const chapter = (chapters || []).find(
    (candidate) => String(candidate.id) === String(scene?.chapter_id || scene?.chapterId || "")
  );
  if (chapter) {
    if (actKey && String(resolveChapterSegmentKey(chapter, chapter.sequence || 1)) === String(actKey)) {
      return true;
    }
    if (sequence != null && Number(chapter.sequence) === Number(sequence)) return true;
  }
  const metadata = scene?.metadata && typeof scene.metadata === "object" ? scene.metadata : {};
  if (actKey) {
    const sceneKey = metadata.segmentKey || metadata.actKey || metadata.matrixActKey || "";
    if (sceneKey && String(sceneKey) === String(actKey)) return true;
  }
  return false;
}
