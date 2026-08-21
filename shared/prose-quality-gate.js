/**
 * Deterministic player-script prose diagnostics shared by the editor and API.
 *
 * This is intentionally a high-precision gate, not a general "AI detector".
 * It catches authoring patterns that are structurally wrong for player-facing
 * scripts: the narrator explaining the character, thesis-shaped correction,
 * and task/design notes leaking into the prose.
 */
import {
  DEFAULT_ROLE_DOCUMENT_LIMITS,
  PLAYER_FACING_CONTRACT_VERSION,
} from "./player-facing-contract.js";
import { analyzeNarrativeRhythm } from "./narrative-rhythm.js";

export const PROSE_QUALITY_GATE_VERSION = "v1.8-observation-without-scoring";

const QUOTED_TEXT = /“[^”]*”|「[^」]*」|『[^』]*』|"[^"]*"|'[^']*'/gu;
const HEADING = /^(?:#{1,6}\s*|【[^】]{1,40}】\s*$|第[一二三四五六七八九十\d]+幕)/u;
const VISIBLE_ACTION = /(?:拿|放|推|拉|敲|关|打开|走|站|坐|蹲|抬|低头|转身|伸手|递|接|翻|按|擦|撕|签|写|倒|喝|盯|听|问|开口|喊|笑|哭|停下|退|进门|出门|靠|拍|摔|扔|捏|攥|松手|点头|摇头|掀|压在|塞进|抽出|拧开|关上)/u;
const INNER_EXPLANATION = /(?:觉得|以为|明白|知道|清楚|相信|认为|意识到|告诉自己|记得|忘了|希望|害怕|后悔|终于懂得)/u;
const EXPLANATION_TRANSITION = /(?:这意味着|这说明|这就是为什么|说到底|归根结底|真正的|其实你|你其实|原来如此)/gu;
const COMPRESSED_TRADE_EXPRESSION = /(?:换腕子|(?:断口|切口|皮边|纸边|木边)(?:毛|糙|硬|软|脆|湿|干|薄|厚|松|紧))(?=[，。！？!?]|$)/gu;

const RULES = [
  {
    code: "self_explaining_narrator",
    severity: "high",
    pattern: /(?:你|我)(?:一直|总是|反复)?(?:这样|这么)?告诉自己(?:说)?/u,
    message: "叙述者正在替角色解释和自我诊断。",
    action: "删除这句；若信息重要，改成角色当场做了什么、回避了什么，或让另一人逼问出来。",
    rewriteMode: "dramatize"
  },
  {
    code: "first_person_self_analysis",
    severity: "high",
    pattern: /(?:我之所以[^。！？\n]{1,42}(?:是因为|不过是因为)|我(?:会这样做|当时(?:会)?这么做)[^。！？\n]{0,42}(?:是因为|不过是因为)|我(?:知道|明白|清楚)(?:自己)?(?:为什么|为何)[^。！？\n]{0,42}|我(?:很)?清楚自己(?:真正)?(?:想要|害怕|在意)的(?:是)?)/u,
    message: "第一人称正在替作者分析自己的动机，不像角色当时会对自己说的话。",
    action: "删除事后归因；保留当时做出的动作、说出口的借口和未被解释的后果。",
    rewriteMode: "delete_or_dramatize"
  },
  {
    code: "corrective_thesis",
    severity: "high",
    pattern: /不是[^。！？\n]{1,28}[。！？]\s*(?:你|我)?(?:只|只是|不过|其实)/u,
    message: "段落用“否定一句、解释一句”的方式替人物下结论。",
    action: "删掉作者的纠正关系，只保留能被看见的行为、原话和后果。",
    rewriteMode: "delete_or_dramatize"
  },
  {
    code: "retrospective_revelation",
    severity: "high",
    pattern: /(?:直到|这一刻|那一刻).{0,36}(?:你才|你终于)(?:明白|意识到|懂得)|你终于明白/u,
    message: "旁白在替玩家完成理解，并把段落封成结论。",
    action: "停在触发理解的证据或反应上，不写角色已经替玩家想明白了什么。",
    rewriteMode: "delete"
  },
  {
    code: "task_wrapper",
    severity: "high",
    pattern: /(?:你的|本幕的?)任务(?:是|：)|你需要在本幕|请在本幕|本幕目标(?:是|：)|与其他玩家(?:完成|讨论|交换)/u,
    message: "任务说明被包装进了玩家正文。",
    action: "移到独立任务栏；正文只负责让玩家从关系和处境中产生行动理由。",
    rewriteMode: "move_to_design_doc"
  },
  {
    code: "analyst_brief",
    severity: "high",
    pattern: /对你而言.{0,24}(?:好处|优势|问题|代价|风险)|(?:好处|优势).{0,16}(?:是|在于).{0,90}(?:问题|代价|风险).{0,16}(?:是|在于)/u,
    message: "正文正在替玩家做利弊分析，读起来像策划案。",
    action: "把利弊拆成当场可选择的对象、别人提出的条件和选择后的损失。",
    rewriteMode: "dramatize"
  },
  {
    code: "strategy_menu_narration",
    severity: "high",
    pattern: /我可以[^\n]{1,180}(?:也可以|还可以)/u,
    message: "正文正在替玩家罗列可选策略，人物尚未行动，作者已经把玩法答案分析完。",
    action: "把选项、资源和结算条件移回独立机制字段；正文停在人物眼前的物件、损失和尚未落下的动作，让玩家自己决定。",
    rewriteMode: "move_to_mechanics_and_dramatize"
  },
  {
    code: "thesis_transition",
    severity: "medium",
    pattern: /(?:这意味着|这说明|这就是为什么|说到底|归根结底)/u,
    message: "作者用论证连接词直接解释了上一段。",
    action: "尝试整句删除；若剧情仍成立，就不要补回解释。",
    rewriteMode: "delete"
  },
  {
    code: "manufactured_epiphany",
    severity: "medium",
    pattern: /(?:原来|也许).{0,30}(?:从来|不是).{0,34}(?:而是|只是)|真正(?:的)?.{0,26}不是.{0,34}而是/u,
    message: "段落正在制造整齐的哲理反转。",
    action: "保留未解决的事实与冲突，不用一句对仗判断替它收口。",
    rewriteMode: "delete_or_dramatize"
  }
];

const PLAYER_SURFACE_RULES = [
  {
    code: "readaloud_instruction",
    severity: "high",
    pattern: /(?:公开朗读|公开陈述|请(?:你|玩家)?朗读|朗读以下内容)/u,
    message: "玩家正文出现公开朗读或公开陈述指令。",
  },
  {
    code: "player_instruction_block",
    severity: "high",
    pattern:
      /(?:行动建议|你的目标|你现在可以公开|你暂时最想隐瞒|你可以正式提交|你可以提交|你不能做的事|判断框架|最终提交|私人提交|本幕任务|玩家任务)/u,
    message: "玩家正文泄漏任务、公开/隐瞒清单或行动建议。",
  },
  {
    code: "knowledge_matrix_leak",
    severity: "high",
    pattern:
      /(?:\bmustHide\b|\bcanDiscuss\b|\bchapterKnowledge\b|\bknows\b|可公开的信息|必须隐瞒|暂时隐瞒|可讨论信息|知识矩阵)/iu,
    message: "玩家正文泄漏知识矩阵字段或其中文标签。",
  },
  {
    code: "internal_key_leak",
    severity: "high",
    pattern:
      /(?:\bE-\d{2,}\b|\bevidence-\d+\b|\bstate-\d+\b|\bresource-\d+\b|\brole-\d+\b|\bchapter-\d+\b)/iu,
    message: "玩家正文泄漏内部证据、状态、资源、角色或章节编号。",
  },
  {
    code: "prop_schema_leak",
    severity: "high",
    pattern: /(?:指定证据|证据编号|道具编号|原句\s*[：:].{0,80}(?:证据|编号))/u,
    message: "玩家正文泄漏道具制作字段或证据挂接记录。",
  },
  {
    code: "relationship_dossier",
    severity: "high",
    pattern:
      /^(?:#{1,6}\s*)?(?:你和其他玩家|你与其他角色|你和[\p{Script=Han}·]{2,16}的关系|与[\p{Script=Han}·]{2,16}(?:的关系)?)(?:\s*[：:]\s*)?$/u,
    message: "玩家正文出现关系档案式标题。关系必须由剧情呈现。",
  },
  {
    code: "relationship_verdict",
    severity: "high",
    pattern:
      /(?:你们(?:并)?不是[^。！？\n]{1,24}(?:，|,)?而是[^。！？\n]{1,32}|你们的关系(?:是|并非|不是)|你和[^。！？\n]{1,16}(?:属于|构成|是)(?:一种|一段)?[^。！？\n]{0,16}关系)/u,
    message: "玩家正文出现作者替关系下结论的句子。",
  },
  {
    code: "relationship_meta_summary",
    severity: "high",
    pattern:
      /你(?:从未|没有|并未|一直没有|从来没有)回避过自己和[^。！？\n]{1,20}的关系/u,
    message: "玩家正文用作者摘要说明角色是否回避一段关系，没有产生可经历的剧情。",
  },
  {
    code: "undefined_abstract_afterglow",
    severity: "high",
    pattern:
      /(?:知道|看见|记得|认得)[^。！？\n]{1,36}(?:，|,)?也(?:知道|看见|记得|认得)[^。！？\n]{0,36}(?:不愿说出的(?:那一部分|东西|话)|没有说出口的(?:那一部分|东西|话)|无人愿意提起的(?:名字|事情)|某种说不清的东西)/u,
    message: "玩家正文用前实后虚的对称句制造没有指称对象的抽象余韵。",
  },
  {
    code: "player_strategy_directive",
    severity: "high",
    pattern:
      /(?:如果|若)[^。！？\n]{0,56}你可以(?:强调|要求|先查|暂时不|不必|质疑|主张|指出|承认|否认|提交|拒绝|选择)/u,
    message: "玩家正文替玩家安排发言、调查、隐瞒或判断策略。",
  },
  {
    code: "host_process_leak",
    severity: "high",
    pattern:
      /(?:(?:告诉|交给|询问|通知)主持人|由主持人(?:发放|宣读|判断|宣布)|进入第[一二三四五六七八九十\d]+幕后(?:再)?阅读|听从主持人指令|不得阅读其他角色本)/u,
    message: "玩家正文泄漏主持流程或阅读控制指令。",
  },
];

const EXACT_MINUTE = /(?:[零〇一二三四五六七八九十两百\d]{1,4})(?:点|时)[零〇一二三四五六七八九十两\d]{1,3}分|(?:[01]?\d|2[0-3])[:：][0-5]\d/gu;
const CARETAKING_SILENCE_TEMPLATE = /(?:发烧|高烧|病床|住院|输液|醉(?:了|酒)|受伤)[\s\S]{0,160}(?:问|提起|追问)[\s\S]{0,120}(?:拉高被子|掖(?:好)?被角|替[^。！？\n]{0,20}盖好|递(?:水|药)|把被子)[\s\S]{0,80}(?:没有回答|没有开口|沉默|不作声)/u;

const TASK_ADVICE_RULES = [
  /(?:如果|若)[^。！？\n]{0,64}你可以/u,
  /(?:你可以|你应该|建议你|优先|先查|先问|暂时不要|适时|尽量|主动)(?:强调|要求|调查|询问|公开|隐瞒|承认|否认|质疑|指认|提交|说服|误导|撒谎|洗脱|掩盖|发言|沉默)/u,
  /(?:不要让|别让)[^。！？\n]{0,32}(?:知道|发现|看见|怀疑)/u,
  /(?:把|将)[^。！？\n]{0,24}(?:责任|嫌疑)(?:推给|引向)/u,
];

function exactMinuteMentions(text) {
  return [...String(text || "").matchAll(new RegExp(EXACT_MINUTE.source, "gu"))].filter((match) => {
    const tail = String(text || "").slice(Number(match.index || 0) + match[0].length, Number(match.index || 0) + match[0].length + 4);
    if (!/^(?:前后|左右|上下)/u.test(tail)) return true;
    const minuteText = match[0].match(/(?:点|时)([^分]+)分/u)?.[1] || "";
    const roundedChineseMinute = /^(?:十|二十|三十|四十|五十)$/u.test(minuteText);
    const roundedNumericMinute = /^(?:00|10|20|30|40|50)$/u.test(minuteText);
    return !(roundedChineseMinute || roundedNumericMinute);
  });
}

function normalizeText(value) {
  return String(value || "").replace(/\r\n?/g, "\n").trim();
}

function maskDialogue(value) {
  return String(value || "").replace(QUOTED_TEXT, (match) => " ".repeat(match.length));
}

function compactExcerpt(value, max = 96) {
  const flat = String(value || "").replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
}

function splitParagraphs(text) {
  return normalizeText(text)
    .split(/\n+/u)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value, index) => ({ index: index + 1, value }));
}

function dialogueRatio(text) {
  const raw = String(text || "");
  if (!raw.length) return 0;
  let quotedChars = 0;
  for (const match of raw.matchAll(new RegExp(QUOTED_TEXT.source, "gu"))) quotedChars += match[0].length;
  return quotedChars / raw.length;
}

function compressedTradeExpressions(paragraphs) {
  const hits = [];
  for (const paragraph of paragraphs) {
    const narration = maskDialogue(paragraph.value);
    for (const match of narration.matchAll(new RegExp(COMPRESSED_TRADE_EXPRESSION.source, "gu"))) {
      hits.push({
        paragraph: paragraph.index,
        excerpt: paragraph.value,
        expression: match[0]
      });
    }
  }
  return hits;
}

function dialogueCount(value) {
  return [...String(value || "").matchAll(new RegExp(QUOTED_TEXT.source, "gu"))].length;
}

function matrixSerializationParagraphs(paragraphs) {
  const moneyFields = /(?:退休金|房贷|工资|收入|开销|金额|存款|银行卡|卡里|账户|余额|现金|药费|水电|首款|月供|万元|千元|每月)/gu;
  const contractFields = /(?:名字|签名|签字|合同|条款|担保|期限|退出|空置|漏水|承担|支出|扣除|扣回|执行|产权|分配|许可|授权)/gu;
  const conditionalFrames = /(?:只要|如果|要是|否则|不然|才会|就把|就得|必须|不得|不等于|哪一项|哪一条|念全|念漏|以后剩|之前先)/gu;
  const hits = [];
  for (const paragraph of paragraphs) {
    if (dialogueCount(paragraph.value) > 0) continue;
    const narration = maskDialogue(paragraph.value);
    if (narration.length < 70) continue;
    const moneyCount = (narration.match(moneyFields) || []).length;
    const contractCount = (narration.match(contractFields) || []).length;
    const conditionCount = (narration.match(conditionalFrames) || []).length;
    const clauseCount = narration.split(/[，；。！？!?]/u).map((item) => item.trim()).filter(Boolean).length;
    if (moneyCount < 2 || contractCount < 3 || conditionCount < 2 || clauseCount < 4) continue;
    hits.push({
      paragraph: paragraph.index,
      excerpt: paragraph.value,
      moneyCount,
      contractCount,
      conditionCount,
      clauseCount
    });
  }
  return hits;
}

function narrativePovMarkers(text) {
  const narration = maskDialogue(text);
  const first = [...narration.matchAll(/(?:^|[，。！？；：、\s])我(?=们|自己|的|在|没|不|要|会|能|把|将|曾|正|又|却|也|只|先|想|看|听|说|问|答|点|抬|低|伸|转|走|站|坐|蹲|回|盯|记|知道|清楚|觉得|以为|需要|必须|决定|打开|按|拿|从|向|对|被|让|还|已经|依然|仍)/gu)];
  const second = [...narration.matchAll(/(?:^|[，。！？；：、\s])你(?=们|自己|的|在|没|不|要|会|能|把|将|曾|正|又|却|也|只|先|想|看|听|说|问|答|点|抬|低|伸|转|走|站|坐|蹲|回|盯|记|知道|清楚|觉得|以为|需要|必须|决定|打开|按|拿|从|向|对|被|让|还|已经|依然|仍)/gu)];
  return { first, second };
}

function addIssue(issues, issue) {
  const key = `${issue.code}:${issue.paragraph || 0}`;
  if (issues.some((entry) => `${entry.code}:${entry.paragraph || 0}` === key)) return;
  issues.push(issue);
}

/** Diagnose one player-facing prose body. */
export function diagnosePlayerScript(
  body,
  { expectedPov = "", maxExactMinuteMentions = 2 } = {}
) {
  const text = normalizeText(body);
  const paragraphs = splitParagraphs(text);
  const proseParagraphs = paragraphs.filter((paragraph) => !HEADING.test(paragraph.value));
  const issues = [];
  let sceneEvidenceParagraphs = 0;
  let explanatoryParagraphs = 0;
  let explanationTransitions = 0;

  // Surface-boundary rules deliberately inspect headings and list items too.
  // Those areas were previously excluded as formatting, which let authoring
  // metadata and player instructions bypass the prose-only diagnostics.
  for (const paragraph of paragraphs) {
    const narration = maskDialogue(paragraph.value);
    for (const rule of PLAYER_SURFACE_RULES) {
      const match = narration.match(rule.pattern);
      if (!match) continue;
      addIssue(issues, {
        code: rule.code,
        category: "player_surface_boundary",
        severity: rule.severity,
        paragraph: paragraph.index,
        excerpt: compactExcerpt(paragraph.value),
        evidence: compactExcerpt(match[0], 72),
        message: rule.message,
        action: "从玩家正文移除该结构；把事实还原为角色亲历场景，或移入主持人手册、任务载体、道具文件。",
        rewriteMode: "separate_authoring_layers"
      });
    }
  }

  const exactMinuteHits = exactMinuteMentions(text);
  if (exactMinuteHits.length > maxExactMinuteMentions) {
    addIssue(issues, {
      code: "minute_grid_narration",
      category: "player_time_memory",
      severity: "high",
      paragraph: 0,
      excerpt: "",
      evidence: `本节出现 ${exactMinuteHits.length} 处精确分钟：${exactMinuteHits.slice(0, 5).map((item) => item[0]).join("、")}`,
      message: "人物叙事正在复述后台分钟表，超出自然记忆所需的关键时间锚点。",
      action: "只保留角色有理由记住的关键分钟；其他时刻改为带感知依据的前后范围或事件顺序。",
      rewriteMode: "restore_human_time_memory"
    });
  }

  const caretakingSilence = text.match(CARETAKING_SILENCE_TEMPLATE);
  if (caretakingSilence) {
    addIssue(issues, {
      code: "caregiving_silence_template",
      category: "player_prose",
      severity: "high",
      paragraph: 0,
      excerpt: compactExcerpt(caretakingSilence[0]),
      evidence: "脆弱状态＋追问＋照顾动作＋沉默不答",
      message: "正文使用大模型高频的克制文学套件代替具体冲突。",
      action: "让人物明确回答、撒谎、转移、争吵或承担关系后果；照顾动作不能自动充当潜台词。",
      rewriteMode: "rebuild_relationship_consequence"
    });
  }

  for (const paragraph of proseParagraphs) {
    const narration = maskDialogue(paragraph.value);
    const hasDialogue = narration !== paragraph.value;
    const hasVisibleAction = VISIBLE_ACTION.test(narration);
    const hasInnerExplanation = INNER_EXPLANATION.test(narration);
    const transitionCount = (narration.match(EXPLANATION_TRANSITION) || []).length;
    explanationTransitions += transitionCount;
    if (hasDialogue || hasVisibleAction) sceneEvidenceParagraphs += 1;
    if (hasInnerExplanation && !hasDialogue && !hasVisibleAction) explanatoryParagraphs += 1;

    for (const rule of RULES) {
      const match = narration.match(rule.pattern);
      if (!match) continue;
      addIssue(issues, {
        code: rule.code,
        category: "player_prose",
        severity: rule.severity,
        paragraph: paragraph.index,
        excerpt: compactExcerpt(paragraph.value),
        evidence: compactExcerpt(match[0], 72),
        message: rule.message,
        action: rule.action,
        rewriteMode: rule.rewriteMode
      });
    }
  }

  for (const hit of compressedTradeExpressions(proseParagraphs)) {
    addIssue(issues, {
      code: "compressed_trade_expression",
      category: "player_prose",
      severity: "high",
      paragraph: hit.paragraph,
      excerpt: compactExcerpt(hit.excerpt),
      evidence: hit.expression,
      message: "叙述为了显得利落或有行当感，使用了缺少自然谓语或没有语境支撑的压缩词。",
      action: "改回角色会自然说出的完整动作；专业词若未在输入材料登记，删除或在第一次实际操作中让含义自行显现。",
      rewriteMode: "rewrite_for_reader_language"
    });
  }

  for (const hit of matrixSerializationParagraphs(proseParagraphs)) {
    addIssue(issues, {
      code: "matrix_serialization",
      category: "player_prose",
      severity: "high",
      paragraph: hit.paragraph,
      excerpt: compactExcerpt(hit.excerpt),
      evidence: `单段同时出现 ${hit.moneyCount} 个钱款字段、${hit.contractCount} 个合同字段与 ${hit.conditionCount} 个条件句式`,
      message: "正文正在把信息矩阵压成第一人称说明，一段内连续交付事实、边界、条件和结算后果。",
      action: "保留事实但废弃原段：先建立人物正在向谁索取或拒绝什么的场景，只让一部分信息从对话、误解和动作中露出；其余信息留给物料或后续场景。",
      rewriteMode: "rebuild_from_scene"
    });
  }

  const povMarkers = narrativePovMarkers(text);
  const wrongPovMarkers = expectedPov === "first"
    ? povMarkers.second
    : expectedPov === "second"
      ? povMarkers.first
      : [];
  const inferredMixedPov = !expectedPov && povMarkers.first.length >= 2 && povMarkers.second.length >= 2;
  if (wrongPovMarkers.length || inferredMixedPov) {
    const firstWrong = wrongPovMarkers[0] || (povMarkers.first[0]?.index > povMarkers.second[0]?.index ? povMarkers.first[0] : povMarkers.second[0]);
    addIssue(issues, {
      code: "mixed_narrative_pov",
      category: "player_prose",
      severity: "high",
      paragraph: 0,
      excerpt: compactExcerpt(text.slice(Math.max(0, Number(firstWrong?.index || 0) - 28), Number(firstWrong?.index || 0) + 72)),
      evidence: expectedPov
        ? `设定为${expectedPov === "first" ? "第一" : "第二"}人称，但引号外出现 ${wrongPovMarkers.length} 处另一人称叙述`
        : `引号外同时出现 ${povMarkers.first.length} 处第一人称与 ${povMarkers.second.length} 处第二人称叙述`,
      message: "玩家正文的人称合同被打断，角色正在“我”和“你”之间切换。",
      action: "先选定整部角色本的唯一人称，再统一改写引号外的叙述、回忆、心理和场景过渡；不要只替换代词，要同步调整句法。",
      rewriteMode: "rewrite_pov"
    });
  }

  const paragraphCount = proseParagraphs.length;
  const sceneEvidenceRatio = paragraphCount ? sceneEvidenceParagraphs / paragraphCount : 0;
  const explanatoryRatio = paragraphCount ? explanatoryParagraphs / paragraphCount : 0;
  const spokenRatio = dialogueRatio(text);
  if (
    text.length >= 400 &&
    explanatoryParagraphs >= 3 &&
    explanatoryRatio >= 0.28 &&
    sceneEvidenceRatio < 0.3 &&
    spokenRatio < 0.04
  ) {
    addIssue(issues, {
      code: "exposition_density",
      category: "player_prose",
      severity: "high",
      paragraph: 0,
      excerpt: "",
      evidence: `解释段 ${explanatoryParagraphs}/${paragraphCount}，场景证据 ${sceneEvidenceParagraphs}/${paragraphCount}`,
      message: "正文大面积停留在旁白解释，缺少当场行为、互动和可误读证据。",
      action: "不要逐句润色；退回场景层，明确谁在何处向谁索取什么，以及拒绝后立刻失去什么。",
      rewriteMode: "upstream_rebuild"
    });
  }

  const highCount = issues.filter((issue) => issue.severity === "high").length;
  const mediumCount = issues.filter((issue) => issue.severity === "medium").length;
  const lowCount = issues.filter((issue) => issue.severity === "low").length;
  const rhythm = analyzeNarrativeRhythm(text);
  return {
    version: PROSE_QUALITY_GATE_VERSION,
    playerFacingContractVersion: PLAYER_FACING_CONTRACT_VERSION,
    passed: highCount === 0,
    blocked: highCount > 0,
    summary: { high: highCount, medium: mediumCount, low: lowCount, total: issues.length },
    metrics: {
      chars: text.length,
      paragraphCount,
      sceneEvidenceParagraphs,
      sceneEvidenceRatio: Number(sceneEvidenceRatio.toFixed(3)),
      explanatoryParagraphs,
      explanatoryRatio: Number(explanatoryRatio.toFixed(3)),
      dialogueRatio: Number(spokenRatio.toFixed(3)),
      explanationTransitions,
      expectedPov: expectedPov || null,
      firstPersonNarrationMarkers: povMarkers.first.length,
      secondPersonNarrationMarkers: povMarkers.second.length,
      compressedTradeExpressions: compressedTradeExpressions(proseParagraphs).length,
      exactMinuteMentions: exactMinuteHits.length
    },
    rhythm,
    issues: issues.slice(0, 20)
  };
}

/**
 * Diagnose a complete player role document instead of a single prose cell.
 * Public body and act bodies remain prose-only; task cards and props are not
 * accepted as fields here by design.
 */
export function diagnosePlayerFacingRoleDocument(
  roleDocument,
  {
    expectedPov = "",
    minimumPublicChars = DEFAULT_ROLE_DOCUMENT_LIMITS.minimumPublicChars,
    minimumActChars = DEFAULT_ROLE_DOCUMENT_LIMITS.minimumActChars,
    maxExactMinuteMentions = 2
  } = {}
) {
  const publicBody = normalizeText(roleDocument?.publicBody);
  const acts = Array.isArray(roleDocument?.acts)
    ? roleDocument.acts
    : Object.values(roleDocument?.acts || {});
  const sections = [
    { key: "public", body: publicBody, minimumChars: minimumPublicChars },
    ...acts.map((act, index) => ({
      key: String(act?.key || `act-${index + 1}`),
      body: normalizeText(act?.body ?? act),
      minimumChars: minimumActChars
    }))
  ];
  const structuralIssues = [];
  const diagnostics = [];

  for (const section of sections) {
    if (section.body.length < section.minimumChars) {
      structuralIssues.push({
        code: section.key === "public" ? "public_body_too_short" : "act_body_too_short",
        category: "player_document_structure",
        severity: "high",
        section: section.key,
        evidence: `${section.body.length}/${section.minimumChars} 字`,
        message: section.key === "public"
          ? "公共开篇不足以建立人物生活、现场关系和当夜处境。"
          : "分幕正文不足以承载完整场景与人物变化。"
      });
    }
    if (section.body) {
      diagnostics.push({
        section: section.key,
        ...diagnosePlayerScript(section.body, { expectedPov, maxExactMinuteMentions })
      });
    }
  }

  const surfaceIssues = diagnostics.flatMap((diagnostic) =>
    diagnostic.issues.map((issue) => ({ section: diagnostic.section, ...issue }))
  );
  const issues = [...structuralIssues, ...surfaceIssues];
  return {
    version: PROSE_QUALITY_GATE_VERSION,
    playerFacingContractVersion: PLAYER_FACING_CONTRACT_VERSION,
    passed: structuralIssues.length === 0 && diagnostics.every((item) => item.passed),
    blocked: structuralIssues.length > 0 || diagnostics.some((item) => item.blocked),
    sections: diagnostics,
    issues
  };
}

/** Diagnose one independently distributed stage-task card. */
export function diagnosePlayerTaskCard(body) {
  const text = normalizeText(body);
  const issues = [];
  const objectiveLines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/u.test(line))
    .map((line) => line.replace(/^[-*]\s+/u, "").trim());

  if (!objectiveLines.length || objectiveLines.length > 4) {
    issues.push({
      code: "task_scope_invalid",
      category: "player_task_card",
      severity: "high",
      evidence: `${objectiveLines.length} 条任务`,
      message: "每张分幕任务卡需要一至四条可结束的阶段结果。"
    });
  }

  for (const [index, objective] of objectiveLines.entries()) {
    const advice = TASK_ADVICE_RULES.find((pattern) => pattern.test(objective));
    if (advice) {
      issues.push({
        code: "task_strategy_leak",
        category: "player_task_card",
        severity: "high",
        paragraph: index + 1,
        excerpt: compactExcerpt(objective),
        evidence: compactExcerpt(objective.match(advice)?.[0] || objective),
        message: "任务卡正在替玩家安排话术、调查顺序、隐瞒或误导策略。"
      });
    }
    if (/(?:可公开|暂时隐瞒|必须隐瞒|知识矩阵|指定证据|证据编号)/u.test(objective)) {
      issues.push({
        code: "task_matrix_leak",
        category: "player_task_card",
        severity: "high",
        paragraph: index + 1,
        excerpt: compactExcerpt(objective),
        message: "任务卡复制了知识矩阵或制作字段。"
      });
    }
  }

  return {
    version: PROSE_QUALITY_GATE_VERSION,
    playerFacingContractVersion: PLAYER_FACING_CONTRACT_VERSION,
    passed: issues.length === 0,
    blocked: issues.length > 0,
    objectiveCount: objectiveLines.length,
    issues
  };
}

/** Diagnose role × act task cards without mixing them into role prose. */
export function diagnoseTaskCardCollection(taskCards) {
  const cards = [];
  for (const [roleKey, acts] of Object.entries(taskCards || {})) {
    for (const [actKey, body] of Object.entries(acts || {})) {
      const diagnostics = diagnosePlayerTaskCard(body?.body ?? body);
      cards.push({ roleKey, actKey, ...diagnostics });
    }
  }
  return {
    version: PROSE_QUALITY_GATE_VERSION,
    passed: cards.length > 0 && cards.every((card) => card.passed),
    blocked: !cards.length || cards.some((card) => card.blocked),
    cards,
    issues: cards.flatMap((card) => card.issues.map((issue) => ({
      roleKey: card.roleKey,
      actKey: card.actKey,
      ...issue
    })))
  };
}

/** Diagnose every role × act script cell. */
export function diagnoseScriptCollection(scripts, { expectedPov = "" } = {}) {
  const cells = [];
  for (const [roleKey, acts] of Object.entries(scripts || {})) {
    for (const [actKey, script] of Object.entries(acts || {})) {
      if (!script?.body?.trim()) continue;
      const diagnostics = diagnosePlayerScript(script.body, { expectedPov });
      cells.push({ cell: `${roleKey}_${actKey}`, roleKey, actKey, ...diagnostics });
    }
  }
  const blockedCells = cells.filter((cell) => cell.blocked);
  const issues = cells.flatMap((cell) =>
    cell.issues.map((issue) => ({ cell: cell.cell, roleKey: cell.roleKey, actKey: cell.actKey, ...issue }))
  );
  return {
    version: PROSE_QUALITY_GATE_VERSION,
    passed: blockedCells.length === 0,
    blocked: blockedCells.length > 0,
    skipped: cells.length === 0,
    summary: {
      totalCells: cells.length,
      blockedCells: blockedCells.length,
      high: issues.filter((issue) => issue.severity === "high").length,
      medium: issues.filter((issue) => issue.severity === "medium").length,
      low: issues.filter((issue) => issue.severity === "low").length
    },
    cells,
    issues: issues.slice(0, 80)
  };
}

/** Stable, non-cryptographic content fingerprint used to detect stale reviews. */
export function fingerprintScriptCollection(scripts) {
  const canonical = [];
  for (const roleKey of Object.keys(scripts || {}).sort()) {
    for (const actKey of Object.keys(scripts?.[roleKey] || {}).sort()) {
      canonical.push(`${roleKey}\u001f${actKey}\u001f${normalizeText(scripts[roleKey][actKey]?.body)}`);
    }
  }
  const text = canonical.join("\u001e");
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}-${text.length}`;
}

/**
 * Deterministic inspection for uploaded player-facing prose.
 *
 * There is intentionally no score, quality label, authorship probability, or
 * automatic literary verdict. Hard boundary leaks and rhythm distributions are
 * presented as separate evidence for a human editor.
 */
export function inspectPlayerProse(text, { sections = [], creationType = "murder_mystery" } = {}) {
  const whole = diagnosePlayerScript(text);
  const sectionReports = (sections || [])
    .filter((section) => section?.body?.trim())
    .map((section, index) => ({
      index: index + 1,
      title: String(section.title || `分段 ${index + 1}`).slice(0, 120),
      diagnostics: diagnosePlayerScript(section.body)
    }));
  const locatedIssues = sectionReports.flatMap((section) =>
    section.diagnostics.issues.map((issue) => ({
      sectionIndex: section.index,
      sectionTitle: section.title,
      ...issue
    }))
  );
  const rhythm = whole.rhythm || analyzeNarrativeRhythm(text);
  const requiresReview = whole.blocked || rhythm.observations.length > 0;
  return {
    version: PROSE_QUALITY_GATE_VERSION,
    method: "deterministic_evidence_only",
    creationType,
    summary: {
      chars: whole.metrics.chars,
      sections: sectionReports.length,
      hardBoundaryIssues: whole.summary.high,
      reviewNotes: whole.summary.medium + whole.summary.low,
      rhythmObservations: rhythm.observations.length,
    },
    review: {
      required: requiresReview,
      decision: requiresReview ? "manual_review" : "no_anomaly_observed",
      reason: whole.blocked
        ? "命中玩家文本硬边界，须由作者检查原文；系统不提供文学分数或自动改写。"
        : rhythm.observations.length
          ? `叙事呼吸检测记录了 ${rhythm.observations.length} 组统计异常，交由作者判断是否符合本场需要。`
          : "未发现已登记的硬边界或统计异常；这不等于对文学质量作出通过判断。"
    },
    issues: (locatedIssues.length ? locatedIssues : whole.issues).slice(0, 30),
    rhythm,
    disclaimer: "本报告未调用 AI 评审，不计算总分，不判断作者身份，也不替作者决定文本好坏；它只展示可定位的硬边界问题和统计分布。"
  };
}
