/**
 * Deterministic player-script prose diagnostics shared by the editor and API.
 *
 * This is intentionally a high-precision gate, not a general "AI detector".
 * It catches authoring patterns that are structurally wrong for player-facing
 * scripts: the narrator explaining the character, thesis-shaped correction,
 * and task/design notes leaking into the prose.
 */
export const PROSE_QUALITY_GATE_VERSION = "v1.6-transition-contract";
export const UPLOAD_PROSE_REVIEW_THRESHOLD = 65;

const QUOTED_TEXT = /“[^”]*”|「[^」]*」|『[^』]*』|"[^"]*"|'[^']*'/gu;
const HEADING = /^(?:#{1,6}\s*|【[^】]{1,40}】\s*$|第[一二三四五六七八九十\d]+幕)/u;
const VISIBLE_ACTION = /(?:拿|放|推|拉|敲|关|打开|走|站|坐|蹲|抬|低头|转身|伸手|递|接|翻|按|擦|撕|签|写|倒|喝|盯|听|问|开口|喊|笑|哭|停下|退|进门|出门|靠|拍|摔|扔|捏|攥|松手|点头|摇头|掀|压在|塞进|抽出|拧开|关上)/u;
const INNER_EXPLANATION = /(?:觉得|以为|明白|知道|清楚|相信|认为|意识到|告诉自己|记得|忘了|希望|害怕|后悔|终于懂得)/u;
const EXPLANATION_TRANSITION = /(?:这意味着|这说明|这就是为什么|说到底|归根结底|真正的|其实你|你其实|原来如此)/gu;
const COMPRESSED_TRADE_EXPRESSION = /(?:换腕子|(?:断口|切口|皮边|纸边|木边)(?:毛|糙|硬|软|脆|湿|干|薄|厚|松|紧))(?=[，。！？!?]|$)/gu;
const NATURAL_TRANSITION = /(?:后来|不过|但是|可是|可我|可他|可她|可这|所以|因此|于是|等到|等我|等他|等她|偏偏|接着|随后|再后来|当时|这时|这才|原先|本来|起先|结果|反倒|另一边|没过多久|(?:以后|之前|之后)[，。]|却(?:没|不|又|还是|已经|先|把|被|在|只)|才(?:发现|看见|知道|想起|听见|注意到))/gu;

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

function shortSentenceChain(paragraphs) {
  let run = [];
  for (const paragraph of paragraphs) {
    // Speaker attributions around real dialogue are often short by necessity.
    // Treat a dialogue paragraph as a rhythm boundary instead of masking the
    // quote and accidentally diagnosing “我问 / 他答 / 她转身” as fake prose.
    if (dialogueCount(paragraph.value) > 0) {
      run = [];
      continue;
    }
    const units = paragraph.value
      .split(/[。！？!?]+/u)
      .map((value) => value.replace(/[，、；：,.\s]/gu, "").trim())
      .filter(Boolean)
      .map((value) => ({ paragraph: paragraph.index, value }));
    for (const unit of units) {
      if (unit.value.length <= 11) {
        run.push(unit);
        if (run.length >= 3) return run.slice(-3);
      } else {
        run = [];
      }
    }
  }
  return [];
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

function templateParagraphCadence(paragraphs) {
  const content = paragraphs
    .map((paragraph) => ({
      paragraph: paragraph.index,
      length: paragraph.value.replace(/\s+/gu, "").length,
      sentences: paragraph.value.split(/[。！？!?]+/u).map((item) => item.trim()).filter(Boolean).length
    }))
    .filter((item) => item.length >= 35 && item.length <= 130);
  if (content.length < 6) return null;
  const mean = content.reduce((sum, item) => sum + item.length, 0) / content.length;
  const deviation = Math.sqrt(content.reduce((sum, item) => sum + (item.length - mean) ** 2, 0) / content.length);
  const coefficient = mean ? deviation / mean : 1;
  const moldedCount = content.filter((item) => item.sentences >= 2 && item.sentences <= 5).length;
  const moldedRatio = moldedCount / content.length;
  if (coefficient > 0.17 || moldedRatio < 0.83) return null;
  return {
    paragraph: content[0].paragraph,
    contentParagraphs: content.length,
    coefficient: Number(coefficient.toFixed(3)),
    moldedRatio: Number(moldedRatio.toFixed(3)),
    lengths: content.map((item) => item.length)
  };
}

function naturalTransitionCount(text) {
  return [...maskDialogue(text).matchAll(new RegExp(NATURAL_TRANSITION.source, "gu"))].length;
}

function isolatedDialogueText(value) {
  const match = String(value || "").trim().match(/^(?:“([^”]*)”|「([^」]*)」|『([^』]*)』|"([^"]*)")$/u);
  return match ? String(match[1] ?? match[2] ?? match[3] ?? match[4] ?? "").trim() : "";
}

function dialogueCount(value) {
  return [...String(value || "").matchAll(new RegExp(QUOTED_TEXT.source, "gu"))].length;
}

function compressedDialogueLadders(paragraphs) {
  const hits = [];
  const hardFactPayload = /(?:\d|[零〇一二三四五六七八九十百千万两]{1,5}(?:年|月|天|元|万|人|份|个|成)|退休医疗|手术押金|账户|余额|期限|服务费|岗位|产权|担保)/u;
  let lastEnd = -1;
  for (let start = 0; start < paragraphs.length; start += 1) {
    if (start <= lastEnd) continue;
    const window = paragraphs.slice(start, start + 6);
    const isolated = window
      .map((paragraph, offset) => ({
        paragraph: paragraph.index,
        offset,
        text: isolatedDialogueText(paragraph.value)
      }))
      .filter((item) => item.text && item.text.replace(/[，。！？!?、；：\s]/gu, "").length <= 18);
    const quotes = window.reduce((sum, paragraph) => sum + dialogueCount(paragraph.value), 0);
    const factDialogueCount = isolated.filter((item) => hardFactPayload.test(item.text)).length;
    if (isolated.length < 3 || quotes < 4 || factDialogueCount < 2) continue;
    const first = isolated[0];
    const last = isolated[isolated.length - 1];
    hits.push({
      paragraph: first.paragraph,
      excerpt: window.slice(first.offset, last.offset + 1).map((paragraph) => paragraph.value).join(" "),
      isolatedCount: isolated.length,
      quoteCount: quotes,
      factDialogueCount
    });
    lastEnd = start + last.offset;
  }
  return hits;
}

function manufacturedCallbackPunchlines(paragraphs) {
  const predicates = ["只认", "只看", "只算", "只留", "只听", "只要", "不认", "不算", "不留"];
  const hits = [];
  for (let index = 1; index < paragraphs.length; index += 1) {
    const previous = paragraphs[index - 1];
    const current = paragraphs[index];
    const compact = current.value.replace(/[，。！？!?、；：\s]/gu, "");
    if (compact.length > 22 || dialogueCount(current.value) > 0) continue;
    const predicate = predicates.find((item) => previous.value.includes(item) && current.value.includes(`也${item}`));
    if (!predicate || !/^(?:我|你|他|她|它|我的|你的|他的|她的|它的)/u.test(compact)) continue;
    hits.push({
      paragraph: current.index,
      excerpt: `${previous.value} ${current.value}`,
      predicate
    });
  }
  return hits;
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
export function diagnosePlayerScript(body, { expectedPov = "" } = {}) {
  const text = normalizeText(body);
  const paragraphs = splitParagraphs(text);
  const proseParagraphs = paragraphs.filter((paragraph) => !HEADING.test(paragraph.value));
  const issues = [];
  let sceneEvidenceParagraphs = 0;
  let explanatoryParagraphs = 0;
  let explanationTransitions = 0;

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

  const fragmentRun = shortSentenceChain(proseParagraphs);
  if (fragmentRun.length) {
    addIssue(issues, {
      code: "manufactured_fragment_rhythm",
      category: "player_prose",
      severity: "medium",
      paragraph: fragmentRun[0].paragraph,
      excerpt: compactExcerpt(fragmentRun.map((item) => item.value).join("。")),
      evidence: "连续三个短断句",
      message: "连续短断句在制造统一的“伪文学”节拍。",
      action: "按同一动作或同一次意识流合并句子；只有真实停顿才单独成段。",
      rewriteMode: "merge"
    });
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

  const cadence = templateParagraphCadence(proseParagraphs);
  if (cadence) {
    addIssue(issues, {
      code: "template_paragraph_cadence",
      category: "player_prose",
      severity: "high",
      paragraph: cadence.paragraph,
      excerpt: "",
      evidence: `${cadence.contentParagraphs} 个主体段长度变异系数仅 ${cadence.coefficient}，其中 ${Math.round(cadence.moldedRatio * 100)}% 固定为 2～5 句`,
      message: "正文段落被切成近似容量和近似句数，出现批量生成式整齐节拍。",
      action: "不要随机增删字数；按动作是否连续、话题是否被打断和信息是否应当延迟，重新决定哪里并段、哪里停顿。",
      rewriteMode: "rebuild_paragraph_rhythm"
    });
  }

  const transitionCount = naturalTransitionCount(text);
  if (text.length >= 250 && proseParagraphs.length >= 6 && transitionCount < 2) {
    addIssue(issues, {
      code: "missing_transition_bridges",
      category: "player_prose",
      severity: transitionCount === 0 ? "high" : "medium",
      paragraph: 0,
      excerpt: "",
      evidence: `${text.length} 字、${proseParagraphs.length} 段，仅识别到 ${transitionCount} 处自然时间/因果/转折承接`,
      message: "叙述几乎只靠动作硬切，时间推进、因果变化或预期落空缺少自然承接。",
      action: "检查真实发生变化的位置，补入人物会使用的自然连接；不要每段机械轮换一枚书面连接词。",
      rewriteMode: "restore_natural_transitions"
    });
  }

  for (const hit of compressedDialogueLadders(proseParagraphs)) {
    addIssue(issues, {
      code: "compressed_dialogue_ladder",
      category: "player_prose",
      severity: "high",
      paragraph: hit.paragraph,
      excerpt: compactExcerpt(hit.excerpt),
      evidence: `${hit.isolatedCount} 个短对白独立成段，窗口内共 ${hit.quoteCount} 句对白，其中 ${hit.factDialogueCount} 句承载数字或合同字段`,
      message: "对话被剪成问一句、报一个数、再追问的电报式信息传送带。",
      action: "重写整段交谈：让说话人带着关系、顾虑或误解回应，合并无真实停顿的独立短句；事实不能靠连续报数一次性交代完。",
      rewriteMode: "rewrite_conversation"
    });
  }

  for (const hit of manufacturedCallbackPunchlines(proseParagraphs)) {
    addIssue(issues, {
      code: "manufactured_callback_punchline",
      category: "player_prose",
      severity: "high",
      paragraph: hit.paragraph,
      excerpt: compactExcerpt(hit.excerpt),
      evidence: `相邻段落重复“${hit.predicate}”，再用“我/我的……也……”收尾`,
      message: "段尾正在用对称回扣制造可摘抄金句，人物声音被作者句法覆盖。",
      action: "删除回扣句，停在尚未解决的动作或具体文件后果；不要把上一段意象换主语复述一遍。",
      rewriteMode: "delete_callback"
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
  const score = Math.max(0, 100 - highCount * 24 - mediumCount * 8 - lowCount * 3);
  return {
    version: PROSE_QUALITY_GATE_VERSION,
    passed: highCount === 0,
    blocked: highCount > 0,
    score,
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
      isolatedShortDialogueParagraphs: proseParagraphs.filter((paragraph) => {
        const spoken = isolatedDialogueText(paragraph.value);
        return spoken && spoken.replace(/[，。！？!?、；：\s]/gu, "").length <= 18;
      }).length,
      templateCadenceCoefficient: cadence?.coefficient ?? null,
      compressedTradeExpressions: compressedTradeExpressions(proseParagraphs).length,
      naturalTransitionCount: transitionCount
    },
    issues: issues.slice(0, 20)
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
  const averageScore = cells.length
    ? Math.round(cells.reduce((sum, cell) => sum + cell.score, 0) / cells.length)
    : 100;
  return {
    version: PROSE_QUALITY_GATE_VERSION,
    passed: blockedCells.length === 0,
    blocked: blockedCells.length > 0,
    skipped: cells.length === 0,
    score: averageScore,
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

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/**
 * Evidence-based authorship-style assessment for uploaded text.
 * This reports observable prose traits; it must never be presented as proof
 * that a person or a model wrote the document.
 */
export function assessHumanLikeProse(text, { sections = [], creationType = "murder_mystery" } = {}) {
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
  const metrics = whole.metrics;
  const taskLeaks = whole.issues.filter((issue) => ["task_wrapper", "analyst_brief", "strategy_menu_narration"].includes(issue.code)).length;
  const fragmentHits = whole.issues.filter((issue) => issue.code === "manufactured_fragment_rhythm").length;
  const conversationShapeHits = whole.issues.filter((issue) => ["compressed_dialogue_ladder", "manufactured_callback_punchline", "matrix_serialization"].includes(issue.code)).length;
  const narrativeRestraint = clampScore(100 - whole.summary.high * 20 - whole.summary.medium * 7 - metrics.explanatoryRatio * 45);
  const sceneGrounding = clampScore(42 + metrics.sceneEvidenceRatio * 68 + metrics.dialogueRatio * 24 - metrics.explanatoryRatio * 42);
  const rhythmNaturalness = clampScore(96 - fragmentHits * 18 - conversationShapeHits * 22 - Math.min(30, metrics.explanationTransitions * 5));
  const playerFacingIntegrity = clampScore(100 - taskLeaks * 30);
  let score = clampScore(
    narrativeRestraint * 0.38 +
    sceneGrounding * 0.32 +
    rhythmNaturalness * 0.16 +
    playerFacingIntegrity * 0.14
  );
  if (whole.summary.high >= 2) score = Math.min(score, 54);
  else if (whole.summary.high > 0) score = Math.min(score, 69);
  const confidence = metrics.chars >= 3000 ? "high" : metrics.chars >= 800 ? "medium" : "low";
  const level = score >= 80 ? "strong" : score >= 65 ? "mixed" : "weak";
  const label = {
    strong: "已知结构风险较低，仍须文学编辑",
    mixed: "可观察写作风险混合，建议抽段复核",
    weak: "解释性与模板结构明显，建议重审正文"
  }[level];
  const suggestions = [];
  if (metrics.sceneEvidenceRatio < 0.28) suggestions.push("抽查长段落：是否存在正在发生的场景、可见动作、对话与即时后果。");
  if (metrics.explanatoryRatio >= 0.2) suggestions.push("优先删除替人物下结论的心理解释，再检查删后是否损失可观察事实。");
  if (taskLeaks) suggestions.push("把任务、利弊分析和执行说明移出玩家正文，放回独立机制字段。");
  if (fragmentHits) suggestions.push("朗读连续短断句，合并并非真实停顿的“一句一段”。");
  if (conversationShapeHits) suggestions.push("抽查信息交付：删除问答式报数、段尾回扣和一段式矩阵摘要，重写说话人的关系语气、回避与误解。");
  const gatePassed = confidence !== "low" && score >= UPLOAD_PROSE_REVIEW_THRESHOLD && whole.summary.high === 0;
  return {
    version: PROSE_QUALITY_GATE_VERSION,
    score,
    level,
    label,
    confidence,
    creationType,
    dimensions: {
      narrativeRestraint,
      sceneGrounding,
      rhythmNaturalness,
      playerFacingIntegrity
    },
    summary: {
      chars: metrics.chars,
      sections: sectionReports.length,
      high: whole.summary.high,
      medium: whole.summary.medium,
      sceneEvidenceRatio: metrics.sceneEvidenceRatio,
      explanatoryRatio: metrics.explanatoryRatio
    },
    gate: {
      passed: gatePassed,
      decision: gatePassed ? "pass" : "manual_review",
      threshold: UPLOAD_PROSE_REVIEW_THRESHOLD,
      reason: gatePassed
        ? "未命中高风险写法，且综合分达到自动准入线。"
        : confidence === "low"
          ? "有效正文不足 800 字，样本过短，不能自动准入。"
          : whole.summary.high > 0
          ? "命中高风险写法，须人工复核对应原文后再决定是否进入发布流程。"
          : `综合分低于 ${UPLOAD_PROSE_REVIEW_THRESHOLD} 分，须人工复核后再决定是否进入发布流程。`
    },
    issues: (locatedIssues.length ? locatedIssues : whole.issues).slice(0, 30),
    suggestions: suggestions.slice(0, 6),
    disclaimer: "这是对可观察写作特征的辅助评分，不是作者身份或 AI 使用情况的鉴定。"
  };
}
