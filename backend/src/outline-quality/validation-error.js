/** Convert accumulated quality issues into the public validation error contract. */

import { throwErr } from "../api-errors.js";

import { OUTLINE_REVISION, OUTLINE_VERSION } from "./constants.js";

import { unique } from "./primitives.js";

export function invalid(issues, outlineRevision = OUTLINE_REVISION) {
  const uniqueIssues = unique(issues);
  const rebuildPattern = /高概念|hookPromises.*payoff|centralResponsibilityRoleKeys|核心责任|genreMechanic|题材机制|证据派生循环|独立来源|伪双源|provenanceGroup|角色贡献|贡献失衡|因果路径|聚光章|misdirections.*题材|泛化行动|模板化|不可达|剧情指纹|batchFingerprint|批次.*同构/iu;
  const repairMode = uniqueIssues.some((issue) => rebuildPattern.test(issue)) ? "rebuild" : "patch";
  throwErr(
    "DEEPSEEK_OUTPUT_INVALID",
    `AI 大纲未通过可扩写质量门禁（${uniqueIssues.length} 项）`,
    {
      outlineVersion: OUTLINE_VERSION,
      outlineRevision,
      repairMode: outlineRevision === "2.4" ? "regenerate-current-stage" : repairMode,
      generationAcceptanceMode: outlineRevision === "2.4"
        ? "reject-and-regenerate-current-stage-from-scratch"
        : "reject-and-restart-full-draft",
      issues: uniqueIssues
    }
  );
}
