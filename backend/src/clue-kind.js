/** Normalize clues.clue_kind from explicit fields, legacy metadata, or text heuristics. */

const VALID_KINDS = new Set(["general", "deep", "verify", "misdirect", "emotion", "mechanic"]);

const TEXT_KIND_PATTERNS = [
  { kind: "misdirect", pattern: /误导|红鲱|假象|伪装|嫁祸|陷阱|烟幕|假线索|故意误导/i },
  { kind: "verify", pattern: /验证|印证|对照|核实|确认|佐证|复核|交叉验证/i },
  { kind: "deep", pattern: /关键|核心|真相|决定性|深入|要害|锁定|突破口|真凶/i },
  { kind: "emotion", pattern: /情感|关系|证词|回忆|日记|情书|创伤|内心|羁绊|亲情|爱情/i },
  { kind: "mechanic", pattern: /机制|密码|暗号|cipher|时间线|机关|拼图|规则|电报|密文|解谜/i }
];

function inferClueKindFromText(name = "", text = "") {
  const haystack = `${name}\n${text}`.trim();
  if (!haystack) return null;
  for (const { kind, pattern } of TEXT_KIND_PATTERNS) {
    if (pattern.test(haystack)) return kind;
  }
  if (/信件|记录|残页|照片|相片|钥匙|账本|合同|遗嘱/.test(haystack)) return "deep";
  return null;
}

export function resolveClueKind(source = {}) {
  const meta = source.metadata && typeof source.metadata === "object" ? source.metadata : {};
  const explicit =
    source.clueKind ??
    source.clue_kind ??
    source.kind ??
    meta.clueKind ??
    meta.clue_kind ??
    meta.kind ??
    null;
  if (explicit && VALID_KINDS.has(String(explicit))) return String(explicit);

  const importance = source.importance ?? meta.importance;
  if (importance === "red_herring") return "misdirect";
  if (importance === "prerequisite") return "verify";
  if (importance === "truth_piece" || importance === "finale_key" || importance === "key") return "deep";
  if (importance === "optional") return "emotion";

  const clueType = source.clueType ?? meta.clueType;
  if (clueType === "relationship" || clueType === "testimony") return "emotion";
  if (clueType === "cipher" || clueType === "timeline") return "mechanic";

  const draftType = source.draftType ?? source.type ?? meta.draftType;
  if (draftType === "investigation_point") return "verify";

  const fromText = inferClueKindFromText(
    source.name ?? source.title ?? meta.name ?? "",
    source.text ?? source.publicText ?? source.public_text ?? source.description ?? meta.text ?? ""
  );
  if (fromText) return fromText;

  return "general";
}
