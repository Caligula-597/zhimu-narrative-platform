import {
  newCompilerId,
  markStageComplete,
  pushWarning
} from "../state.js";

/**
 * Stage 4 — Scene Resolver.
 * locationHint → resolve/create Scene → backfill locationId.
 */
export async function stage4SceneResolver(state) {
  let next = {
    ...state,
    job: { ...(state.job || {}), currentStage: "scene_resolver" }
  };

  const scenesByName = new Map();
  for (const scene of state.scenes || []) {
    scenesByName.set(String(scene.name).trim(), scene);
  }

  function resolveScene(hint) {
    const name = String(hint || "").trim();
    if (!name) return null;
    if (scenesByName.has(name)) return scenesByName.get(name);
    const scene = {
      id: newCompilerId("scene"),
      name,
      parentSceneId: null,
      description: "",
      availableActs: [],
      eventIds: [],
      clueIds: [],
      interactiveObjects: []
    };
    scenesByName.set(name, scene);
    return scene;
  }

  const events = (state.timelineEvents || []).map((ev) => {
    if (ev.locationId) return ev;
    if (!ev.locationHint) return ev;
    const scene = resolveScene(ev.locationHint);
    return scene ? { ...ev, locationId: scene.id } : ev;
  });

  // Also seed scenes mentioned in host / scene docs as hints (no LLM).
  for (const doc of state.documents || []) {
    if (doc.kind !== "SCENE_FILE" && doc.kind !== "HOST_BOOK") continue;
    const titles = (doc.sections || [])
      .map((s) => String(s.title || "").trim())
      .filter((t) => t && t.length <= 40 && /厅|房|室|园|楼|廊|堂|院|馆/.test(t));
    for (const title of titles.slice(0, 40)) {
      resolveScene(title);
    }
  }

  const scenes = [...scenesByName.values()];
  if (!scenes.length && events.every((e) => !e.locationHint)) {
    next = pushWarning(next, {
      code: "SCENE_EMPTY",
      message: "尚未解析到场景；时间线生成后将按 locationHint 补全"
    });
  }

  next = { ...next, scenes, timelineEvents: events };
  return markStageComplete(next, "scene_resolver");
}
