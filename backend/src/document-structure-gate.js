/**
 * Mechanical gate for document structure grouping.
 * Judges import readiness and emits a short deterministic plan — no LLM.
 */

function lookupKey(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("zh-CN");
}

function countByType(candidates) {
  const counts = { role: 0, act: 0, scene: 0, clue: 0, secret: 0 };
  for (const item of candidates || []) {
    if (counts[item.type] != null) counts[item.type] += 1;
  }
  return counts;
}

function detectDocumentKind(text, sectionBanners = []) {
  const body = String(text ?? "");
  const bannerKinds = new Set(sectionBanners.map((item) => item.kind));
  const hostSignals =
    /组织者手册|严禁盲开|开本流程|DM\s*搭配|盒装清单|主持人直接按照/.test(body) ||
    bannerKinds.has("host_meta") ||
    bannerKinds.has("run_flow");
  const roleBookSignals = /角色本|私人剧本|你的秘密|你的目标/.test(body);
  if (hostSignals && !roleBookSignals) return "host_handbook";
  if (roleBookSignals && !hostSignals) return "role_book";
  if (hostSignals && roleBookSignals) return "mixed";
  return "unknown";
}

/**
 * @param {{ candidates: object[], text?: string, filename?: string, sectionBanners?: object[], wasTruncated?: boolean, targetHint?: string }} input
 */
export function evaluateDocumentStructureGate(input = {}) {
  const candidates = Array.isArray(input.candidates) ? input.candidates : [];
  const text = String(input.text ?? "");
  const counts = countByType(candidates);
  const documentKind = detectDocumentKind(text, input.sectionBanners);
  const issues = [];
  const plan = [];
  let step = 1;

  const roleBodies = candidates.filter((item) => item.type === "role");
  const emptyRoleBodies = roleBodies.filter((item) => !String(item.body || "").trim());
  const roleBoundActs = candidates.filter((item) => item.type === "act" && item.roleName && String(item.body || "").trim());
  const actTitles = candidates.filter((item) => item.type === "act" && !item.roleName).map((item) => item.title);
  const uniqueActTitles = new Set(actTitles.map(lookupKey));
  const actDupRatio = actTitles.length ? 1 - uniqueActTitles.size / Math.max(actTitles.length, 1) : 0;
  const roleBookletCount = Number(input.roleBookletCount || 0);

  if (!candidates.length) {
    issues.push({
      code: "structure_empty",
      severity: "high",
      message: "未识别到角色、章节或其他结构块。"
    });
  }

  if (counts.role === 0) {
    issues.push({
      code: "roles_missing",
      severity: "high",
      message: "未识别到角色名；结构化导入前请确认稿件含角色简介或「角色：」标题。"
    });
  } else {
    plan.push({
      step: step++,
      action: "import_roles",
      label: `导入 ${counts.role} 个角色席位`
    });
  }

  if (counts.act === 0 && documentKind === "host_handbook") {
    issues.push({
      code: "chapters_missing",
      severity: "medium",
      message: "主持手册中未抽出明确章节；可从开本流程句补「第×章」。"
    });
  } else if (counts.act > 0) {
    plan.push({
      step: step++,
      action: "import_chapters",
      label: `导入 ${uniqueActTitles.size || counts.act} 个章节/分幕`
    });
  }

  if (actTitles.length >= 8 && actDupRatio >= 0.35) {
    issues.push({
      code: "act_false_positives_suspected",
      severity: "medium",
      message: "章节候选重复较多，疑似正文被误判为幕；请在预览中核对后再导入。"
    });
    plan.push({
      step: step++,
      action: "review_acts",
      label: "复核章节列表，去掉正文误伤项"
    });
  }

  if (documentKind === "host_handbook" && roleBoundActs.length === 0 && roleBookletCount < 2) {
    issues.push({
      code: "host_handbook_detected",
      severity: "medium",
      message: "文稿更像组织者/主持手册：可建角色席与章节，私人分幕正文可能不在本稿。"
    });
    plan.push({
      step: step++,
      action: "import_role_scripts",
      label: "另导各角色私人分幕正文（当前手册多为简介，无分角正文）"
    });
  } else if (roleBookletCount >= 2 || roleBoundActs.length > 0) {
    issues.push({
      code: "role_booklets_detected",
      severity: "low",
      message: `已按角色本顺序拆出 ${roleBookletCount || "若干"} 本，章节按页标/章号 1→2→3→4 阅读序排列。`
    });
    plan.push({
      step: step++,
      action: "import_role_sections",
      label: `导入各角色分幕正文（${roleBoundActs.length} 段，阅读序 1→2→3→4）`
    });
  } else if (emptyRoleBodies.length >= Math.max(1, Math.ceil(roleBodies.length / 2))) {
    plan.push({
      step: step++,
      action: "import_role_scripts",
      label: "补齐缺少正文的角色分幕后再开房"
    });
  }

  if (counts.scene > 0) {
    plan.push({
      step: step++,
      action: "import_scenes",
      label: `导入 ${counts.scene} 个搜证/地图场景`
    });
  }
  if (counts.clue > 0) {
    plan.push({
      step: step++,
      action: "import_clues",
      label: `导入 ${counts.clue} 条线索（主持可见草稿）`
    });
  }
  if (counts.secret > 0) {
    plan.push({
      step: step++,
      action: "import_secrets",
      label: `导入 ${counts.secret} 条秘密/遗书日记`
    });
  }
  if (counts.scene === 0 && counts.clue === 0 && /线索卡|地图|扫描|jpg|png/i.test(text)) {
    plan.push({
      step: step++,
      action: "upload_clue_assets",
      label: "线索卡/地图图档走素材库，不依赖正文解析"
    });
  } else if (/线索卡|地图一堆/i.test(text) || (input.sectionBanners || []).some((b) => b.kind === "clue_list")) {
    plan.push({
      step: step++,
      action: "upload_remaining_assets",
      label: "纯图线索卡/地图仍请上传素材库作附件"
    });
  }

  if (input.wasTruncated) {
    issues.push({
      code: "structure_truncated",
      severity: "medium",
      message: "识别结果超过 300 项，仅保留前 300 项；建议拆分稿件后分批导入。"
    });
  }

  if (candidates.some((item) => item.confidence !== "high")) {
    issues.push({
      code: "inferred_structure",
      severity: "low",
      message: "部分结构由角色简介、开本流程或文件名推断，导入前请人工复核。"
    });
  }

  const highIssues = issues.filter((item) => item.severity === "high");
  const readyForImport = highIssues.length === 0 && candidates.length > 0;

  if (readyForImport) {
    plan.push({
      step: step++,
      action: "confirm_import",
      label: "预览勾选确认后写入世界"
    });
  } else if (!candidates.length) {
    plan.push({
      step: step++,
      action: "fix_headings",
      label: "补充「角色简介」名单或「角色：/第×章」标题后重新解析"
    });
  }

  const warnings = issues.map((item) => item.message);

  return {
    version: "document-structure-gate-v1",
    readyForImport,
    documentKind,
    counts,
    issues,
    plan,
    warnings
  };
}
