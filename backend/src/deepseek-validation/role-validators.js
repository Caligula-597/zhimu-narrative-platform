import { throwErr } from "../api-errors.js";
import { cleanText } from "../prompts/shared.js";
import { MAX_PLAYERS } from "./constants.js";
import { assertArray } from "./primitives.js";

export function validateRoleMatrix(raw, spec, proposal) {
  const value = raw && typeof raw === "object" ? raw : {};
  const roles = assertArray(value.roles, "roles").slice(0, MAX_PLAYERS);
  if (roles.length !== spec.playerCount) throwErr("DEEPSEEK_OUTPUT_INVALID", `AI 角色矩阵需恰好 ${spec.playerCount} 个角色，实际 ${roles.length} 个`);
  const chapterKeys = new Set(proposal.chapters.map((chapter) => chapter.key));
  const roleKeys = new Set();
  for (const role of roles) {
    if (!role?.key || roleKeys.has(role.key)) throwErr("DEEPSEEK_OUTPUT_INVALID", "角色矩阵 key 必须唯一");
    roleKeys.add(role.key);
    role.name = cleanText(role.name, 80);
    role.publicProfile = cleanText(role.publicProfile, 800);
    role.privateProfile = cleanText(role.privateProfile, 2000);
    role.chapterKnowledge = assertArray(role.chapterKnowledge ?? [], `roles.${role.key}.chapterKnowledge`).slice(0, 12).map((row) => ({
      chapterKey: chapterKeys.has(row.chapterKey) ? row.chapterKey : proposal.chapters[0]?.key,
      knows: cleanText(row.knows, 800),
      mustHide: cleanText(row.mustHide, 800),
      canDiscuss: cleanText(row.canDiscuss, 800)
    }));
    if (!role.name) throwErr("DEEPSEEK_OUTPUT_INVALID", `角色 ${role.key} 缺少 name`);
  }
  return {
    roles,
    crossChecks: assertArray(value.crossChecks ?? [], "crossChecks").slice(0, 16).map((item) => ({
      conclusion: cleanText(item.conclusion, 400),
      sources: assertArray(item.sources ?? [], "crossChecks.sources").slice(0, 6).map((source) => cleanText(source, 40))
    })),
    suggestions: assertArray(value.suggestions ?? [], "suggestions").slice(0, 12).map((item) => cleanText(item, 500))
  };
}

export function validateRoleSection(raw, roleKey, chapterKey, minWords = 250) {
  const value = raw && typeof raw === "object" ? raw : {};
  if (value.roleKey !== roleKey || value.chapterKey !== chapterKey) throwErr("DEEPSEEK_OUTPUT_INVALID", "分幕 roleKey/chapterKey 与请求不一致");
  const body = cleanText(value.body, 6000);
  if (body.length < minWords) {
    throwErr("DEEPSEEK_OUTPUT_INVALID", `分幕正文仅 ${body.length} 字，未达到最低 ${minWords} 字`, { actualChars: body.length, minChars: minWords, roleKey, chapterKey });
  }
  return {
    roleKey,
    chapterKey,
    title: cleanText(value.title, 160) || `${chapterKey} · 私人分幕`,
    body
  };
}

export function validateRolesFromNarrative(raw, spec, roleMatrix) {
  const value = raw && typeof raw === "object" ? raw : {};
  const sectionsRaw = Array.isArray(value.sections) ? value.sections : [];
  const roleKeys = new Set(roleMatrix.roles.map((r) => r.key));
  const chapterKeys = new Set(spec.chapterKeys);
  const sectionsByRole = new Map();
  for (const item of sectionsRaw) {
    const roleKey = cleanText(item?.roleKey, 40);
    const chapterKey = cleanText(item?.chapterKey, 40);
    if (!roleKeys.has(roleKey) || !chapterKeys.has(chapterKey)) continue;
    const roleSections = sectionsByRole.get(roleKey) ?? new Map();
    roleSections.set(chapterKey, validateRoleSection(
      { roleKey, chapterKey, title: item.title, body: item.body },
      roleKey,
      chapterKey,
      spec.wordsPerSectionMin || 250
    ));
    sectionsByRole.set(roleKey, roleSections);
  }
  const sections = Object.fromEntries(
    [...sectionsByRole].map(([roleKey, roleSections]) => [roleKey, Object.fromEntries(roleSections)])
  );
  const expected = spec.playerCount * spec.chapterKeys.length;
  const actual = Object.values(sections).reduce((n, ch) => n + Object.keys(ch).length, 0);
  if (actual < expected) throwErr("DEEPSEEK_OUTPUT_INVALID", `AI 仅返回 ${actual}/${expected} 个角色分幕`);
  return {
    sections,
    suggestions: Array.isArray(value.suggestions) ? value.suggestions.slice(0, 12).map((item) => cleanText(item, 500)) : []
  };
}

export function validateRolesMeta(raw, playerCount) {
  const value = raw && typeof raw === "object" ? raw : {};
  const roles = assertArray(value.roles, "roles").slice(0, MAX_PLAYERS);
  if (roles.length !== playerCount) throwErr("DEEPSEEK_OUTPUT_INVALID", `AI 返回 ${roles.length} 个角色，需要 ${playerCount} 个`);
  const keys = new Set();
  return {
    roles: roles.map((role, index) => {
      const key = cleanText(role?.key, 40) || `role-${index + 1}`;
      if (keys.has(key)) throwErr("DEEPSEEK_OUTPUT_INVALID", "角色 key 必须唯一");
      keys.add(key);
      return {
        key,
        name: cleanText(role.name, 80) || `角色 ${index + 1}`,
        publicProfile: cleanText(role.publicProfile, 800),
        privateProfile: cleanText(role.privateProfile, 2000)
      };
    }),
    suggestions: Array.isArray(value.suggestions) ? value.suggestions.slice(0, 8).map((item) => cleanText(item, 500)) : []
  };
}

export function validateRoleScriptFromNarrative(raw, roleKey, spec, minWords, requiredChapterKeys = null) {
  const value = raw && typeof raw === "object" ? raw : {};
  const sectionsRaw = Array.isArray(value.sections) ? value.sections : [];
  const sections = new Map();
  for (const item of sectionsRaw) {
    const rk = cleanText(item?.roleKey, 40);
    const ck = cleanText(item?.chapterKey, 40);
    if (rk !== roleKey || !spec.chapterKeys.includes(ck)) continue;
    sections.set(ck, validateRoleSection(
      { roleKey, chapterKey: ck, title: item.title, body: item.body },
      roleKey,
      ck,
      minWords
    ));
  }
  const keys = requiredChapterKeys || spec.chapterKeys;
  const missing = keys.filter((ck) => !sections.has(ck));
  if (missing.length) throwErr("DEEPSEEK_OUTPUT_INVALID", `角色 ${roleKey} 缺少分幕：${missing.join("、")}`, { roleKey, missing });
  return {
    roleKey,
    sections: Object.fromEntries(sections),
    suggestions: Array.isArray(value.suggestions) ? value.suggestions.slice(0, 8).map((item) => cleanText(item, 500)) : []
  };
}
