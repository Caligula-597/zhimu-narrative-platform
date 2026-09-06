/**
 * P9.4 Deterministic quality checks — coverage / length / placeholders / duplication.
 * Produce findings only; never assign aesthetic scores by word count alone.
 */

import { collectPackageTextUnits, playerRoles } from "./content-quality-package-text.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function finding(code, severity, message, evidence = []) {
  return { code, severity, message, evidence };
}

/**
 * @returns {object[]}
 */
export function runDeterministicQualityChecks(pkg) {
  const findings = [];
  const units = collectPackageTextUnits(pkg);
  const stages = asArray(pkg?.stages);
  const roles = playerRoles(pkg);
  const hostSections = asArray(pkg?.hostScript?.sections);
  const clues = asArray(pkg?.clues);

  if (!stages.length) {
    findings.push(finding("NO_STAGES", "error", "Package 无 stages"));
  }
  if (!roles.length) {
    findings.push(finding("NO_PLAYER_ROLES", "error", "Package 无玩家角色"));
  }

  for (const stage of stages) {
    if (!hostSections.some((s) => s.stageId === stage.id && asArray(s.paragraphs).length)) {
      findings.push(
        finding("HOST_STAGE_GAP", "warn", `主持本缺少 stage ${stage.id} 可执行段落`, [
          { stageId: stage.id, observation: "host coverage gap" },
        ]),
      );
    }
    for (const role of roles) {
      const secs = asArray(pkg?.roleScripts?.[role.id]).filter((s) => s.stageId === stage.id);
      if (!secs.length || !secs.some((s) => asArray(s.paragraphs).length)) {
        findings.push(
          finding("ROLE_STAGE_GAP", "warn", `角色 ${role.id} 缺少 stage ${stage.id}`, [
            { roleId: role.id, stageId: stage.id, observation: "role coverage gap" },
          ]),
        );
      }
    }
  }

  for (const clue of clues) {
    if (!asArray(clue.paragraphs).length) {
      findings.push(
        finding("CLUE_EMPTY", "warn", `线索 ${clue.id} 无正文载体`, [
          { clueId: clue.id, observation: "clue coverage gap" },
        ]),
      );
    }
  }

  if (!asArray(pkg?.endingContent?.sections).some((s) => asArray(s.paragraphs).length)) {
    findings.push(finding("ENDING_EMPTY", "warn", "终局 sections 为空"));
  }

  // Length anomalies — warn only, never treat as aesthetic score
  for (const unit of units) {
    const len = String(unit.text || "").length;
    if (len > 0 && len < 20) {
      findings.push(
        finding("SECTION_TOO_SHORT", "info", `${unit.kind} 段落过短（${len}字）`, [
          {
            sectionId: unit.sectionId,
            roleId: unit.roleId,
            stageId: unit.stageId,
            observation: "长度异常提醒，不是质量分",
          },
        ]),
      );
    }
    if (len > 6000) {
      findings.push(
        finding("SECTION_TOO_LONG", "info", `${unit.kind} 段落过长（${len}字）`, [
          {
            sectionId: unit.sectionId,
            roleId: unit.roleId,
            observation: "长度异常提醒，不是质量分",
          },
        ]),
      );
    }
  }

  // Near-duplicate paragraphs inside same role across stages (info)
  for (const role of roles) {
    const paras = asArray(pkg?.roleScripts?.[role.id]).flatMap((s) => asArray(s.paragraphs));
    const norm = paras.map((p) => String(p).replace(/\s+/g, "").slice(0, 40));
    const seen = new Set();
    for (const p of norm) {
      if (!p) continue;
      if (seen.has(p)) {
        findings.push(
          finding("ROLE_PARAGRAPH_REPEAT", "info", `角色 ${role.id} 存在高度重复段落`, [
            { roleId: role.id, excerpt: p, observation: "重复提醒" },
          ]),
        );
        break;
      }
      seen.add(p);
    }
  }

  return findings;
}
