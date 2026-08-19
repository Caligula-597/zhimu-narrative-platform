/** Deterministic corpus features. Detector, not a pass/fail grade. */

export const CORPUS_GATE_FEATURE_VERSION = "v1-empirical-detector";

const QUOTED = /“[^”]*”|「[^」]*」|『[^』]*』|"[^"]*"/gu;
const COGNITION = /你(?:立刻)?(?:意识到|明白了|想起|终于懂)|这说明|这显然不是巧合/gu;
const EXACT_CLOCK = /(?:[0-2]?\d[：:点]\d{2}|[一二三四五六七八九十两]{1,3}点(?:[一二三四五六七八九十两]{1,3}分)?)/gu;
const TIME_WORD = /今天|今晚|昨天|前天|刚才|随后|后来|凌晨|夜里|下午|中午/gu;
const TASK = /本幕|你的任务|你可以隐瞒|手边可以直接使用|工作动作/gu;
const PENDING = /还没(?:来得及)?(?:看|拆|问|处理)|那张纸一直/gu;
const SCENE_SUMMARY = /事情开始复杂|整个.{0,6}都不太平|麻烦越来越多|七点以前最乱/gu;
const HIDEABLE = /没有(?:告诉|说)|可以不提|没有写进|没有主动/gu;
const RESOURCE = /钱|尾款|订金|合同|钥匙|签字|权限|版面|校样|底片|收据/gu;
const INVESTIGATE = /查清|找出|问出|核实|对质/gu;
const WORK_PROCESS = /排版|开机|改版|锁版|印刷|校对|签发|采访|放大/gu;
const STOP_NAMES = new Set([
  "自己", "他们", "她们", "我们", "什么", "一个", "没有", "可以", "已经", "因为",
  "所以", "如果", "还是", "这个", "那个", "不是", "只是", "然后", "不过", "但是",
  "后来", "现在", "知道", "觉得", "告诉", "看见", "回来", "出去", "今天", "今晚"
]);

export const FEATURE_SPECS = [
  { key: "single_sentence_paragraph_ratio", label: "单句自然段占比", format: "pct" },
  { key: "short_paragraph_ratio", label: "短段占比", format: "pct" },
  { key: "dialogue_char_ratio", label: "对白字占比", format: "pct" },
  { key: "max_consecutive_dialogue_turns", label: "最长连续对白轮数", format: "num" },
  { key: "consecutive_qa_handoffs_per_10k", label: "连续成功问答链 / 万字", format: "per10k" },
  { key: "quoted_new_token_ratio", label: "对白含专名占比（启发式）", format: "pct" },
  { key: "cognition_verb_per_10k", label: "认知动词 / 万字", format: "per10k" },
  { key: "exact_clock_per_10k", label: "精确钟点 / 万字", format: "per10k" },
  { key: "time_word_per_10k", label: "时间词 / 万字", format: "per10k" },
  { key: "task_instruction_ratio", label: "任务/规则字占比", format: "pct" },
  { key: "ending_ngram_overlap", label: "幕末与前文信息重复率", format: "pct" },
  { key: "top_entity_centrality", label: "最大实体信息中心度", format: "pct" },
  { key: "top_entity_window10", label: "Top实体在10节点窗内最高次数", format: "num" },
  { key: "solitude_span_ratio", label: "叙述篇幅占比", format: "pct" },
  { key: "pending_item_per_10k", label: "未完成事项提醒 / 万字", format: "per10k" },
  { key: "scene_summary_per_10k", label: "场景总结句 / 万字", format: "per10k" },
  { key: "hideable_marker_per_10k", label: "隐瞒标记 / 万字", format: "per10k" },
  { key: "resource_marker_per_10k", label: "运行资源标记 / 万字", format: "per10k" },
  { key: "investigate_task_per_10k", label: "查清/找出类任务 / 万字", format: "per10k" },
  { key: "work_process_per_10k", label: "职业过程词 / 万字", format: "per10k" },
  { key: "mean_paragraph_chars", label: "平均段长", format: "num" },
  { key: "mean_sentence_chars", label: "平均句长", format: "num" },
  { key: "question_per_10k", label: "问号密度 / 万字", format: "per10k" },
  { key: "playable_object_per_10k", label: "可交换物提及 / 万字", format: "per10k" }
];

function compact(value) {
  return String(value || "").replace(/\s+/gu, "");
}

function paragraphs(text) {
  return String(text || "")
    .replace(/\r\n?/g, "\n")
    .split(/\n+/u)
    .map((row) => row.trim())
    .filter(Boolean);
}

function sentences(value) {
  return String(value || "")
    .split(/[。！？!?]/u)
    .map((row) => row.trim())
    .filter(Boolean);
}

function count(re, text) {
  const copy = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
  return [...String(text || "").matchAll(copy)].length;
}

function per10k(n, chars) {
  return chars ? (n / chars) * 10000 : 0;
}

function quotedSpans(text) {
  return [...String(text || "").matchAll(new RegExp(QUOTED.source, "gu"))].map((row) => row[0]);
}

function isDialogue(paragraph) {
  const body = compact(paragraph);
  if (!body) return false;
  const quoted = quotedSpans(paragraph).join("");
  return compact(quoted).length / body.length >= 0.45 || /^(?:[“「]|[^。]{0,8}(?:说|问|答)[：:])/u.test(paragraph);
}

function candidateNames(text) {
  const freq = new Map();
  for (const match of String(text || "").matchAll(/[\u4e00-\u9fff]{2,3}/gu)) {
    const token = match[0];
    if (STOP_NAMES.has(token) || /[的了着过很还也就都把被]/.test(token)) continue;
    freq.set(token, (freq.get(token) || 0) + 1);
  }
  return [...freq.entries()].filter(([, n]) => n >= 4).sort((a, b) => b[1] - a[1]);
}

function consecutiveQa(paragraphsList) {
  let streak = 0;
  let maxStreak = 0;
  let chains = 0;
  const seen = new Set();
  for (let i = 0; i < paragraphsList.length - 1; i += 1) {
    const now = paragraphsList[i];
    const next = paragraphsList[i + 1];
    const question = /[？?]|问/.test(now);
    const answerQuoted = quotedSpans(next).join("");
    if (!question || !answerQuoted) {
      streak = 0;
      continue;
    }
    const fresh = [...answerQuoted.matchAll(/[\u4e00-\u9fff]{2,3}/gu)]
      .map((row) => row[0])
      .some((token) => !seen.has(token) && !now.includes(token));
    for (const token of `${now}${next}`.matchAll(/[\u4e00-\u9fff]{2,3}/gu)) seen.add(token[0]);
    if (!fresh) {
      streak = 0;
      continue;
    }
    streak += 1;
    chains += 1;
    if (streak > maxStreak) maxStreak = streak;
  }
  return { chains, maxStreak };
}

function endingOverlap(text) {
  const paras = paragraphs(text).map((row) => compact(row)).filter((row) => row.length >= 12);
  if (paras.length < 20) return 0;
  const cut = Math.floor(paras.length * 0.9);
  const head = new Set(paras.slice(0, cut));
  const tail = paras.slice(cut);
  return tail.length ? tail.filter((row) => head.has(row)).length / tail.length : 0;
}

function windowMentions(paragraphsList, name) {
  const nodes = paragraphsList.filter((row) => isDialogue(row) || /说|问|告诉|提到/.test(row));
  let max = 0;
  for (let i = 0; i < nodes.length; i += 1) {
    const slice = nodes.slice(i, i + 10).join("\n");
    const n = slice.split(name).length - 1;
    if (n > max) max = n;
  }
  return max;
}

export function extractHeuristicLabels(text) {
  const source = String(text || "");
  const rules = [
    ["cognition", COGNITION],
    ["exact_clock", EXACT_CLOCK],
    ["task_instruction", TASK],
    ["pending_item", PENDING],
    ["scene_summary", SCENE_SUMMARY],
    ["question_answer", /[？?].{0,40}[“「]/gu]
  ];
  const labels = [];
  for (const [label, re] of rules) {
    const copy = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
    for (const match of source.matchAll(copy)) {
      const index = match.index || 0;
      labels.push({
        span: [Math.max(0, index - 24), Math.min(source.length, index + match[0].length + 24)],
        excerpt: source.slice(Math.max(0, index - 24), Math.min(source.length, index + match[0].length + 24)),
        labels: [label]
      });
    }
  }
  return labels.slice(0, 80);
}

export function extractCorpusFeatures(text) {
  const source = String(text || "");
  const chars = compact(source).length;
  const paras = paragraphs(source);
  const dialogueParas = paras.filter(isDialogue);
  const quotedChars = compact(quotedSpans(source).join("")).length;
  const sentLens = paras.flatMap((row) => sentences(row).map((item) => compact(item).length));
  const singleSentence = paras.filter((row) => sentences(row).length <= 1);
  const shortParas = paras.filter((row) => compact(row).length <= 24);
  const qa = consecutiveQa(paras);
  const names = candidateNames(source);
  const top = names[0] || ["", 0];
  const nameTotal = names.reduce((sum, [, n]) => sum + n, 0);
  let maxDialogueRun = 0;
  let run = 0;
  for (const row of paras) {
    if (isDialogue(row)) {
      run += 1;
      if (run > maxDialogueRun) maxDialogueRun = run;
    } else run = 0;
  }
  const narrationChars = paras.filter((row) => !isDialogue(row)).reduce((sum, row) => sum + compact(row).length, 0);
  const quotedWithNew = quotedSpans(source).filter((span) => /[\u4e00-\u9fff]{2,3}/u.test(span)).length;
  const playable = count(/照片|校样|合同|底片|投诉|收据|钥匙|寻人|版面|广告|铜钱|佩剑|信件|名册|药瓶|令牌|印章|账本|车票/gu, source);

  const values = {
    chars,
    paragraphs: paras.length,
    single_sentence_paragraph_ratio: paras.length ? singleSentence.length / paras.length : 0,
    short_paragraph_ratio: paras.length ? shortParas.length / paras.length : 0,
    dialogue_char_ratio: chars ? quotedChars / chars : 0,
    max_consecutive_dialogue_turns: maxDialogueRun,
    consecutive_qa_handoffs_per_10k: per10k(qa.chains, chars),
    quoted_new_token_ratio: quotedSpans(source).length ? quotedWithNew / quotedSpans(source).length : 0,
    cognition_verb_per_10k: per10k(count(COGNITION, source), chars),
    exact_clock_per_10k: per10k(count(EXACT_CLOCK, source), chars),
    time_word_per_10k: per10k(count(TIME_WORD, source), chars),
    task_instruction_ratio: chars ? compact(source.match(new RegExp(TASK.source, "gu"))?.join("") || "").length / chars : 0,
    ending_ngram_overlap: endingOverlap(source),
    top_entity_centrality: nameTotal ? top[1] / nameTotal : 0,
    top_entity_window10: top[0] ? windowMentions(paras, top[0]) : 0,
    solitude_span_ratio: chars ? narrationChars / chars : 0,
    pending_item_per_10k: per10k(count(PENDING, source), chars),
    scene_summary_per_10k: per10k(count(SCENE_SUMMARY, source), chars),
    hideable_marker_per_10k: per10k(count(HIDEABLE, source), chars),
    resource_marker_per_10k: per10k(count(RESOURCE, source), chars),
    investigate_task_per_10k: per10k(count(INVESTIGATE, source), chars),
    work_process_per_10k: per10k(count(WORK_PROCESS, source), chars),
    mean_paragraph_chars: paras.length ? chars / paras.length : 0,
    mean_sentence_chars: sentLens.length ? sentLens.reduce((a, b) => a + b, 0) / sentLens.length : 0,
    question_per_10k: per10k(count(/[？?]/gu, source), chars),
    playable_object_per_10k: per10k(playable, chars),
    top_entity: top[0] || "",
    qa_max_streak: qa.maxStreak
  };
  return {
    version: CORPUS_GATE_FEATURE_VERSION,
    values,
    labels: extractHeuristicLabels(source)
  };
}

export function peerInterval(rows, key) {
  const numbers = rows.map((row) => Number(row.values?.[key])).filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!numbers.length) return null;
  const at = (p) => numbers[Math.min(numbers.length - 1, Math.max(0, Math.floor((numbers.length - 1) * p)))];
  return { min: numbers[0], max: numbers[numbers.length - 1], p10: at(0.1), p90: at(0.9), n: numbers.length };
}

export function statusAgainstPeer(value, interval) {
  if (!interval || !Number.isFinite(value)) return "unknown";
  if (value >= interval.p10 && value <= interval.p90) return "in_range";
  const span = Math.max(interval.p90 - interval.p10, Math.abs(interval.p90) * 0.2, 0.0001);
  const dist = value < interval.p10 ? interval.p10 - value : value - interval.p90;
  return dist > span ? "extreme" : "high";
}

export function formatFeature(spec, value) {
  if (!Number.isFinite(value)) return "—";
  if (spec.format === "pct") return `${Math.round(value * 1000) / 10}%`;
  if (spec.format === "per10k") return String(Math.round(value * 10) / 10);
  return String(Math.round(value * 10) / 10);
}

export function renderCorpusDashboard({ works, peerGroup = "role_book" }) {
  const groupNames = [...new Set(works.map((work) => work.peerGroup || peerGroup))];
  const lines = [
    "# 真实剧本校准门禁（检测仪）",
    "",
    "这不是评分表。区间只在同一玩法组内比较：机制本不跟情感本、推理本混成一个平均数。",
    "",
    `特征版本：${CORPUS_GATE_FEATURE_VERSION}`,
    "",
    "## 覆盖",
    "",
    "| 作品 | 同行组 | 字数 | 来源 | 缓存命中 | 待识别 |",
    "|---|---|---:|---|---:|---:|"
  ];
  for (const work of works) {
    lines.push(`| ${work.title} | ${work.peerGroup || ""} | ${work.features?.values?.chars || 0} | ${work.methods?.join("、") || ""} | ${work.cacheHits || 0} | ${work.pending || 0} |`);
  }
  for (const group of groupNames) {
    const peers = works.filter((work) => (work.peerGroup || peerGroup) === group && work.features);
    lines.push("", `## ${group}（n=${peers.length}）`, "");
    if (!peers.length) {
      lines.push("这一组还没有可统计文本。", "");
      continue;
    }
    lines.push("| 检测项 | 组内常见区间 | " + peers.map((work) => work.title).join(" | ") + " |");
    lines.push("|---|---|" + peers.map(() => "---").join("|") + "|");
    for (const spec of FEATURE_SPECS) {
      const interval = peerInterval(peers.map((work) => work.features), spec.key);
      const range = interval ? `${formatFeature(spec, interval.p10)}–${formatFeature(spec, interval.p90)}` : "—";
      const cells = peers.map((work) => {
        const value = work.features.values[spec.key];
        if (peers.length < 3) return formatFeature(spec, value);
        const status = statusAgainstPeer(value, interval);
        const mark = status === "extreme" ? "🔴" : status === "high" ? "🟠" : status === "in_range" ? "🟢" : "⚪";
        return `${mark} ${formatFeature(spec, value)}`;
      });
      lines.push(`| ${spec.label} | ${range} | ${cells.join(" | ")} |`);
    }
    if (peers.length < 3) lines.push("", "样本不足 3 部，只列出数值，不标红。");
  }
  lines.push(
    "",
    "## 怎么读",
    "",
    "- 先看覆盖：扫描件没识别完时，数字只代表已缓存页。",
    "- 组内比较才有意义。机制本对白少、推理本问答链高，都可能是类型差，不是 AI 病。",
    "- 大量真人样本都踩中的旧规则，降级成提示，不要当硬门禁。",
    ""
  );
  return lines.join("\n");
}
