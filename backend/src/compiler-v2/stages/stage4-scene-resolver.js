import { markStageComplete, pushWarning, newCompilerId } from "../state.js";

/**
 * Stage 4 — Scene Resolver (passive).
 * Only resolves timelineEvents.locationHint → Scene.
 * Does NOT invent scenes from heading keywords.
 */
export async function stage4SceneResolver(state) {
  let next = {
    ...state,
    job: { ...(state.job || {}), currentStage: "scene_resolver" }
  };

  const scenesByName = new Map();
  for (const scene of state.scenes || []) {
    if (scene?.name) scenesByName.set(String(scene.name).trim(), scene);
  }

  const events = [];
  for (const ev of state.timelineEvents || []) {
    if (ev.locationId || !ev.locationHint) {
      events.push(ev);
      continue;
    }
    const name = String(ev.locationHint).trim();
    if (!name || name.length > 40) {
      events.push(ev);
      continue;
    }
    let scene = scenesByName.get(name);
    if (!scene) {
      scene = {
        id: newCompilerId("scene"),
        name,
        parentSceneId: null,
        description: "",
        availableActs: [],
        eventIds: [],
        clueIds: [],
        interactiveObjects: [],
        source: "locationHint"
      };
      scenesByName.set(name, scene);
    }
    events.push({ ...ev, locationId: scene.id });
  }

  const scenes = [...scenesByName.values()];
  if (!scenes.length) {
    next = pushWarning(next, {
      code: "SCENE_EMPTY",
      message: "尚无场景（需 Timeline locationHint 或后续 Scene 专用提取）；未从标题关键词伪造场景"
    });
  }

  next = { ...next, scenes, timelineEvents: events };
  return markStageComplete(next, "scene_resolver");
}
