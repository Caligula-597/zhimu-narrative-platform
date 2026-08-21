import { requestDeepseekJson } from "./deepseek.js";
import { untrustedUserPayload } from "./prompts/shared.js";
import {
  ACTION_TYPES,
  compileQuery,
  compileWorld,
  filterEventCandidates,
  listVenueOptions
} from "../../shared/world-engine/index.js";

function compactLedger(ledger) {
  return {
    venueKey: ledger.seed?.venueKey,
    dramaLevel: ledger.seed?.dramaLevel,
    banned: ledger.seed?.banned,
    allowed: ledger.seed?.allowed,
    genres: ledger.seed?.genres,
    inspiration: ledger.seed?.inspiration,
    characters: (ledger.characters || []).map((row) => ({
      id: row.id,
      name: row.name,
      roleKey: row.roleKey,
      locationId: row.locationId
    })),
    locations: (ledger.schema?.locations || []).map((row) => ({ id: row.id, name: row.name })),
    objects: (ledger.objects || []).map((row) => ({
      id: row.id,
      type: row.type,
      holder: row.holder,
      locationId: row.locationId
    })),
    accounts: ledger.accounts,
    debts: ledger.debts,
    eventIds: (ledger.eventLog || []).map((row) => row.eventId),
    loweredTypes: ledger.loweredTypes || []
  };
}

export function buildEventSearchMessages(ledger) {
  const system = `你只提出“这个世界里可能发生过的具体动作”，不得宣布已经发生。
只输出 JSON：{"candidates":[{"locationId":"LOC_x","actions":[{"type":"borrow","actor":"CHAR_001","counterparty":"CHAR_002","amount":8000,"currency":"CNY"}],"edges":[{"type":"caused_by","from":0,"to":1}]}]}
规则：
- type 只能用：${ACTION_TYPES.join(", ")}
- 只能引用给定的人物、场所、物件 ID
- 禁止中文句子当事实，禁止秘密、凶手、线索、反转
- 不为未来案件布局
- 不要求覆盖所有人
- 一个候选必须改变钱、所有权、位置、权限或留下可验证声称
- 不要写散文`;
  const user = `${untrustedUserPayload("当前世界状态", compactLedger(ledger))}
请提出 12 到 20 个彼此不同的候选。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

export function buildEpistemicSearchMessages(ledger, compiled) {
  const system = `你只提出可能的认知失真，不得新增 Canonical Event。
只输出 JSON：{"candidates":[{"source":"OBS_id","proposal":{"type":"omission","holder":"CHAR_001","field":"color"}}]}
允许 type：omission, source_confusion, post_event_contamination。
每个方案必须引用已有 observationId。
也可以提出 {"sources":["EVT_001","EVT_002"],"proposal":{"type":"false_causal_link","reason":"same_location_same_day"}} 作为作者可见歧义风险，不得写成任何人的结论。`;
  const user = untrustedUserPayload("观察与事件", {
    observations: (compiled.observations || []).slice(0, 40),
    eventIds: (ledger.eventLog || []).map((row) => row.eventId),
    characters: (ledger.characters || []).map((row) => row.id)
  });
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

export function buildNarrativeIrRenderMessages(payload) {
  const system = `根据输入的 Narrative IR 写成该角色这一幕的私人正文。
事实、信息来源、交谈形式和事件顺序已经确定，不得新增。
只输出 JSON：{"text":"连续中文正文"}，不解释输入结构。`;
  const user = untrustedUserPayload("Narrative IR", payload);
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

export function buildRenderMessages(query) {
  const system = `你正在写玩家私人角色本。
当前事实、人物知识和可发生状态已经确定，不得新增或修改。
只写当前角色实际经历、注意到、想起或被合理告知的内容。
人物首先处理眼前正在发生的事情。
不需要把提供给你的所有信息写出来。
输出 JSON：{"text":"连续中文正文"}`;
  const user = untrustedUserPayload("角色查询", query);
  return [{ role: "system", content: system }, { role: "user", content: user }];
}

export async function searchEventCandidates(ledger, { requestJson = requestDeepseekJson } = {}) {
  const result = await requestJson(buildEventSearchMessages(ledger), {
    maxTokens: 4000,
    temperature: 0.8
  });
  const raw = Array.isArray(result.value?.candidates) ? result.value.candidates : [];
  const filtered = filterEventCandidates(ledger, raw);
  return {
    model: result.model,
    ...filtered,
    venues: listVenueOptions()
  };
}

export async function searchEpistemicCandidates(ledger, { requestJson = requestDeepseekJson } = {}) {
  const compiled = compileWorld(ledger);
  const result = await requestJson(buildEpistemicSearchMessages(ledger, compiled), {
    maxTokens: 2500,
    temperature: 0.6
  });
  return {
    model: result.model,
    candidates: Array.isArray(result.value?.candidates) ? result.value.candidates.slice(0, 12) : []
  };
}

export async function renderFromNarrativeIr(payload, { requestJson = requestDeepseekJson } = {}) {
  const result = await requestJson(buildNarrativeIrRenderMessages(payload), {
    maxTokens: 2200,
    temperature: 0.35
  });
  const text = String(result.value?.text || "").trim();
  if (!text) return { ok: false, issues: ["正文为空"] };
  return { ok: true, text, model: result.model };
}

export async function renderCharacterAct(ledger, characterId, actId = "ACT_1", { requestJson = requestDeepseekJson } = {}) {
  const query = compileQuery(ledger, characterId, actId);
  if (!query) return { ok: false, issues: ["角色不存在"] };
  const result = await requestJson(buildRenderMessages(query), {
    maxTokens: 3500,
    temperature: 0.4
  });
  const text = String(result.value?.text || "").trim();
  if (!text) return { ok: false, issues: ["正文为空"] };
  return { ok: true, text, query, model: result.model };
}
