export const COMMUNICATION_TEMPLATE_VERSION = 1;
export const COMMUNICATION_TEMPLATE_KINDS = Object.freeze([
  "testimony",
  "public_statement",
  "secret_action",
  "ask_host",
]);

const DEFAULTS = Object.freeze({
  testimony: Object.freeze({
    title: "提交口供",
    privacyNotice: "仅主持人与协主持可见，不会向其他玩家公开。",
    placeholder: "写下你此刻愿意向主持人陈述的内容…",
  }),
  public_statement: Object.freeze({
    title: "公开陈述",
    privacyNotice: "提交后房间内全部玩家和主持均可查看。",
    placeholder: "写下你愿意向全场公开的陈述…",
  }),
  secret_action: Object.freeze({
    title: "秘密行动",
    privacyNotice: "仅你、主持人与协主持可见。",
    placeholder: "说明你想秘密完成的行动与预期结果…",
  }),
  ask_host: Object.freeze({
    title: "询问主持",
    privacyNotice: "仅你、主持人与协主持可见。",
    placeholder: "写下需要主持确认的问题…",
  }),
});

function cleanText(value, fallback, max) {
  const text = String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (text || fallback).slice(0, max);
}

function cleanDeadline(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 1440 ? parsed : 0;
}

export function normalizeCommunicationTemplates(input) {
  const byKind = new Map(
    (Array.isArray(input) ? input : [])
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => [entry.kind, entry])
  );
  return COMMUNICATION_TEMPLATE_KINDS.map((kind) => {
    const source = byKind.get(kind) || {};
    const defaults = DEFAULTS[kind];
    return {
      version: COMMUNICATION_TEMPLATE_VERSION,
      key: kind,
      kind,
      enabled: source.enabled !== false,
      title: cleanText(source.title, defaults.title, 120),
      privacyNotice: cleanText(source.privacyNotice, defaults.privacyNotice, 500),
      placeholder: cleanText(source.placeholder, defaults.placeholder, 300),
      deadlineMinutes: cleanDeadline(source.deadlineMinutes),
    };
  });
}

export function communicationTemplateFor(input, key) {
  return normalizeCommunicationTemplates(input).find((template) => template.key === key) || null;
}

export function communicationActionPolicy(kind) {
  if (kind === "public_statement") return { actionType: "public_statement", visibility: "public" };
  if (kind === "secret_action") return { actionType: "secret_action", visibility: "actor_host" };
  if (kind === "ask_host") return { actionType: "ask_host", visibility: "actor_host" };
  return null;
}
