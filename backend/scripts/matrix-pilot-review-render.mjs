/** Human-readable exports for matrix pilot review (tasks, god-view truth, host). */

export function actTitle(infoMatrix, config, actKey) {
  return infoMatrix?.actTitles?.[actKey] || config?.chapterKeys?.indexOf(actKey) + 1
    ? `第 ${config.chapterKeys.indexOf(actKey) + 1} 幕`
    : actKey;
}

export function roleActTasks(characterArchives, roleKey, actKey) {
  const role = characterArchives?.roles?.find((r) => r.key === roleKey);
  const block = role?.actTasks?.find((t) => t.actKey === actKey);
  return { role, block };
}

export function matrixRow(infoMatrix, roleKey, actKey) {
  return infoMatrix?.rows?.find((r) => r.roleKey === roleKey && r.actKey === actKey);
}

export function formatScriptMarkdown(script, { actLabel }) {
  const lines = [`# ${script.title || actLabel}`, "", script.body || "_（空）_", ""];

  if (script.closingHook) {
    lines.push(script.closingHook, "");
  }

  const tasks = script.tasks?.length ? script.tasks : [];
  lines.push("## 本幕任务", "");
  if (tasks.length) {
    tasks.forEach((t) => lines.push(`- ${t}`));
  } else {
    lines.push("_（未生成，请补 `layers/06-scripts` 中对应 JSON 的 tasks 字段）_");
  }

  const wc = (script.body || "").length;
  lines.push("", "---", `_字数：${wc}（demo 档目标 ≥400，standard ≥600）_`, "");
  return lines.join("\n");
}

export function formatTruthGodView({ setting, synopsis, truthBible, config, infoMatrix }) {
  const tb = truthBible || {};
  const lines = [
    "# 上帝视角 · 真相总览",
    "",
    "> 主持 / 作者审核用。对应 JSON：`layers/02-truth-bible.json`",
    "",
    "## 一句话",
    "",
    synopsis?.body || setting?.theme || "",
    "",
    "## 案件全貌（summary）",
    "",
    tb.summary || "_（空）_",
    "",
    "## 核心要素",
    "",
    `| 项 | 内容 |`,
    `|---|---|`,
    `| 死者 | ${tb.victim || "—"} |`,
    `| 凶手 | ${tb.killer || "—"} |`,
    `| 手法 | ${tb.method || "—"} |`,
    `| 动机 | ${tb.motive || "—"} |`,
    ""
  ];

  if (tb.timeline?.length) {
    lines.push("## 时间线（真实发生顺序）", "");
    tb.timeline.forEach((t) => {
      lines.push(`- **${t.time || t.id}** ${t.event}${t.participants?.length ? `（${t.participants.join("、")}）` : ""}`);
    });
    lines.push("");
  }

  if (tb.misdirections?.length) {
    lines.push("## 三层误导", "");
    tb.misdirections.forEach((m) => {
      lines.push(`### 第 ${m.layer} 层：${m.surface}`, "", `- 表象：${m.misleading}`, `- 收束：${m.resolution}`, "");
    });
  }

  if (tb.spoilerGates?.length) {
    lines.push("## 分幕剧透门禁", "");
    tb.spoilerGates.forEach((g) => {
      const title = actTitle(infoMatrix, config, g.actKey);
      lines.push(`### ${title}（${g.actKey}）`, "");
      (g.forbiddenFacts || []).forEach((f) => lines.push(`- 禁止提前说：${f}`));
      lines.push("");
    });
  }

  if (tb.hostNotes) {
    lines.push("## 主持全局备注", "", tb.hostNotes, "");
  }

  if (synopsis?.truthSketch) {
    lines.push("## 立项时的真相概要（作者输入）", "", synopsis.truthSketch, "");
  }

  return lines.join("\n");
}

export function formatHostRunbookMarkdown(hostRunbooks, infoMatrix, config) {
  const lines = [
    "# 主持手册 · 分幕流程",
    "",
    "> 对应 JSON：`layers/05-host-runbooks.json`。每幕含主持才知道的真相片段。",
    ""
  ];
  for (const book of hostRunbooks || []) {
    const title = book.title || actTitle(infoMatrix, config, book.actKey);
    lines.push(`## ${title}（${book.actKey}）`, "");
    if (book.hostTruth) {
      lines.push("### 本幕上帝视角（hostTruth）", "", book.hostTruth, "");
    }
    if (book.flow) {
      lines.push("### 流程", "", book.flow, "");
    }
    if (book.clueGrants?.length) {
      lines.push("### 线索发放", "");
      book.clueGrants.forEach((g) => lines.push(`- \`${g.clueId}\`：${g.when}`));
      lines.push("");
    }
    if (book.fallbacks?.length) {
      lines.push("### 冷场兜底", "");
      book.fallbacks.forEach((f) => lines.push(`- ${f}`));
      lines.push("");
    }
  }
  return lines.join("\n");
}

export function formatTasksOverview({ characterArchives, infoMatrix, scripts, config }) {
  const lines = [
    "# 全员 · 分幕任务一览",
    "",
    "> 汇总自角色档案 `actTasks`、信息矩阵 `rows.tasks`、剧本 `scripts.tasks`。",
    ""
  ];
  const actKeys = config?.chapterKeys || [];
  for (const actKey of actKeys) {
    const actLabel = actTitle(infoMatrix, config, actKey);
    lines.push(`## ${actLabel}（${actKey}）`, "");
    for (const role of characterArchives?.roles || []) {
      const { block } = roleActTasks(characterArchives, role.key, actKey);
      const row = matrixRow(infoMatrix, role.key, actKey);
      const script = scripts?.[role.key]?.[actKey];
      const tasks = [...new Set([
        ...(script?.tasks || []),
        ...(block?.tasks || []),
        ...(row?.tasks || [])
      ])];
      lines.push(`### ${role.name}`, "");
      if (tasks.length) tasks.forEach((t) => lines.push(`- ${t}`));
      else lines.push("_无任务_");
      if (block?.tips) lines.push("", `_提示：${block.tips}_`);
      lines.push("");
    }
  }
  return lines.join("\n");
}

export function formatRoleContinuityMarkdown(roleName, scripts, config, infoMatrix) {
  const keys = config?.chapterKeys || [];
  const lines = [
    `# ${roleName} · 全幕连贯本`,
    "",
    "> demo 短篇连续阅读版：按 ch1→ch2→ch3 串联，便于审阅代入感。",
    ""
  ];
  for (const actKey of keys) {
    const script = scripts?.[actKey];
    if (!script?.body) continue;
    const label = actTitle(infoMatrix, config, actKey);
    lines.push(`---`, "", `## ${label} · ${script.title || actKey}`, "", script.body, "");
    if (script.closingHook) lines.push(`*${script.closingHook}*`, "");
    if (script.tasks?.length) {
      lines.push("**本幕任务**", "");
      script.tasks.forEach((t) => lines.push(`- ${t}`));
      lines.push("");
    }
  }
  const total = keys.reduce((n, k) => n + (scripts?.[k]?.body?.length || 0), 0);
  lines.push("---", `_全幕合计 ${total} 字_`, "");
  return lines.join("\n");
}

export function renderHumanReviewFiles(payload, writeText) {
  const { setting, synopsis, config, truthBible, characterArchives, infoMatrix, hostRunbooks, scripts } = payload;

  writeText("truth/TRUTH-god-view.md", formatTruthGodView({ setting, synopsis, truthBible, config, infoMatrix }));
  writeText("truth/HOST-runbook.md", formatHostRunbookMarkdown(hostRunbooks, infoMatrix, config));
  writeText("tasks/TASKS-all-roles.md", formatTasksOverview({ characterArchives, infoMatrix, scripts, config }));

  for (const [roleKey, acts] of Object.entries(scripts || {})) {
    const name = characterArchives?.roles?.find((r) => r.key === roleKey)?.name || roleKey;
    writeText(
      `scripts-by-role/${name}-连贯本.md`,
      formatRoleContinuityMarkdown(name, acts, config, infoMatrix)
    );
    for (const [actKey, script] of Object.entries(acts || {})) {
      const md = formatScriptMarkdown(script, {
        actLabel: actTitle(infoMatrix, config, actKey)
      });
      writeText(`scripts/${name}_${actKey}.md`, md);
    }
  }
}
