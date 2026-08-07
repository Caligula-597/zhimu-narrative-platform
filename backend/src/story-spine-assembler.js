import { throwErr } from "./api-errors.js";
import { requestDeepseekJson } from "./deepseek-client.js";
import {
  STORY_SPINE_CORE_SECTIONS,
  STORY_SPINE_PROMPT_VERSION,
  normalizeStorySpine,
  preserveConfirmedStorySpineSections,
} from "../../shared/story-spine.js";
import {
  formatMechanismDesignForPrompt,
  normalizeMechanismDesign,
} from "../../shared/mechanism-design.js";

const MAX_SOURCE_ENTRIES = 140;

function rows(value) {
  return Array.isArray(value) ? value : [];
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function text(value, maxLength = 3000) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

function compactText(parts = [], maxLength = 3000) {
  return rows(parts)
    .map((part) => text(part, maxLength))
    .filter(Boolean)
    .join("\n")
    .slice(0, maxLength);
}

function creatorInput(value = {}) {
  const source = record(value);
  return {
    logline: text(source.logline, 4000),
    sparks: rows(source.sparks)
      .slice(0, 30)
      .map((item) => ({
        tag: text(item?.tag, 80),
        text: text(item?.text, 800),
      }))
      .filter((item) => item.text),
    sellingPoints: rows(source.sellingPoints)
      .slice(0, 6)
      .map((item) => text(item, 800))
      .filter(Boolean),
    target: text(source.target, 600),
    duration: text(source.duration, 200),
    type: text(source.type, 400),
    focus: text(source.focus, 2000),
  };
}

function sourceEntry(key, type, label, body) {
  const normalizedBody = text(body, 5000);
  if (!key || !normalizedBody) return null;
  return { key, type, label: text(label, 200), text: normalizedBody };
}

function pushEntry(target, entry) {
  if (entry && target.length < MAX_SOURCE_ENTRIES) target.push(entry);
}

export function buildStorySpineSourceCatalog(snapshot = {}, inputValue = {}) {
  const input = creatorInput(inputValue);
  const world = record(snapshot.world);
  const settings = record(world.settings);
  const brief = record(settings.creatorBrief);
  const constitution = record(settings.creativeConstitution);
  const mechanismDesign = normalizeMechanismDesign(settings.mechanismDesign);
  const catalog = [];
  const roleNames = new Map(
    rows(snapshot.roles).map((role) => [String(role.id), text(role.name, 120)]),
  );

  pushEntry(
    catalog,
    sourceEntry(
      "world:summary",
      "world",
      "世界简介",
      input.logline || world.summary,
    ),
  );
  pushEntry(
    catalog,
    sourceEntry("world:name", "world", "作品名称", world.name),
  );
  pushEntry(
    catalog,
    sourceEntry(
      "brief:selling-points",
      "brief",
      "核心卖点",
      compactText(
        input.sellingPoints.length ? input.sellingPoints : brief.sellingPoints,
      ),
    ),
  );
  const target = input.target || brief.target || "";
  const duration = input.duration || brief.duration || "";
  const storyType = input.type || brief.type || "";
  pushEntry(
    catalog,
    sourceEntry(
      "brief:positioning",
      "brief",
      "创作定位",
      compactText([
        target ? `目标玩家：${target}` : "",
        duration ? `时长：${duration}` : "",
        storyType ? `类型：${storyType}` : "",
      ]),
    ),
  );
  pushEntry(
    catalog,
    sourceEntry(
      "brief:sparks",
      "brief",
      "灵感卡",
      compactText(
        (input.sparks.length ? input.sparks : rows(brief.sparks)).map(
          (item) => `${item.tag || "灵感"}：${item.text || ""}`,
        ),
        5000,
      ),
    ),
  );
  pushEntry(
    catalog,
    sourceEntry(
      "constitution:theme",
      "constitution",
      "核心主题",
      constitution.theme,
    ),
  );
  pushEntry(
    catalog,
    sourceEntry(
      "constitution:experience",
      "constitution",
      "体验承诺",
      constitution.experiencePromise,
    ),
  );
  pushEntry(
    catalog,
    sourceEntry(
      "constitution:principles",
      "constitution",
      "不可破坏原则",
      compactText(constitution.inviolablePrinciples || []),
    ),
  );
  pushEntry(
    catalog,
    sourceEntry(
      "constitution:debates",
      "constitution",
      "希望玩家争论什么",
      constitution.desiredDebates,
    ),
  );
  pushEntry(
    catalog,
    sourceEntry(
      "mechanism-design:author",
      "mechanism_design",
      mechanismDesign.status === "confirmed"
        ? "作者确认的机制设计"
        : "作者机制草稿",
      compactText(formatMechanismDesignForPrompt(mechanismDesign), 8000),
    ),
  );
  pushEntry(
    catalog,
    sourceEntry("author:focus", "author", "本次装配重点", input.focus),
  );

  for (const role of rows(snapshot.roles).slice(0, 12)) {
    pushEntry(
      catalog,
      sourceEntry(
        `role:${role.id}`,
        "role",
        `角色：${role.name || "未命名角色"}`,
        compactText(
          [
            role.name ? `角色名称：${role.name}` : "",
            role.public_profile,
            role.private_profile,
            role.description,
          ],
          4000,
        ),
      ),
    );
  }

  for (const archive of rows(snapshot.roleArchives).slice(0, 20)) {
    const roleId = archive.role_slot_id || archive.roleSlotId;
    pushEntry(
      catalog,
      sourceEntry(
        `role-archive:${archive.id || roleId}`,
        "role_archive",
        `角色档案：${roleNames.get(String(roleId)) || "未命名角色"}`,
        compactText(
          [
            archive.public_identity,
            archive.hidden_identity,
            archive.external_goal,
            archive.internal_need,
            archive.secret,
            archive.action_line,
            archive.inner_conflict,
          ],
          5000,
        ),
      ),
    );
  }

  for (const chapter of rows(snapshot.chapters).slice(0, 12)) {
    pushEntry(
      catalog,
      sourceEntry(
        `chapter:${chapter.id}`,
        "chapter",
        `章节 ${chapter.sequence || ""}：${chapter.title || "未命名"}`,
        compactText(
          [
            chapter.title ? `章节标题：${chapter.title}` : "",
            chapter.summary,
            chapter.description,
          ],
          5000,
        ),
      ),
    );
  }

  for (const claim of rows(snapshot.truthClaims).slice(0, 40)) {
    pushEntry(
      catalog,
      sourceEntry(
        `truth:${claim.id}`,
        "truth",
        `核心事实：${claim.title || "未命名"}`,
        compactText([claim.claim, claim.notes], 5000),
      ),
    );
  }

  const core = record(snapshot.coreTrick);
  pushEntry(
    catalog,
    sourceEntry(
      "core-trick:main",
      "truth",
      "核心谜底",
      compactText(
        [
          core.summary,
          core.method,
          core.motive,
          core.victim ? `受影响者：${core.victim}` : "",
        ],
        6000,
      ),
    ),
  );

  for (const relation of rows(snapshot.roleRelationships).slice(0, 50)) {
    const fromId = relation.from_role_slot_id || relation.fromRoleSlotId;
    const toId = relation.to_role_slot_id || relation.toRoleSlotId;
    pushEntry(
      catalog,
      sourceEntry(
        `relationship:${relation.id}`,
        "relationship",
        "人物关系",
        `${roleNames.get(String(fromId)) || fromId || "未知角色"} → ${roleNames.get(String(toId)) || toId || "未知角色"}：${relation.label || relation.description || "未说明"}`,
      ),
    );
  }

  for (const event of rows(snapshot.timelineEvents).slice(0, 40)) {
    pushEntry(
      catalog,
      sourceEntry(
        `timeline:${event.id}`,
        "timeline",
        `时间线：${event.time_label || event.timeLabel || event.sequence || ""}`,
        event.event_summary || event.eventSummary,
      ),
    );
  }

  for (const segment of rows(snapshot.segments).slice(0, 16)) {
    pushEntry(
      catalog,
      sourceEntry(
        `segment:${segment.id}`,
        "segment",
        `运行段落：${segment.title || segment.segment_key || "未命名"}`,
        compactText(
          [
            record(segment.story).summary,
            record(segment.story).goal,
            record(segment.operations).flow,
            record(segment.operations).hostTruth,
          ],
          5000,
        ),
      ),
    );
  }

  for (const clue of rows(snapshot.clues).slice(0, 50)) {
    pushEntry(
      catalog,
      sourceEntry(
        `clue:${clue.id}`,
        "clue",
        `线索：${clue.name || "未命名"}`,
        compactText(
          [clue.public_text, clue.publicText, clue.description],
          2500,
        ),
      ),
    );
  }

  return catalog;
}

function outputContract() {
  return {
    title: "作品名称",
    logline: { text: "一句话故事", sourceRefs: ["world:summary"] },
    overview: { text: "500至1500字连贯故事梗概", sourceRefs: [] },
    openingState: { text: "故事开始时的稳定状态", sourceRefs: [] },
    incitingIncident: { text: "打破状态的事件", sourceRefs: [] },
    centralConflict: { text: "无法同时满足的核心冲突", sourceRefs: [] },
    playerPremise: { text: "玩家为何必须亲自参与", sourceRefs: [] },
    mechanismLoop: {
      text: "玩家反复执行的具体行动、反馈与代价",
      sourceRefs: [],
    },
    truthAndReversal: { text: "真相及其如何重新解释前文", sourceRefs: [] },
    roleFunctions: [
      {
        roleId: "必须使用已有 role:* 中的 id；没有角色时可为空",
        roleName: "角色名",
        storyFunction: "角色对故事不可替代的作用",
        goal: "角色主动目标",
        pressure: "迫使其行动的压力",
        sourceRefs: [],
      },
    ],
    chapterArc: [
      {
        chapterId:
          "优先使用已有 chapter:* 中的 id；未建章节可用 draft-chapter-1",
        sequence: 1,
        title: "章节标题",
        cause: "本章由什么前置结果引起",
        playerAction: "玩家本章必须完成的世界内行动",
        turn: "行动造成的阶段转折",
        consequence: "不可逆后果及下一章读取内容",
        sourceRefs: [],
      },
    ],
    endingDirections: [
      {
        key: "ending-1",
        title: "结局方向",
        requirements: "由哪些早期选择与后期状态共同形成",
        consequence: "世界和角色承担的结果",
        sourceRefs: [],
      },
    ],
    unresolvedQuestions: [
      {
        key: "question-1",
        question: "仍需作者决定的问题",
        whyItMatters: "它影响故事的哪些部分",
        sourceRefs: [],
      },
    ],
    assumptions: [
      {
        key: "assumption-1",
        text: "为使故事暂时成立而提出、尚未获作者确认的假设",
        impact: "若改变会影响什么",
        sourceRefs: [],
      },
    ],
  };
}

export function buildStorySpineMessages(snapshot = {}, inputValue = {}) {
  const catalog = buildStorySpineSourceCatalog(snapshot, inputValue);
  const currentSpine = normalizeStorySpine(
    record(snapshot.world?.settings).storySpine,
  );
  return {
    catalog,
    messages: [
      {
        role: "system",
        content: `你是互动叙事的故事装配编辑。你的任务不是扩写完整剧本，而是把作者已经填写的分散材料装配成一份可概览、可继续生产的故事主干。\n\n硬规则：\n1. 只输出 JSON，不输出解释文字。\n2. sourceRefs 只能引用提供的来源 key；无法从来源支持的内容必须同时登记到 assumptions。\n3. 不把假设冒充作者事实，不新增未登记的正式角色。\n4. 玩家行动必须具体，不能只写“调查、讨论、寻找真相、作出选择”。\n5. chapterArc 必须是因果推进：上一章结果成为下一章条件。\n6. 结局必须读取至少两个不同阶段的选择，不得只靠最终投票。\n7. 已有故事主干中 status=author_confirmed 的核心区块属于锁定文本，必须逐字保留；若新材料与之冲突，只能加入 unresolvedQuestions。\n8. 如果素材不够，仍应先形成可读骨架，并明确列出 assumptions 与 unresolvedQuestions。`,
      },
      {
        role: "user",
        content: JSON.stringify({
          task: "组装当前故事主干候选版本",
          sources: catalog,
          currentStorySpine: currentSpine,
          outputContract: outputContract(),
        }),
      },
    ],
  };
}

function filterRefs(refs, allowed) {
  return rows(refs).filter(
    (ref) => allowed.has(ref) || String(ref).startsWith("assumption:"),
  );
}

function constrainSourceRefs(spineValue, catalog) {
  const spine = normalizeStorySpine(spineValue);
  const allowed = new Set(catalog.map((entry) => entry.key));
  for (const [key] of STORY_SPINE_CORE_SECTIONS) {
    spine[key].sourceRefs = filterRefs(spine[key].sourceRefs, allowed);
    if (spine[key].status !== "author_confirmed")
      spine[key].status = "ai_draft";
  }
  for (const collectionKey of [
    "roleFunctions",
    "chapterArc",
    "endingDirections",
  ]) {
    spine[collectionKey] = spine[collectionKey].map((item) => ({
      ...item,
      status: "ai_draft",
      sourceRefs: filterRefs(item.sourceRefs, allowed),
    }));
  }
  spine.unresolvedQuestions = spine.unresolvedQuestions.map((item) => ({
    ...item,
    sourceRefs: filterRefs(item.sourceRefs, allowed),
  }));
  spine.assumptions = spine.assumptions.map((item) => ({
    ...item,
    sourceRefs: filterRefs(item.sourceRefs, allowed),
  }));
  return spine;
}

function assertUsableStorySpine(spine, snapshot) {
  const requiredBlocks = [
    "logline",
    "overview",
    "centralConflict",
    "playerPremise",
  ];
  const missing = requiredBlocks.filter((key) => !spine[key]?.text);
  if (
    missing.length ||
    spine.chapterArc.length < 3 ||
    spine.endingDirections.length < 2
  ) {
    throwErr(
      "DEEPSEEK_RESPONSE_INVALID",
      "AI 没有返回完整的故事主干，请重试。",
      {
        missing,
        chapterCount: spine.chapterArc.length,
        endingCount: spine.endingDirections.length,
      },
    );
  }
  if (rows(snapshot.roles).length && !spine.roleFunctions.length) {
    throwErr(
      "DEEPSEEK_RESPONSE_INVALID",
      "AI 没有说明已有角色在整体故事中的作用，请重试。",
    );
  }
}

export async function assembleStorySpine(
  snapshot = {},
  inputValue = {},
  {
    requestJson = requestDeepseekJson,
    now = () => new Date().toISOString(),
    requestId = null,
  } = {},
) {
  const { catalog, messages } = buildStorySpineMessages(snapshot, inputValue);
  if (
    !catalog.some(
      (entry) => entry.type !== "world" || entry.key === "world:summary",
    )
  ) {
    throwErr(
      "BAD_REQUEST",
      "请先填写一句话梗概、灵感卡、角色或核心事实，再组装故事总览。",
    );
  }
  const result = await requestJson(messages, {
    maxTokens: 9000,
    temperature: 0.38,
    timeoutMs: 240_000,
    phase: "story-spine-assemble",
    context: { requestId, sourceCount: catalog.length },
    idempotencyKey: requestId ? `story-spine:${requestId}` : null,
  });
  const current = record(snapshot.world?.settings).storySpine;
  const constrained = constrainSourceRefs(result.value, catalog);
  const preserved = preserveConfirmedStorySpineSections(constrained, current);
  preserved.title ||= text(snapshot.world?.name, 200);
  preserved.provenance = {
    promptVersion: STORY_SPINE_PROMPT_VERSION,
    model: text(result.model, 160),
    generatedAt: now(),
    sourceRevision:
      snapshot.world?.content_revision == null
        ? null
        : Number(snapshot.world.content_revision),
  };
  assertUsableStorySpine(preserved, snapshot);
  return {
    storySpine: preserved,
    sourceSummary: {
      count: catalog.length,
      types: [...new Set(catalog.map((entry) => entry.type))],
    },
    model: result.model,
    usage: result.usage || null,
  };
}
