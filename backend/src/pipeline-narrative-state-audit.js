import { createHash } from "node:crypto";

const STAGE_ORDER = ["source", "truth", "characters", "clues", "matrix", "outlines", "scripts", "host", "evaluation"];
const INVALIDATION_GRAPH = {
  source: ["source", "truth", "characters", "clues", "matrix", "outlines", "scripts", "host", "evaluation"],
  truth: ["truth", "characters", "clues", "matrix", "outlines", "scripts", "host", "evaluation"],
  characters: ["characters", "clues", "matrix", "outlines", "scripts", "host", "evaluation"],
  clues: ["clues", "matrix", "outlines", "scripts", "host", "evaluation"],
  matrix: ["matrix", "outlines", "scripts", "host", "evaluation"],
  outlines: ["outlines", "scripts", "evaluation"],
  scripts: ["scripts", "evaluation"],
  host: ["host", "evaluation"],
  evaluation: ["evaluation"]
};

function array(value) {
  return Array.isArray(value) ? value : [];
}

function compact(values) {
  return [...new Set(array(values).map((item) => String(item || "").trim()).filter(Boolean))];
}

function intersects(left, right) {
  const rightSet = new Set(compact(right));
  return compact(left).filter((item) => rightSet.has(item));
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
}

function fingerprint(value) {
  return createHash("sha256").update(stableJson(value ?? null)).digest("hex").slice(0, 16);
}

function invalidateFrom(stage) {
  return INVALIDATION_GRAPH[stage] || ["evaluation"];
}

function semanticKey(value, fallback = "item") {
  return String(value || fallback).trim().replace(/[./\\:|\s]+/g, "-").slice(0, 100) || fallback;
}

function stageFromPath(path) {
  const stage = String(path || "").split(".")[0];
  return STAGE_ORDER.includes(stage) ? stage : "evaluation";
}

function addNode(nodes, path, payload, dependsOn = [], metadata = {}) {
  nodes[path] = {
    fingerprint: fingerprint(payload),
    dependsOn: compact(dependsOn).filter((dependency) => dependency !== path),
    populated: payload != null,
    ...metadata
  };
}

function manifestDependents(manifest, seedPaths) {
  const nodes = manifest?.nodes || {};
  const reverse = new Map();
  for (const [path, node] of Object.entries(nodes)) {
    for (const dependency of compact(node.dependsOn)) {
      reverse.set(dependency, [...(reverse.get(dependency) || []), path]);
    }
  }
  const queue = compact(seedPaths).filter((path) => nodes[path]);
  const visited = new Set(queue);
  while (queue.length) {
    const current = queue.shift();
    for (const dependent of reverse.get(current) || []) {
      if (visited.has(dependent)) continue;
      visited.add(dependent);
      queue.push(dependent);
    }
  }
  return [...visited];
}

function targetPathsForIssue(item, targetStage, manifest) {
  const nodes = manifest?.nodes || {};
  const candidates = [];
  const rawTarget = String(item.targetPath || item.targetKey || item.cell || "").trim();
  if (rawTarget && nodes[rawTarget]) candidates.push(rawTarget);
  if (item.truthNodeKey) candidates.push(`truth.nodes.${semanticKey(item.truthNodeKey)}`);
  if (item.clueKey) candidates.push(`clues.items.${semanticKey(item.clueKey)}`);
  if (item.roleKey) candidates.push(`characters.roles.${semanticKey(item.roleKey)}`);
  if (item.actKey) {
    const actKey = semanticKey(item.actKey);
    if (targetStage === "host") candidates.push(`host.acts.${actKey}`);
    else if (targetStage === "matrix") candidates.push(`matrix.contracts.${actKey}`);
  }
  const cell = String(item.cell || item.targetKey || "").trim();
  const roleAct = cell.match(/^(role-[^_:/|]+)[_:/|](ch[^_:/|]+|act[^_:/|]+)$/i);
  if (roleAct) {
    const prefix = targetStage === "outlines" ? "outlines.cells" : "scripts.cells";
    candidates.push(`${prefix}.${semanticKey(roleAct[1])}.${semanticKey(roleAct[2])}`);
  }
  if (rawTarget) {
    const normalized = semanticKey(rawTarget);
    if (targetStage === "truth") candidates.push(`truth.nodes.${normalized}`, `truth.routes.${normalized}`, `truth.axes.${normalized}`);
    if (targetStage === "characters") candidates.push(`characters.roles.${normalized}`);
    if (targetStage === "clues") candidates.push(`clues.items.${normalized}`);
    if (targetStage === "matrix") candidates.push(`matrix.decisions.${normalized}`, `matrix.contracts.${normalized}`);
    if (targetStage === "host") candidates.push(`host.acts.${normalized}`);
  }
  const exact = compact(candidates).filter((path) => nodes[path]);
  if (exact.length) return exact;
  return nodes[targetStage] ? [targetStage] : [];
}

export function routeNarrativeIssue(issue = {}) {
  const explicitTarget = String(issue.targetLayer || "").trim().toLowerCase();
  if (STAGE_ORDER.includes(explicitTarget)) {
    return {
      targetStage: explicitTarget,
      invalidates: invalidateFrom(explicitTarget),
      reason: String(issue.problem || issue.detail || issue.message || issue.code || "未说明问题")
    };
  }
  const area = `${issue.area || ""} ${issue.code || ""} ${issue.targetLayer || ""} ${issue.detail || ""}`
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toLowerCase();
  let targetStage = "evaluation";
  if (/source|adaptation|fidelity|素材|原文/.test(area)) targetStage = "source";
  else if (/truth|logic|fact|causality|真相|因果|事实/.test(area)) targetStage = "truth";
  else if (/character|role_agency|persona|人物|角色|动机/.test(area)) targetStage = "characters";
  else if (/clue|fairness|topology|resilience|线索|推理路径/.test(area)) targetStage = "clues";
  else if (/matrix|shared_scene|consequence|cooperation|decision|scene_contract|矩阵|公共场景|结算/.test(area)) targetStage = "matrix";
  else if (/outline|knowledge_boundary|perspective|纲要|认知边界/.test(area)) targetStage = "outlines";
  else if (/script|prose|dialogue|pov|readability|human_authorship|terminology|正文|文风|对白|人称|造词/.test(area)) targetStage = "scripts";
  else if (/host|主持/.test(area)) targetStage = "host";
  return {
    targetStage,
    invalidates: invalidateFrom(targetStage),
    reason: String(issue.problem || issue.detail || issue.message || issue.code || "未说明问题")
  };
}

export function buildRepairPlan({ issues = [], revisions = [], manifest = null } = {}) {
  const items = [...array(issues), ...array(revisions)].map((item, index) => {
    const route = routeNarrativeIssue(item);
    const targetPaths = targetPathsForIssue(item, route.targetStage, manifest);
    const invalidatesPaths = targetPaths.length ? manifestDependents(manifest, targetPaths) : [];
    const invalidatedStages = invalidatesPaths.length
      ? compact(invalidatesPaths.map(stageFromPath)).sort((left, right) => STAGE_ORDER.indexOf(left) - STAGE_ORDER.indexOf(right))
      : route.invalidates;
    return {
      key: String(item.targetKey || item.cell || item.code || `repair-${index + 1}`),
      severity: String(item.severity || (item.priority === "must_fix" ? "high" : "medium")),
      targetStage: route.targetStage,
      targetPaths,
      invalidates: invalidatedStages,
      invalidatesPaths,
      problem: route.reason,
      direction: String(item.direction || item.action || "在目标层修正后，仅重算其下游依赖产物")
    };
  });
  const deduped = [];
  const seen = new Set();
  for (const item of items) {
    const signature = `${item.targetStage}:${item.key}:${item.problem}`;
    if (seen.has(signature)) continue;
    seen.add(signature);
    deduped.push(item);
  }
  return {
    strategy: "localized_dependency_rebuild",
    earliestStage: deduped
      .map((item) => STAGE_ORDER.indexOf(item.targetStage))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b)
      .map((index) => STAGE_ORDER[index])[0] || null,
    items: deduped.slice(0, 60)
  };
}

export function buildArtifactDependencyManifest({ setting, synopsis, truthBible, characterArchives, clueNetwork, infoMatrix, actOutlines, scripts, hostRunbooks } = {}) {
  const artifacts = {
    source: { payload: { setting, synopsis }, dependsOn: [] },
    truth: { payload: truthBible, dependsOn: ["source"] },
    characters: { payload: characterArchives, dependsOn: ["truth"] },
    clues: { payload: clueNetwork, dependsOn: ["truth", "characters"] },
    matrix: { payload: infoMatrix, dependsOn: ["truth", "characters", "clues"] },
    outlines: { payload: actOutlines, dependsOn: ["truth", "characters", "clues", "matrix"] },
    scripts: { payload: scripts, dependsOn: ["characters", "clues", "matrix", "outlines"] },
    host: { payload: hostRunbooks, dependsOn: ["truth", "characters", "clues", "matrix"] }
  };
  const nodes = {};
  addNode(nodes, "source", { setting, synopsis });
  addNode(nodes, "source.setting", setting, []);
  addNode(nodes, "source.synopsis", synopsis, []);
  addNode(nodes, "truth", truthBible, ["source.setting", "source.synopsis"]);
  addNode(nodes, "truth.core", {
    summary: truthBible?.summary,
    centralQuestion: truthBible?.centralQuestion,
    publicCrisis: truthBible?.publicCrisis,
    sharedObjective: truthBible?.sharedObjective,
    irreversibleDeadline: truthBible?.irreversibleDeadline,
    objectiveFacts: truthBible?.objectiveFacts
  }, ["source.setting", "source.synopsis"]);
  for (const node of array(truthBible?.truthNodes)) {
    addNode(nodes, `truth.nodes.${semanticKey(node.key)}`, node, [
      "truth.core",
      ...array(node.causedByTruthNodeKeys).map((key) => `truth.nodes.${semanticKey(key)}`)
    ], { entityKey: node.key });
  }
  for (const axis of array(truthBible?.endingAxes)) {
    addNode(nodes, `truth.axes.${semanticKey(axis.key)}`, axis, ["truth.core"], { entityKey: axis.key });
  }
  for (const route of array(truthBible?.endingRoutes)) {
    addNode(nodes, `truth.routes.${semanticKey(route.key)}`, route, array(route.requirements).map((item) => `truth.axes.${semanticKey(item.axisKey)}`), { entityKey: route.key });
  }
  for (const epilogue of array(truthBible?.roleEpilogues)) {
    for (const variant of array(epilogue.variants)) {
      addNode(nodes, `truth.epilogues.${semanticKey(epilogue.roleKey)}.${semanticKey(variant.key)}`, variant, array(variant.requirements).map((item) => `truth.axes.${semanticKey(item.axisKey)}`), {
        entityKey: variant.key,
        roleKey: epilogue.roleKey
      });
    }
  }

  addNode(nodes, "characters", characterArchives, ["truth"]);
  for (const role of array(characterArchives?.roles)) {
    const truthDependencies = compact([
      ...array(role.knownTruthNodeKeys),
      ...array(role.partialTruths).map((item) => item.truthNodeKey)
    ]).map((key) => `truth.nodes.${semanticKey(key)}`);
    const epilogueDependencies = Object.keys(nodes).filter((path) => path.startsWith(`truth.epilogues.${semanticKey(role.key)}.`));
    addNode(nodes, `characters.roles.${semanticKey(role.key)}`, role, ["truth.core", ...truthDependencies, ...epilogueDependencies], { entityKey: role.key });
  }

  addNode(nodes, "clues", clueNetwork, ["truth", "characters"]);
  for (const clue of array(clueNetwork?.clues)) {
    addNode(nodes, `clues.items.${semanticKey(clue.key)}`, clue, [
      ...array(clue.truthNodeKeys).map((key) => `truth.nodes.${semanticKey(key)}`),
      ...compact([...array(clue.holderRoleKeys), ...array(clue.interpreterRoleKeys), ...array(clue.involvedRoleKeys)]).map((key) => `characters.roles.${semanticKey(key)}`)
    ], { entityKey: clue.key, actKey: clue.actKey });
  }
  for (const coverage of array(clueNetwork?.truthCoverage)) {
    addNode(nodes, `clues.coverage.${semanticKey(coverage.truthNodeKey)}`, coverage, [
      `truth.nodes.${semanticKey(coverage.truthNodeKey)}`,
      ...array(coverage.paths).flatMap((path) => array(path.clueKeys).map((key) => `clues.items.${semanticKey(key)}`))
    ], { entityKey: coverage.truthNodeKey });
  }

  addNode(nodes, "matrix", infoMatrix, ["truth", "characters", "clues"]);
  for (const contract of array(infoMatrix?.actContracts)) {
    const roleDependencies = compact(array(contract.sceneSequence).flatMap((scene) => array(scene.presentRoleKeys)))
      .map((key) => `characters.roles.${semanticKey(key)}`);
    const clueDependencies = array(clueNetwork?.clues).filter((clue) => clue.actKey === contract.actKey).map((clue) => `clues.items.${semanticKey(clue.key)}`);
    addNode(nodes, `matrix.contracts.${semanticKey(contract.actKey)}`, contract, ["truth.core", ...roleDependencies, ...clueDependencies], { actKey: contract.actKey });
  }
  for (const decision of array(infoMatrix?.decisions)) {
    addNode(nodes, `matrix.decisions.${semanticKey(decision.key)}`, decision, [
      `matrix.contracts.${semanticKey(decision.actKey)}`,
      ...array(decision.options).flatMap((option) => compact([
        ...array(option.benefitingRoleKeys),
        ...array(option.harmedRoleKeys),
        ...array(option.counterplayRoleKeys)
      ])).map((key) => `characters.roles.${semanticKey(key)}`),
      ...array(decision.options).flatMap((option) => array(option.axisEffects).map((effect) => `truth.axes.${semanticKey(effect.axisKey)}`))
    ], { entityKey: decision.key, actKey: decision.actKey });
  }
  for (const row of array(infoMatrix?.rows)) {
    const decision = array(infoMatrix?.decisions).find((item) => item.actKey === row.actKey);
    addNode(nodes, `matrix.rows.${semanticKey(row.roleKey)}.${semanticKey(row.actKey)}`, row, [
      `characters.roles.${semanticKey(row.roleKey)}`,
      `matrix.contracts.${semanticKey(row.actKey)}`,
      ...(decision ? [`matrix.decisions.${semanticKey(decision.key)}`] : []),
      ...array(row.newClueIds).map((key) => `clues.items.${semanticKey(key)}`)
    ], { roleKey: row.roleKey, actKey: row.actKey });
  }

  addNode(nodes, "outlines", actOutlines, ["matrix"]);
  for (const [roleKey, acts] of Object.entries(actOutlines || {})) {
    for (const [actKey, outline] of Object.entries(acts || {})) {
      addNode(nodes, `outlines.cells.${semanticKey(roleKey)}.${semanticKey(actKey)}`, outline, [
        `matrix.rows.${semanticKey(roleKey)}.${semanticKey(actKey)}`,
        `characters.roles.${semanticKey(roleKey)}`
      ], { roleKey, actKey });
    }
  }

  addNode(nodes, "scripts", scripts, ["outlines", "matrix"]);
  for (const [roleKey, acts] of Object.entries(scripts || {})) {
    for (const [actKey, script] of Object.entries(acts || {})) {
      const outlinePath = `outlines.cells.${semanticKey(roleKey)}.${semanticKey(actKey)}`;
      addNode(nodes, `scripts.cells.${semanticKey(roleKey)}.${semanticKey(actKey)}`, script, [
        nodes[outlinePath] ? outlinePath : `matrix.rows.${semanticKey(roleKey)}.${semanticKey(actKey)}`,
        ...array(infoMatrix?.rows).find((row) => row.roleKey === roleKey && row.actKey === actKey)?.newClueIds?.map((key) => `clues.items.${semanticKey(key)}`) || []
      ], { roleKey, actKey });
    }
  }

  addNode(nodes, "host", hostRunbooks, ["truth", "clues", "matrix"]);
  for (const runbook of array(hostRunbooks)) {
    addNode(nodes, `host.acts.${semanticKey(runbook.actKey)}`, runbook, [
      `matrix.contracts.${semanticKey(runbook.actKey)}`,
      ...array(clueNetwork?.clues).filter((clue) => clue.actKey === runbook.actKey).map((clue) => `clues.items.${semanticKey(clue.key)}`)
    ], { actKey: runbook.actKey });
  }
  const evaluationDependencies = Object.keys(nodes).filter((path) =>
    path.startsWith("scripts.cells.") || path.startsWith("host.acts.") ||
    path.startsWith("matrix.decisions.") || path.startsWith("clues.coverage.")
  );
  addNode(nodes, "evaluation", null, evaluationDependencies.length
    ? evaluationDependencies
    : ["truth", "characters", "clues", "matrix", "outlines", "scripts", "host"]);

  return {
    version: "2.0",
    strategy: "content_fingerprint_dependency_dag",
    nodes,
    artifacts: Object.fromEntries(Object.entries(artifacts).map(([key, artifact]) => [key, {
      fingerprint: fingerprint(artifact.payload),
      dependsOn: artifact.dependsOn,
      populated: artifact.payload != null
    }]))
  };
}

export function diffArtifactDependencyManifests(previousManifest, nextManifest) {
  const previousNodes = previousManifest?.nodes || {};
  const nextNodes = nextManifest?.nodes || {};
  const allPaths = new Set([...Object.keys(previousNodes), ...Object.keys(nextNodes)]);
  const rawChanged = [...allPaths].filter((path) => previousNodes[path]?.fingerprint !== nextNodes[path]?.fingerprint);
  const changedSet = new Set(rawChanged);
  const changedPaths = rawChanged.filter((path) => !STAGE_ORDER.includes(path) || !rawChanged.some((candidate) => candidate.startsWith(`${path}.`)));
  const invalidatedPaths = manifestDependents(nextManifest, changedPaths.filter((path) => nextNodes[path]));
  return {
    version: "1.0",
    changedPaths,
    removedPaths: rawChanged.filter((path) => previousNodes[path] && !nextNodes[path]),
    addedPaths: rawChanged.filter((path) => !previousNodes[path] && nextNodes[path]),
    invalidatedPaths,
    invalidatedStages: compact(invalidatedPaths.map(stageFromPath)).sort((left, right) => STAGE_ORDER.indexOf(left) - STAGE_ORDER.indexOf(right)),
    changed: changedSet.size > 0
  };
}

export function scanCharacterTruthCausality(characterArchives, truthBible, { requireAgencyProfiles = true } = {}) {
  const roles = array(characterArchives?.roles);
  const roleKeys = new Set(roles.map((role) => role.key));
  const criticalNodes = array(truthBible?.truthNodes).filter((node) => node.importance === "critical");
  const tests = array(characterArchives?.truthStressTests);
  const testByTruth = new Map(tests.map((test) => [test.truthNodeKey, test]));
  const violations = [];

  for (const node of criticalNodes) {
    const test = testByTruth.get(node.key);
    if (!test) {
      violations.push({ code: "critical_truth_not_pressure_tested", truthNodeKey: node.key, targetStage: "characters", message: `关键真相 ${node.key} 未经人物利益与关系反压` });
      continue;
    }
    if (!test.pressureChain || test.roleKeys.length < 1 || test.roleKeys.some((key) => !roleKeys.has(key))) {
      violations.push({ code: "truth_pressure_chain_incomplete", truthNodeKey: node.key, targetStage: "characters", message: `关键真相 ${node.key} 的人物压力链不完整` });
    }
    if (test.behaviorVerdict !== "credible") {
      violations.push({
        code: "truth_character_contradiction",
        truthNodeKey: node.key,
        targetStage: test.behaviorVerdict === "truth_revision" ? "truth" : "characters",
        message: test.contradiction || `${node.key} 不能由现有人物自然做出`,
        revisionTarget: test.revisionTarget
      });
    }
  }

  if (requireAgencyProfiles) {
    for (const role of roles) {
      const profile = role.agencyProfile || {};
      if (!profile.agencyProof || !profile.dependencyProof || !profile.removalImpact || !array(profile.exposurePlan).length) {
        violations.push({ code: "role_agency_profile_incomplete", roleKey: role.key, targetStage: "characters", message: `${role.key} 缺少 Agency / Dependency / Exposure / 删除角色影响证明` });
      }
      for (const exposure of array(profile.exposurePlan)) {
        if (!exposure.actKey || !exposure.interaction || !array(exposure.affectedRoleKeys).length) {
          violations.push({ code: "role_exposure_plan_incomplete", roleKey: role.key, targetStage: "characters", message: `${role.key} 的核心互动进入点不可执行` });
        }
      }
    }
  }
  return { passed: violations.length === 0, violations };
}

export function scanClueDependencyIndependence(clueNetwork, truthBible) {
  const criticalKeys = new Set(array(truthBible?.truthNodes).filter((node) => node.importance === "critical").map((node) => node.key));
  const coverage = array(clueNetwork?.truthCoverage).filter((item) => criticalKeys.has(item.truthNodeKey));
  const violations = [];
  for (const item of coverage) {
    const paths = array(item.paths);
    for (const path of paths) {
      if (!path.dependencyMetadataComplete) {
        violations.push({ code: "clue_path_dependency_metadata_incomplete", truthNodeKey: item.truthNodeKey, paths: [path.key] });
      }
    }
    for (let leftIndex = 0; leftIndex < paths.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < paths.length; rightIndex += 1) {
        const left = paths[leftIndex];
        const right = paths[rightIndex];
        const sharedRoles = intersects(left.requiredRoleKeys, right.requiredRoleKeys);
        const sharedInterpreters = intersects(left.requiredInterpreterRoleKeys, right.requiredInterpreterRoleKeys);
        const sharedActs = intersects(left.requiredActKeys, right.requiredActKeys);
        const sameReasoning = left.reasoningMode && right.reasoningMode && left.reasoningMode === right.reasoningMode;
        if (sharedRoles.length) violations.push({ code: "clue_paths_share_required_role", truthNodeKey: item.truthNodeKey, paths: [left.key, right.key], detail: sharedRoles });
        if (sharedInterpreters.length) violations.push({ code: "clue_paths_share_interpreter", truthNodeKey: item.truthNodeKey, paths: [left.key, right.key], detail: sharedInterpreters });
        if (sharedActs.length && left.requiredActKeys.length === 1 && right.requiredActKeys.length === 1) {
          violations.push({ code: "clue_paths_share_single_act_trigger", truthNodeKey: item.truthNodeKey, paths: [left.key, right.key], detail: sharedActs });
        }
        if (sameReasoning) violations.push({ code: "clue_paths_share_reasoning_mode", truthNodeKey: item.truthNodeKey, paths: [left.key, right.key], detail: left.reasoningMode });
      }
    }
  }
  return { passed: violations.length === 0, violations };
}

export function scanSharedInteractionContracts(infoMatrix) {
  const violations = [];
  const seenBeatKeys = new Set();
  for (const contract of array(infoMatrix?.actContracts)) {
    for (const scene of array(contract.sceneSequence)) {
      const beats = array(scene.observableBeats);
      if (scene.presentRoleKeys?.length >= 2 && beats.length < 1) {
        violations.push({ code: "shared_scene_without_observable_beats", actKey: contract.actKey, sceneKey: scene.sceneKey });
      }
      for (const beat of beats) {
        if (!beat.key || seenBeatKeys.has(beat.key)) violations.push({ code: "shared_beat_key_invalid", actKey: contract.actKey, sceneKey: scene.sceneKey, beatKey: beat.key });
        if (beat.key) seenBeatKeys.add(beat.key);
        if (!scene.presentRoleKeys.includes(beat.actorRoleKey)) violations.push({ code: "shared_beat_actor_absent", actKey: contract.actKey, sceneKey: scene.sceneKey, beatKey: beat.key });
        if (!beat.actionOrLine || !beat.interpretationFreedom) violations.push({ code: "shared_beat_incomplete", actKey: contract.actKey, sceneKey: scene.sceneKey, beatKey: beat.key });
      }
    }
  }
  return { passed: violations.length === 0, violations };
}

export function scanRoleRemovalImpact(characterArchives, clueNetwork, infoMatrix) {
  const roles = array(characterArchives?.roles);
  const violations = [];
  const metrics = [];
  for (const role of roles) {
    const key = role.key;
    const outgoingDebts = array(role.relationshipDebts).length;
    const incomingDebts = roles.reduce((count, other) => count + array(other.relationshipDebts).filter((debt) => debt.roleKey === key).length, 0);
    const clueDependencies = array(clueNetwork?.clues).filter((clue) =>
      array(clue.holderRoleKeys).includes(key) || array(clue.interpreterRoleKeys).includes(key) || array(clue.involvedRoleKeys).includes(key)
    ).length;
    const decisionInfluence = array(infoMatrix?.decisions).reduce((count, decision) => count + array(decision.options).filter((option) =>
      [...array(option.benefitingRoleKeys), ...array(option.harmedRoleKeys), ...array(option.counterplayRoleKeys)].includes(key)
    ).length, 0);
    const sceneExposure = array(infoMatrix?.actContracts).reduce((count, contract) => count + array(contract.sceneSequence).filter((scene) => array(scene.presentRoleKeys).includes(key)).length, 0);
    const activeRows = array(infoMatrix?.rows).filter((row) => row.roleKey === key && (array(row.tasks).length || array(row.newClueIds).length)).length;
    const profile = role.agencyProfile || {};
    const agency = array(role.playableMoves).length + decisionInfluence + (profile.agencyProof ? 1 : 0);
    const dependency = outgoingDebts + incomingDebts + clueDependencies + (profile.dependencyProof ? 1 : 0);
    const exposure = sceneExposure + activeRows + array(profile.exposurePlan).length;
    const metric = { roleKey: key, agency, dependency, exposure, removalImpact: profile.removalImpact || "" };
    metrics.push(metric);
    if (!profile.removalImpact || agency < 2 || dependency < 2 || exposure < 2) {
      violations.push({ code: "role_removal_has_low_impact", ...metric, message: `${key} 被删除后对行动、关系或信息路径的影响仍不够具体` });
    }
  }
  return { passed: violations.length === 0, metrics, violations };
}

export function scanMatrixDryRun({ infoMatrix, clueNetwork, characterArchives } = {}) {
  const violations = [];
  const sceneKeys = new Set(array(infoMatrix?.actContracts).flatMap((contract) => array(contract.sceneSequence).map((scene) => scene.sceneKey)));
  for (const row of array(infoMatrix?.rows)) {
    if (!array(row.tasks).length && !array(row.newClueIds).length) {
      violations.push({ code: "idle_role_act", roleKey: row.roleKey, actKey: row.actKey, message: "该角色本幕既没有可执行任务，也没有新信息" });
    }
  }
  for (const clue of array(clueNetwork?.clues)) {
    if (clue.grantMode === "explore" && (!clue.acquisition?.sceneKey || !sceneKeys.has(clue.acquisition.sceneKey))) {
      violations.push({ code: "explore_clue_without_scene", clueKey: clue.key, sceneKey: clue.acquisition?.sceneKey || "" });
    }
  }
  const roleKeys = new Set(array(characterArchives?.roles).map((role) => role.key));
  for (const contract of array(infoMatrix?.actContracts)) {
    for (const scene of array(contract.sceneSequence)) {
      if (array(scene.presentRoleKeys).some((key) => !roleKeys.has(key))) {
        violations.push({ code: "dry_run_unknown_role", actKey: contract.actKey, sceneKey: scene.sceneKey });
      }
      if (!scene.entryAction || !scene.stateChange) {
        violations.push({ code: "dry_run_scene_has_no_transition", actKey: contract.actKey, sceneKey: scene.sceneKey });
      }
    }
  }
  return { passed: violations.length === 0, violations };
}
