/**
 * Pre-publish / playtest readiness evaluation for a world snapshot.
 */

function add(checks, { id, level, title, detail, target = null }) {
  checks.push({ id, level, title, detail, ...(target ? { target } : {}) });
}

function publishedSections(sections) {
  return sections.filter((section) => section.publication_status && section.publication_status !== "draft");
}

export function evaluateWorldPublishReadiness(snapshot) {
  const checks = [];
  const roles = snapshot.roles ?? [];
  const sections = snapshot.sections ?? [];
  const chapters = snapshot.chapters ?? [];
  const scenes = snapshot.scenes ?? [];
  const clues = snapshot.clues ?? [];
  const points = snapshot.investigationPoints ?? [];
  const rules = snapshot.rules ?? [];
  const edges = snapshot.edges ?? [];
  const rooms = snapshot.rooms ?? [];
  const world = snapshot.world ?? {};

  if (!String(world.name ?? "").trim()) {
    add(checks, {
      id: "world.name_missing",
      level: "error",
      title: "剧本尚未命名",
      detail: "请在「世界设置」填写剧本名称。"
    });
  }

  if (!roles.length) {
    add(checks, {
      id: "roles.missing",
      level: "error",
      title: "尚未创建角色",
      detail: "至少需要一个玩家角色席位。",
      target: { kind: "roles" }
    });
  }

  for (const role of roles) {
    const roleSections = sections.filter((section) => section.role_slot_id === role.id);
    if (!roleSections.length) {
      add(checks, {
        id: `roles.${role.id}.sections_missing`,
        level: "error",
        title: `${role.name} 没有私人剧本`,
        detail: "请为该角色新增至少一幕正文。",
        target: { kind: "sections", roleSlotId: role.id }
      });
    } else if (!roleSections.some((section) => section.publication_status !== "draft")) {
      add(checks, {
        id: `roles.${role.id}.no_testable_section`,
        level: "warning",
        title: `${role.name} 尚无可测试内容`,
        detail: "将至少一幕切换为「测试中」或「已发布」。",
        target: { kind: "sections", roleSlotId: role.id }
      });
    }
  }

  if (!publishedSections(sections).length && sections.length) {
    add(checks, {
      id: "sections.none_published",
      level: "warning",
      title: "尚无已发布/测试中的分幕",
      detail: "玩家入房后无法阅读任何私人章节，请至少开放一幕。",
      target: { kind: "sections" }
    });
  }

  if (!chapters.length) {
    add(checks, {
      id: "chapters.missing",
      level: "error",
      title: "尚未创建公共章节",
      detail: "请先建立故事章节结构。",
      target: { kind: "chapters" }
    });
  }

  if (!scenes.length) {
    add(checks, {
      id: "scenes.missing",
      level: "warning",
      title: "尚未创建公共场景",
      detail: "玩家进入房间后将没有可探索地点。",
      target: { kind: "scenes" }
    });
  }

  if (!clues.length) {
    add(checks, {
      id: "clues.missing",
      level: "warning",
      title: "尚未创建线索",
      detail: "建议至少建立一条玩家可获得的线索。",
      target: { kind: "clues" }
    });
  }

  for (const section of sections) {
    if (!section.body?.trim()) {
      add(checks, {
        id: `sections.${section.id}.empty_body`,
        level: "error",
        title: `${section.title || "分幕"} 正文为空`,
        detail: "玩家无法阅读空白分幕。",
        target: { kind: "sections", sectionId: section.id }
      });
    }
  }

  for (const point of points) {
    if (!point.result_text?.trim()) {
      add(checks, {
        id: `points.${point.id}.empty_result`,
        level: "warning",
        title: `${point.name} 没有调查结果`,
        detail: "调查点需要告诉玩家搜证后发生了什么。",
        target: { kind: "investigation_points", pointId: point.id }
      });
    }
  }

  const grantedClueIds = new Set([
    ...points.map((point) => point.clue_id).filter(Boolean),
    ...rules
      .flatMap((rule) => rule.actions ?? [])
      .filter((action) => action.type === "grant_clue")
      .map((action) => action.clueId)
  ]);
  for (const clue of clues) {
    if (!grantedClueIds.has(clue.id)) {
      add(checks, {
        id: `clues.${clue.id}.unreachable`,
        level: "warning",
        title: `${clue.name} 没有获得入口`,
        detail: "请将线索绑定到调查点，或通过自动化规则/主持发放。",
        target: { kind: "clues", clueId: clue.id }
      });
    }
  }

  if (scenes.length > 1 && !edges.length) {
    add(checks, {
      id: "graph.edges_missing",
      level: "warning",
      title: "剧情节点尚未连线",
      detail: "使用主线、并列或延伸关系组织剧情图谱。",
      target: { kind: "studio_graph" }
    });
  }

  const linked = new Set(edges.flatMap((edge) => [`${edge.from_type}:${edge.from_id}`, `${edge.to_type}:${edge.to_id}`]));
  for (const scene of scenes) {
    if (scenes.length > 1 && !linked.has(`scene:${scene.id}`)) {
      add(checks, {
        id: `scenes.${scene.id}.orphan`,
        level: "warning",
        title: `${scene.name} 尚未进入剧情线`,
        detail: "该场景目前是孤立节点。",
        target: { kind: "scenes", sceneId: scene.id }
      });
    }
  }

  for (const rule of rules) {
    if (!rule.conditions?.all?.length) {
      add(checks, {
        id: `rules.${rule.id}.no_conditions`,
        level: "warning",
        title: `${rule.name} 没有检测条件`,
        detail: "规则不会自动判断何时触发。",
        target: { kind: "rules", ruleId: rule.id }
      });
    }
    if (!rule.actions?.length) {
      add(checks, {
        id: `rules.${rule.id}.no_actions`,
        level: "error",
        title: `${rule.name} 没有执行动作`,
        detail: "规则触发后不会产生任何结果。",
        target: { kind: "rules", ruleId: rule.id }
      });
    }
    const ids = {
      roles: new Set(roles.map((item) => item.id)),
      sections: new Set(sections.map((item) => item.id)),
      scenes: new Set(scenes.map((item) => item.id)),
      clues: new Set(clues.map((item) => item.id)),
      points: new Set(points.map((item) => item.id))
    };
    for (const condition of rule.conditions?.all ?? []) {
      if (condition.roleSlotId && !ids.roles.has(condition.roleSlotId)) {
        add(checks, {
          id: `rules.${rule.id}.broken_role_ref`,
          level: "error",
          title: `${rule.name} 引用了不存在的角色`,
          detail: String(condition.roleSlotId),
          target: { kind: "rules", ruleId: rule.id }
        });
      }
      if (condition.scriptSectionId && !ids.sections.has(condition.scriptSectionId)) {
        add(checks, {
          id: `rules.${rule.id}.broken_section_ref`,
          level: "error",
          title: `${rule.name} 引用了不存在的分幕`,
          detail: String(condition.scriptSectionId),
          target: { kind: "rules", ruleId: rule.id }
        });
      }
      if (condition.clueId && !ids.clues.has(condition.clueId)) {
        add(checks, {
          id: `rules.${rule.id}.broken_clue_ref`,
          level: "error",
          title: `${rule.name} 引用了不存在的线索`,
          detail: String(condition.clueId),
          target: { kind: "rules", ruleId: rule.id }
        });
      }
      if (condition.investigationPointId && !ids.points.has(condition.investigationPointId)) {
        add(checks, {
          id: `rules.${rule.id}.broken_point_ref`,
          level: "error",
          title: `${rule.name} 引用了不存在的调查点`,
          detail: String(condition.investigationPointId),
          target: { kind: "rules", ruleId: rule.id }
        });
      }
    }
    for (const action of rule.actions ?? []) {
      if (action.roleSlotId && !ids.roles.has(action.roleSlotId)) {
        add(checks, {
          id: `rules.${rule.id}.broken_action_role`,
          level: "error",
          title: `${rule.name} 的动作引用了不存在的角色`,
          detail: String(action.roleSlotId),
          target: { kind: "rules", ruleId: rule.id }
        });
      }
      if (action.scriptSectionId && !ids.sections.has(action.scriptSectionId)) {
        add(checks, {
          id: `rules.${rule.id}.broken_action_section`,
          level: "error",
          title: `${rule.name} 的动作引用了不存在的分幕`,
          detail: String(action.scriptSectionId),
          target: { kind: "rules", ruleId: rule.id }
        });
      }
      if (action.clueId && !ids.clues.has(action.clueId)) {
        add(checks, {
          id: `rules.${rule.id}.broken_action_clue`,
          level: "error",
          title: `${rule.name} 的动作引用了不存在的线索`,
          detail: String(action.clueId),
          target: { kind: "rules", ruleId: rule.id }
        });
      }
      if (action.sceneId && !ids.scenes.has(action.sceneId)) {
        add(checks, {
          id: `rules.${rule.id}.broken_action_scene`,
          level: "error",
          title: `${rule.name} 的动作引用了不存在的场景`,
          detail: String(action.sceneId),
          target: { kind: "rules", ruleId: rule.id }
        });
      }
    }
  }

  if (!rooms.length) {
    add(checks, {
      id: "rooms.missing",
      level: "warning",
      title: "尚未建立测试平行房",
      detail: "在总览或向导最后一步创建测试房，获取邀请码后再邀请玩家。",
      target: { kind: "rooms" }
    });
  }

  if (!checks.length) {
    add(checks, {
      id: "summary.passed",
      level: "success",
      title: "发布前检查已通过",
      detail: "角色、分幕、场景与规则引用均可进入测试。"
    });
  }

  const errorCount = checks.filter((item) => item.level === "error").length;
  const warningCount = checks.filter((item) => item.level === "warning").length;

  const readyForPlaytest =
    errorCount === 0 &&
    roles.length > 0 &&
    sections.some((section) => section.body?.trim()) &&
    chapters.length > 0;

  const readyForCatalog =
    readyForPlaytest &&
    warningCount === 0 &&
    rooms.length > 0 &&
    publishedSections(sections).length > 0 &&
    scenes.length > 0 &&
    clues.length > 0;

  return {
    checks,
    summary: {
      errorCount,
      warningCount,
      successCount: checks.filter((item) => item.level === "success").length,
      readyForPlaytest,
      readyForCatalog,
      counts: {
        roles: roles.length,
        sections: sections.length,
        publishedSections: publishedSections(sections).length,
        chapters: chapters.length,
        scenes: scenes.length,
        clues: clues.length,
        investigationPoints: points.length,
        rules: rules.length,
        rooms: rooms.length
      }
    }
  };
}

/** Legacy flat checks array used by studio/rules/import preview. */
export function creatorChecks(snapshot) {
  return evaluateWorldPublishReadiness(snapshot).checks.map(({ level, title, detail }) => ({
    level,
    title,
    detail
  }));
}
