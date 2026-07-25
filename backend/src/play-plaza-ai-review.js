import { deepseekConfig, requestDeepseekJson } from "./deepseek.js";
import { scanPlaySocialContent } from "./play-content-moderation.js";

function resolvePlazaReviewMode() {
  const explicit = String(process.env.PLAY_PLAZA_AI_REVIEW || "").trim().toLowerCase();
  const production = (process.env.NODE_ENV ?? "development") === "production";
  if (production) {
    return deepseekConfig().configured && explicit !== "off" ? "ai" : "manual";
  }
  if (explicit === "off") return "off";
  if (explicit === "stub") return "stub";
  if (explicit === "ai") return "ai";
  return deepseekConfig().configured ? "ai" : "stub";
}

function cleanNote(value, max = 500) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

function buildReviewMessages({ body, kind }) {
  return [
    {
      role: "system",
      content: [
        "你是「织幕」玩家社区广场的内容审核助手，只审核非剧本类社交帖子（闲聊、招募队友）。",
        "剧本分幕/线索等游戏内文本不在你的职责范围内。",
        "请判断帖子是否可公开展示。",
        "必须拒绝：广告引流、外链、联系方式推销、色情低俗、赌博诈骗、违法违禁、人身攻击、无关 spam。",
        "应通过：正常约局、讨论剧本题材/时间、招募缺位、友好闲聊。",
        "不确定或边界模糊时，decision 用 human_review。",
        "仅输出 JSON：",
        '{"decision":"approve|reject|human_review","reason":"内部原因简述","feedback":"给用户的中文说明，reject 时必填且友好具体，其他情况可空字符串"}'
      ].join("\n")
    },
    {
      role: "user",
      content: JSON.stringify({ kind, body })
    }
  ];
}

function normalizeVerdict(raw) {
  const value = raw && typeof raw === "object" ? raw : {};
  const decision = String(value.decision || "").trim();
  if (!["approve", "reject", "human_review"].includes(decision)) {
    return { decision: "human_review", reason: "invalid_ai_verdict", feedback: "" };
  }
  const feedback = cleanNote(value.feedback, 500);
  const reason = cleanNote(value.reason, 500);
  if (decision === "reject" && !feedback) {
    return {
      decision: "reject",
      reason: reason || "policy_violation",
      feedback: "帖子未通过社区审核，请修改后重新发布。"
    };
  }
  return { decision, reason, feedback };
}

function stubReview(body) {
  const scan = scanPlaySocialContent(body);
  if (!scan.ok) {
    const feedback =
      scan.reason === "ad"
        ? "检测到广告或联系方式引流，请去掉推广内容后重试。"
        : "内容包含不适宜在广场发布的用语，请修改后重试。";
    return { decision: "reject", reason: scan.reason, feedback };
  }
  return { decision: "approve", reason: "stub_auto", feedback: "" };
}

/**
 * @returns {Promise<{ decision: 'approve'|'reject'|'human_review', reason: string, feedback: string }>}
 */
export async function reviewPlazaPostContent({ body, kind }) {
  const deterministicScan = scanPlaySocialContent(body);
  if (!deterministicScan.ok) {
    return {
      decision: "reject",
      reason: deterministicScan.reason,
      feedback: deterministicScan.reason === "ad"
        ? "禁止发布广告、外链、联系方式引流或推广信息。"
        : "内容包含社区违禁词，请修改后重试。"
    };
  }

  const mode = resolvePlazaReviewMode();
  if (mode === "manual") {
    return { decision: "human_review", reason: "manual_review_required", feedback: "" };
  }
  if (mode === "off") {
    return { decision: "approve", reason: "review_disabled", feedback: "" };
  }
  if (mode === "stub") {
    return stubReview(body);
  }

  try {
    const result = await requestDeepseekJson(buildReviewMessages({ body, kind }), {
      maxTokens: 700,
      temperature: 0.1,
      timeoutMs: Math.min(deepseekConfig().timeoutMs, 45000),
      phase: "plaza_post_review",
      context: { kind }
    });
    return normalizeVerdict(result.value);
  } catch {
    return { decision: "human_review", reason: "ai_unavailable", feedback: "" };
  }
}

export function resetPlazaAiReviewModeForTests() {
  delete process.env.PLAY_PLAZA_AI_REVIEW;
}
