/**
 * Generate Formation grading workbook from registry inventory JSON.
 *   node scripts/gen-story-mechanism-formation-workbook.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inventoryPath = path.join(root, "captures/story-mechanism-inventory-for-grading.json");
const outPath = path.join(root, "docs/STORY_MECHANISM_FORMATIONATION_GRADING_WORKBOOK_ZH.md");

function mdEsc(s) {
  return String(s || "")
    .replace(/\|/g, "\\|")
    .replace(/\r?\n/g, " ");
}

const data = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
const complete = data.rows
  .filter((r) => r.maturity === "COMPLETE")
  .sort((a, b) => a.id.localeCompare(b.id));
const foundation = data.rows
  .filter((r) => r.maturity !== "COMPLETE")
  .sort((a, b) => a.id.localeCompare(b.id));

const out = [];
out.push("# STORY 机制标注工作簿（Formation 等级 · 人工填）");
out.push("");
out.push("> 用途：你统一标注 Formation / Resolution 等级；**先标注、再考虑改代码**。");
out.push("> 生成自 registry 快照：`captures/story-mechanism-inventory-for-grading.json`");
out.push("> 配套骨架：`docs/STORY_MECHANISM_FORMATIONATION_GAP_ZH.md`");
out.push("> **本文件不改机制；只供阅读与打分。**");
out.push("");
out.push("## 怎么标");
out.push("");
out.push("| 字段 | 含义 |");
out.push("|---|---|");
out.push("| `Formation` | 玩家如何自己走到结算桌（存在/知情/锁定/杠杆/触发） |");
out.push("| `Resolution` | 形成后怎么推进/结算（阶段、换手、开放、阵营结算等） |");
out.push("| 等级建议 | `OK` / `THIN` / `GAP_HIGH` / `N_A`（本层不负责 Formation） |");
out.push("| `notes` | 你的一句话理由 |");
out.push("");
out.push(
  "Formation 8 问（交换类；其它族做同构映射）：valueSource / existenceSource / knowledgePath / locatorPath / counterpartLeverage / leverageProvenance / counterpartNeed / trigger",
);
out.push("");
out.push("---");
out.push("");
out.push("## 0. 材料包索引（文档 + 关键代码）");
out.push("");
out.push("### 必读文档");
out.push("");
out.push("| 文件 | 内容 |");
out.push("|---|---|");
out.push("| `docs/STORY_MECHANISM_FORMATIONATION_GAP_ZH.md` | Formation vs Resolution 骨架 |");
out.push("| `shared/STORY_MECHANISM_PRODUCTION.md` | STORY 生产原则（冻结） |");
out.push("| `shared/M07_CONTENT_COVERAGE.md` | M07×8 设计矩阵 |");
out.push("| `shared/M08_CONTENT_COVERAGE.md` | M08×8 设计矩阵 |");
out.push("| `docs/P10_3_STORY_EXPERIENCE_COVERAGE_ZH.md` | M12-1 为何出现 |");
out.push("| `docs/追凶机制生产架构_工作流协议版_V1.3.md` | 追凶参照（Formation 相对完整的传统） |");
out.push("| `docs/创作者机制设计与多审查工作台-V1.md` | 工作台产品面 |");
out.push("| `docs/机制运行包与主持端联动实施基线-V1.md` | runtime 包（偏 GAME/主持） |");
out.push("");
out.push("### 关键代码（STORY 合同本体）");
out.push("");
out.push("| 文件 | 内容 |");
out.push("|---|---|");
out.push("| `shared/story-mechanism-contracts.js` | Block / ProjectStoryState |");
out.push("| `shared/story-mechanism-registry.js` | Registry |");
out.push("| `shared/story-mechanism-templates-data.js` | 组装 + FOUNDATION 种子 + M01-FRAMING |");
out.push("| `shared/story-mechanism-m01-framing-data.js` | 追凶变体/plot 候选 |");
out.push("| `shared/story-mechanism-m01-framing.js` | 兼容导出 |");
out.push("| `shared/story-mechanism-m07-pack.js` | M07-1…8 COMPLETE |");
out.push("| `shared/story-mechanism-m08-pack.js` | M08-1…8 COMPLETE |");
out.push("| `shared/story-mechanism-m12-pack.js` | M12-1 COMPLETE |");
out.push("| `shared/complete-beat-semantics-data.js` | COMPLETE BeatSemantics |");
out.push("| `shared/story-experience-profiles-data.js` | ExperienceProfile |");
out.push("| `shared/creation-catalog-metadata.js` | Planner 用家族元数据 |");
out.push("| `shared/story-mechanism-engine.js` | 通用生成引擎 |");
out.push("| `mechanism-catalog-v2.ts` | 全库 MechanismRole 映射（含 GAME） |");
out.push("");
out.push("### 机器快照");
out.push("");
out.push("- `captures/story-mechanism-inventory-for-grading.json` — 全部 STORY template 的 stages/roles/plots/clues/profile");
out.push("");
out.push("### 明确先不标 / 另册");
out.push("");
out.push("- **GAME**（M02–M06、M09）：`shared/mechanism-templates.js` / `mechanism-catalog*.ts` — 幕内玩法，不是本册 Formation 主战场");
out.push("- Writer / Projection / Rendering：P10.4–P10.5，不在本标注范围");
out.push("");
out.push("---");
out.push("");
out.push("## 1. COMPLETE 总表（先标这里）");
out.push("");
out.push("| ID | 名称 | Formation | Resolution | notes |");
out.push("|---|---|---|---|---|");
for (const r of complete) {
  out.push(`| ${r.id} | ${mdEsc(r.title)} |  |  |  |`);
}
out.push("");
out.push("---");
out.push("");
out.push("## 2. COMPLETE 逐条合同摘要（供对照）");
out.push("");

for (const r of complete) {
  out.push(`### ${r.id} · ${r.title}`);
  out.push("");
  out.push(`- **purpose：** ${mdEsc(r.purpose)}`);
  out.push(`- **stages：** ${r.stages || "（无）"}`);
  out.push(`- **owners：** ${r.owners.join(", ") || "—"}`);
  out.push(`- **phases：** ${r.phases.join(", ") || "—"}`);
  if (r.profile?.status) {
    out.push(
      `- **profile：** ${r.profile.status}` +
        ` · commitments=${(r.profile.commitments || []).join(",")}` +
        ` · modes=${(r.profile.modes || []).join(",")}` +
        ` · anchors=${(r.profile.anchors || []).join(",")}` +
        ` · pressure=${r.profile.resolutionPressure || ""}`,
    );
  }
  out.push("- **roles：**");
  for (const role of r.roles) {
    out.push(
      `  - \`${role.slot}${role.required ? "*" : ""}\` ${role.label} → ${role.narrativeRole}`,
    );
  }
  out.push("- **plotSlots：**");
  for (const p of r.plots) {
    const pre =
      (p.presets || []).length > 0
        ? ` · presets: ${(p.presets || []).map(mdEsc).join(" / ")}`
        : "";
    out.push(`  - \`${p.slot}\` ${mdEsc(p.label)}${pre}`);
  }
  if (r.clues?.length) {
    out.push("- **clues：**");
    for (const c of r.clues) {
      out.push(
        `  - \`${c.id}\` (${c.type}@${c.stageHint}) ${mdEsc(c.purpose)}`,
      );
    }
  }
  out.push("");
  out.push(
    "**你的标注：** Formation=`____` · Resolution=`____` · notes=`____________________`",
  );
  out.push("");
  out.push("---");
  out.push("");
}

out.push("## 3. FOUNDATION 总表（种子壳 · 可粗标）");
out.push("");
out.push("| ID | 名称 | purpose（截断） | Formation | Resolution | notes |");
out.push("|---|---|---|---|---|---|");
for (const r of foundation) {
  out.push(
    `| ${r.id} | ${mdEsc(r.title)} | ${mdEsc(r.purpose).slice(0, 60)} |  |  |  |`,
  );
}
out.push("");
out.push("---");
out.push("");
out.push("## 4. 你填完后回传约定");
out.push("");
out.push("直接改本文件空格即可；或另存 `docs/STORY_MECHANISM_FORMATIONATION_GRADES_ZH.md`。");
out.push("标注完成前：**不改 pack / semantics / Writer。**");
out.push("");

fs.writeFileSync(outPath, `${out.join("\n")}\n`, "utf8");
console.log(
  JSON.stringify({
    outPath,
    complete: complete.length,
    foundation: foundation.length,
    total: data.rows.length,
  }),
);
