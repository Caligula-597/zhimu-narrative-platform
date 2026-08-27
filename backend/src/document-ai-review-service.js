import { requestDeepseekJson } from "./deepseek-client.js";
import { deepseekConfig } from "./deepseek-config.js";
import { inspectPlayerProse } from "../../shared/prose-quality-gate.js";

function resolveDocumentReviewMode() {
  const explicit = String(process.env.CREATOR_DOCUMENT_AI_REVIEW || "").trim().toLowerCase();
  const production = (process.env.NODE_ENV ?? "development") === "production";
  if (production) {
    return deepseekConfig().configured && explicit !== "off" ? "ai" : "heuristic";
  }
  if (explicit === "off") return "off";
  if (explicit === "ai") return "ai";
  if (explicit === "heuristic") return "heuristic";
  return deepseekConfig().configured ? "ai" : "heuristic";
}

function cleanNote(value, max = 500) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function buildReviewMessages({ text, filename, creationType }) {
  return [
    {
      role: "system",
      content: [
        "你是剧本杀稿件导入前的质检助手，只审阅创作者上传的完整稿件文本。",
        "检查：结构是否可拆分（角色/分幕/线索/主持段）、是否有明显缺页或乱码、版权引流广告、与剧本杀无关的 spam。",
        "不要评价文学质量，不要改写正文。",
        "decision: pass | review_required | reject",
        "仅输出 JSON：",
        '{"decision":"pass|review_required|reject","reason":"内部简述","feedback":"给创作者的中文说明，reject/review_required 时必填"}'
      ].join("\n")
    },
    {
      role: "user",
      content: JSON.stringify({
        filename,
        creationType,
        excerpt: String(text ?? "").slice(0, 12000)
      })
    }
  ];
}

function normalizeVerdict(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const decision = String(value.decision || "").trim();
  if (!["pass", "review_required", "reject"].includes(decision)) {
    return { decision: "review_required", reason: "invalid_ai_verdict", feedback: "AI 质检返回异常，请人工复核后导入。" };
  }
  const feedback = cleanNote(value.feedback, 500);
  const reason = cleanNote(value.reason, 500);
  if (decision !== "pass" && !feedback) {
    return {
      decision,
      reason: reason || "policy_check",
      feedback: decision === "reject" ? "稿件未通过导入前质检，请修改后重试。" : "建议人工通读后再导入。"
    };
  }
  return { decision, reason, feedback };
}

function heuristicReview(text, creationType) {
  const prose = inspectPlayerProse(String(text ?? ""), { creationType });
  const reviewRequired = prose?.review?.required === true;
  return {
    mode: "heuristic",
    decision: reviewRequired ? "review_required" : "pass",
    reason: reviewRequired ? "prose_gate" : "heuristic_ok",
    feedback: reviewRequired
      ? prose?.review?.reason || "硬边界或叙事呼吸统计提示需要人工复核。"
      : "本地通读完成（未启用 AI 质检）。",
    proseDiagnostics: prose
  };
}

/**
 * @returns {Promise<{ mode: string, decision: string, reason: string, feedback: string, proseDiagnostics?: object }>}
 */
export async function reviewCreatorDocument({ text, filename, creationType = "murder_mystery" }) {
  const mode = resolveDocumentReviewMode();
  if (mode === "off") {
    return { mode: "off", decision: "pass", reason: "disabled", feedback: "" };
  }
  if (mode === "heuristic") {
    return heuristicReview(text, creationType);
  }
  try {
    const result = await requestDeepseekJson(buildReviewMessages({ text, filename, creationType }), {
      temperature: 0.1,
      timeoutMs: Math.min(deepseekConfig().timeoutMs, 45000)
    });
    const verdict = normalizeVerdict(result);
    return { mode: "ai", ...verdict };
  } catch (error) {
    return {
      mode: "ai_fallback",
      ...heuristicReview(text, creationType),
      reason: cleanNote(error?.message || "ai_error", 200)
    };
  }
}
