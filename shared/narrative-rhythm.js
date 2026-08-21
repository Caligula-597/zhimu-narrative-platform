/**
 * Narrative Rhythm / 叙事呼吸
 *
 * This module does not grade prose, infer authorship, or decide whether a
 * passage is good. It reports repeated distributions that are hard to notice
 * while reading one paragraph at a time. Every observation must retain the
 * underlying counts and examples so that a human editor can make the call.
 */
export const NARRATIVE_RHYTHM_VERSION = "v1.0-statistical-observation";

const QUOTED_TEXT = /“[^”]*”|「[^」]*」|『[^』]*』|"[^"]*"|'[^']*'/gu;
const HEADING_OR_LIST = /^(?:#{1,6}\s+|【[^】]+】\s*$|[-*+]\s+|\d+[.)、]\s*)/u;
const ACTION = /(?:拿|放|推|拉|敲|关|开|走|站|坐|蹲|抬|低头|转身|伸手|递|接|翻|按|擦|撕|签|写|倒|喝|盯|听|问|喊|笑|哭|停下|退|进门|出门|靠|拍|摔|扔|捏|攥|松手|点头|摇头|掀|塞进|抽出|拧开)/gu;
const BEAT_MARKER = /(?:但这次|但这一次|可这次|可这一次|直到|这才|然而)/gu;
const REVERSAL_MARKER = /(?:但这次|但这一次|可这次|可这一次|可是|然而|直到|这才|却|没想到|原来|竟然|反倒|偏偏)/gu;
const REVEAL_MARKER = /(?:直到|这才|才发现|才知道|原来|没想到|竟然|真正(?:的)?|第一次意识到)/u;
const PROP = /(?:钥匙|信封|信件|名单|照片|药瓶|病历|票据|戒指|手表|箱子|账本|合同|档案|录音|刀|枪|印章|纸条|血迹|鞋印|车票|门卡|存折)/u;
const PROP_ANOMALY = /(?:不见|少了|多了|陌生|不属于|不是原来|断了|开着|锁着|湿了|烧过|被换|被撕|被改|沾着|藏着|空了|错了)/u;
const DIALOGUE_CONNECTOR = /(?:因为|所以|但是|不过|可是|如果|要是|虽然|后来|当时|其实|除非|不然|与其|不是.+而是)/u;

function normalizeText(value) {
  return String(value || "").replace(/\r\n?/g, "\n").trim();
}

function compactLength(value) {
  return String(value || "").replace(/[\s，。！？!?、；：,."“”‘’「」『』（）()—…]/gu, "").length;
}

function sentenceCount(value) {
  return (String(value || "").match(/[^。！？!?]+[。！？!?]?/gu) || [])
    .map((item) => item.trim())
    .filter(Boolean).length;
}

function splitParagraphs(text) {
  const normalized = normalizeText(text);
  let cursor = 0;
  return normalized
    .split(/\n+/u)
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value, index) => {
      const start = normalized.indexOf(value, cursor);
      cursor = Math.max(cursor, start + value.length);
      const quotes = [...value.matchAll(new RegExp(QUOTED_TEXT.source, "gu"))];
      const quotedChars = quotes.reduce((sum, match) => sum + compactLength(match[0]), 0);
      const length = compactLength(value);
      return {
        index: index + 1,
        value,
        start: Math.max(0, start),
        length,
        sentences: sentenceCount(value),
        dialogueCount: quotes.length,
        dialogueRatio: length ? quotedChars / length : 0,
      };
    });
}

function sentenceLengths(paragraphs) {
  return paragraphs.flatMap((paragraph) =>
    (paragraph.value.match(/[^。！？!?]+[。！？!?]?/gu) || [])
      .map((value) => compactLength(value))
      .filter((length) => length > 0)
  );
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function standardDeviation(values) {
  if (!values.length) return 0;
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

function coefficientOfVariation(values) {
  const average = mean(values);
  return average ? standardDeviation(values) / average : 0;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function lagCorrelation(values, lag) {
  if (values.length < lag + 4) return null;
  const left = values.slice(0, values.length - lag);
  const right = values.slice(lag);
  const leftMean = mean(left);
  const rightMean = mean(right);
  const numerator = left.reduce((sum, value, index) => sum + (value - leftMean) * (right[index] - rightMean), 0);
  const denominator = Math.sqrt(
    left.reduce((sum, value) => sum + (value - leftMean) ** 2, 0)
      * right.reduce((sum, value) => sum + (value - rightMean) ** 2, 0)
  );
  return denominator ? numerator / denominator : null;
}

function alternatingDirectionRatio(values) {
  const directions = [];
  for (let index = 1; index < values.length; index += 1) {
    const delta = values[index] - values[index - 1];
    if (delta) directions.push(Math.sign(delta));
  }
  if (directions.length < 3) return 0;
  let changes = 0;
  for (let index = 1; index < directions.length; index += 1) {
    if (directions[index] !== directions[index - 1]) changes += 1;
  }
  return changes / (directions.length - 1);
}

function dialogueTurns(text) {
  return [...String(text || "").matchAll(new RegExp(QUOTED_TEXT.source, "gu"))].map((match) => {
    const raw = match[0].slice(1, -1).trim();
    const compact = raw.replace(/[\s，。！？!?、；：,.—…]/gu, "");
    const clauses = raw.split(/[，。！？!?、；：,]/u).map((item) => item.trim()).filter(Boolean).length;
    return { raw, compact, length: compact.length, clauses };
  });
}

function markerPositions(text, pattern) {
  return [...String(text || "").matchAll(new RegExp(pattern.source, "gu"))].map((match) => ({
    value: match[0],
    index: Number(match.index || 0),
  }));
}

function paragraphEndHook(paragraph) {
  const end = paragraph.value.replace(/[”」』"'。！？!?\s]+$/gu, "").slice(-34);
  if (!end) return null;
  if (/(?:\d+|[零〇一二三四五六七八九十百千万两]+(?:年|月|日|号|点|分|元|万|份|封|张|把|个人))$/u.test(end)) {
    return { kind: "number", excerpt: paragraph.value };
  }
  if (/(?:名字(?:是|叫)?|签名(?:是)?|落款(?:是)?)[\p{Script=Han}·]{2,8}$/u.test(end)) {
    return { kind: "name", excerpt: paragraph.value };
  }
  if (PROP.test(end) && PROP_ANOMALY.test(end)) {
    return { kind: "prop_anomaly", excerpt: paragraph.value };
  }
  if (REVEAL_MARKER.test(end) && compactLength(end) <= 26) {
    return { kind: "marked_reveal", excerpt: paragraph.value };
  }
  return null;
}

function classifyParagraphs(paragraphs) {
  const usable = paragraphs.filter((paragraph) => !HEADING_OR_LIST.test(paragraph.value));
  const baseline = median(usable.map((paragraph) => paragraph.length).filter(Boolean));
  const longBoundary = Math.max(55, baseline * 1.35);
  const shortBoundary = Math.min(24, Math.max(8, baseline * 0.55));
  return usable.map((paragraph) => {
    let type = "M";
    if (REVEAL_MARKER.test(paragraph.value.slice(-48))) type = "R";
    else if (paragraph.dialogueRatio >= 0.5) type = "D";
    else if (paragraph.length >= longBoundary) type = "L";
    else if (paragraph.length <= shortBoundary) type = "S";
    return { ...paragraph, type };
  });
}

function repeatedLongShortDialogueReveal(paragraphs) {
  const classified = classifyParagraphs(paragraphs);
  const hits = [];
  for (let index = 0; index <= classified.length - 4; index += 1) {
    const window = classified.slice(index, index + 4);
    if (window.map((item) => item.type).join("") === "LSDR") hits.push(window);
  }
  return hits;
}

function samples(items, limit = 3) {
  return items.slice(0, limit).map((item) => String(item.excerpt || item.value || item.raw || "").replace(/\s+/g, " ").slice(0, 100));
}

function observation(code, message, evidence, reviewQuestion, evidenceSamples = []) {
  return {
    code,
    type: "statistical_anomaly",
    message,
    evidence,
    reviewQuestion,
    samples: evidenceSamples.filter(Boolean),
  };
}

/**
 * Analyze repeated rhythm distributions. The output deliberately has no
 * score, quality level, pass/fail decision, or authorship probability.
 */
export function analyzeNarrativeRhythm(value) {
  const text = normalizeText(value);
  const paragraphs = splitParagraphs(text);
  const contentParagraphs = paragraphs.filter((paragraph) => !HEADING_OR_LIST.test(paragraph.value));
  const lengths = sentenceLengths(contentParagraphs);
  const dialogues = dialogueTurns(text);
  const observations = [];

  const singleSentence = contentParagraphs.filter((paragraph) => paragraph.sentences === 1);
  const singleSentenceRatio = contentParagraphs.length ? singleSentence.length / contentParagraphs.length : 0;
  if (contentParagraphs.length >= 8 && singleSentence.length >= 6 && singleSentenceRatio >= 0.65) {
    observations.push(observation(
      "frequent_single_sentence_paragraphs",
      "单句段落在足够长的样本中持续占多数，段落可能正在被当作节拍单位而不是意义单位。",
      `${singleSentence.length}/${contentParagraphs.length} 个正文段落只有一句`,
      "这些分段是否分别对应真实的话题转移、动作中断或阅读停顿？",
      samples(singleSentence)
    ));
  }

  const patternHits = repeatedLongShortDialogueReveal(contentParagraphs);
  if (patternHits.length >= 2) {
    observations.push(observation(
      "repeated_long_short_dialogue_reveal",
      "“长段—短段—对白—揭示”四拍结构重复出现。",
      `识别到 ${patternHits.length} 组重复四拍结构`,
      "这些揭示是否由事件自然到达，还是每轮都在用同一种版式制造推进感？",
      patternHits.slice(0, 2).map((window) => window.map((item) => item.value).join(" / ").slice(0, 100))
    ));
  }

  const shortDialogues = dialogues.filter((turn) => turn.length >= 2 && turn.length <= 5);
  const shortDialogueRatio = dialogues.length ? shortDialogues.length / dialogues.length : 0;
  if (dialogues.length >= 8 && shortDialogues.length >= 5 && shortDialogueRatio >= 0.45) {
    observations.push(observation(
      "dense_two_to_five_char_dialogue",
      "二至五字对白在连续阅读文本中异常密集，可能形成影视式碎问碎答。",
      `${shortDialogues.length}/${dialogues.length} 个对白轮次仅 2～5 字`,
      "其中哪些对白必须让玩家逐字表演，哪些意图可以由叙述一次交代完整？",
      samples(shortDialogues)
    ));
  }

  const singleClauseDialogues = dialogues.filter((turn) =>
    turn.length > 0 && turn.length <= 16 && turn.clauses <= 1 && !DIALOGUE_CONNECTOR.test(turn.raw)
  );
  const singleClauseRatio = dialogues.length ? singleClauseDialogues.length / dialogues.length : 0;
  if (dialogues.length >= 10 && singleClauseDialogues.length >= 7 && singleClauseRatio >= 0.7) {
    observations.push(observation(
      "single_clause_dialogue_turns",
      "对白轮次高度集中为单分句短响应，可能每轮只承担一次确认或一个信息点。",
      `${singleClauseDialogues.length}/${dialogues.length} 个对白轮次为不超过 16 字的单分句`,
      "逐轮检查说话人是否带着完整意图、关系态度和当下顾虑在回应。",
      samples(singleClauseDialogues)
    ));
  }

  const hooks = contentParagraphs.map(paragraphEndHook).filter(Boolean);
  const hookRatio = contentParagraphs.length ? hooks.length / contentParagraphs.length : 0;
  if (contentParagraphs.length >= 10 && hooks.length >= 4 && hookRatio >= 0.35) {
    const kinds = hooks.reduce((result, hook) => ({ ...result, [hook.kind]: (result[hook.kind] || 0) + 1 }), {});
    observations.push(observation(
      "repeated_paragraph_end_hooks",
      "数字、姓名、物件异常或显式揭示反复被放在段尾，段落可能都在主动索取下一次点击感。",
      `${hooks.length}/${contentParagraphs.length} 个段尾具有钩子特征：${Object.entries(kinds).map(([key, count]) => `${key} ${count}`).join("、")}`,
      "这些信息是否恰好在段尾发生，还是为了维持刺激频率而被移动到段尾？",
      samples(hooks)
    ));
  }

  const beatMarkers = markerPositions(text, BEAT_MARKER);
  const beatDensity = text.length ? beatMarkers.length / text.length * 1000 : 0;
  if (text.length >= 700 && beatMarkers.length >= 4 && beatDensity >= 4) {
    observations.push(observation(
      "dense_explicit_beat_markers",
      "显式节拍连接词使用密集，叙事可能反复告诉读者“现在要转折或揭示了”。",
      `${beatMarkers.length} 处标记，约每千字 ${beatDensity.toFixed(1)} 处：${beatMarkers.slice(0, 8).map((item) => item.value).join("、")}`,
      "删去这些标记后，事件本身是否仍能让读者感到变化？"
    ));
  }

  const narrationParagraphs = contentParagraphs.filter((paragraph) => paragraph.dialogueCount === 0);
  const oneActionParagraphs = narrationParagraphs.filter((paragraph) => {
    const actionCount = [...paragraph.value.matchAll(new RegExp(ACTION.source, "gu"))].length;
    return paragraph.sentences === 1 && paragraph.length <= 34 && actionCount === 1;
  });
  const oneActionRatio = narrationParagraphs.length ? oneActionParagraphs.length / narrationParagraphs.length : 0;
  if (narrationParagraphs.length >= 10 && oneActionParagraphs.length >= 5 && oneActionRatio >= 0.4) {
    observations.push(observation(
      "one_action_one_paragraph",
      "大量叙述段只容纳一个短动作，动作可能被机械切成独立拍点。",
      `${oneActionParagraphs.length}/${narrationParagraphs.length} 个纯叙述段符合“单句、单动作、短段”`,
      "相邻动作是否属于同一连续过程，可以保留在同一个段落中？",
      samples(oneActionParagraphs)
    ));
  }

  const reversals = markerPositions(text, REVERSAL_MARKER);
  const reversalGaps = reversals.slice(1).map((item, index) => item.index - reversals[index].index);
  const reversalGapMean = mean(reversalGaps);
  const reversalGapCv = coefficientOfVariation(reversalGaps);
  if (reversals.length >= 5 && reversalGapMean >= 160 && reversalGapMean <= 340 && reversalGapCv <= 0.32) {
    observations.push(observation(
      "periodic_micro_reversals",
      "显式转折标记以近似固定字数间隔出现，微反转可能被当成周期性保活装置。",
      `${reversals.length} 处转折；平均间隔 ${Math.round(reversalGapMean)} 字，间隔变异系数 ${reversalGapCv.toFixed(2)}`,
      "每次转折是否改变了人物处境，还是只把上一段的信息换一种方向重新包装？"
    ));
  }

  const lag1 = lagCorrelation(lengths, 1);
  const lag2 = lagCorrelation(lengths, 2);
  const alternationRatio = alternatingDirectionRatio(lengths);
  const lengthCv = coefficientOfVariation(lengths);
  if (
    lengths.length >= 12
    && lengthCv >= 0.35
    && lag1 != null && lag1 <= -0.35
    && lag2 != null && lag2 >= 0.3
    && alternationRatio >= 0.72
  ) {
    observations.push(observation(
      "periodic_sentence_length_alternation",
      "句长表面上有明显方差，但长短变化具有周期性交替，像经过节拍器优化。",
      `${lengths.length} 句；句长变异系数 ${lengthCv.toFixed(2)}，相邻相关 ${lag1.toFixed(2)}，隔句相关 ${lag2.toFixed(2)}，方向交替率 ${Math.round(alternationRatio * 100)}%`,
      "句子长度是否由当前句需要承载的动作、信息和思考决定，还是在主动轮换长短？",
      [lengths.slice(0, 18).join(" → ")]
    ));
  }

  return {
    version: NARRATIVE_RHYTHM_VERSION,
    method: "deterministic_statistical_observation",
    sample: {
      chars: text.length,
      paragraphs: contentParagraphs.length,
      sentences: lengths.length,
      dialogueTurns: dialogues.length,
    },
    metrics: {
      singleSentenceParagraphs: singleSentence.length,
      singleSentenceParagraphRatio: Number(singleSentenceRatio.toFixed(3)),
      shortDialogueTurns: shortDialogues.length,
      shortDialogueRatio: Number(shortDialogueRatio.toFixed(3)),
      singleClauseDialogueRatio: Number(singleClauseRatio.toFixed(3)),
      paragraphEndHooks: hooks.length,
      beatMarkers: beatMarkers.length,
      oneActionParagraphs: oneActionParagraphs.length,
      reversalMarkers: reversals.length,
      reversalGapMean: reversalGaps.length ? Number(reversalGapMean.toFixed(1)) : null,
      reversalGapCoefficient: reversalGaps.length ? Number(reversalGapCv.toFixed(3)) : null,
      sentenceLengthMean: lengths.length ? Number(mean(lengths).toFixed(1)) : null,
      sentenceLengthCoefficient: lengths.length ? Number(lengthCv.toFixed(3)) : null,
      sentenceLag1Correlation: lag1 == null ? null : Number(lag1.toFixed(3)),
      sentenceLag2Correlation: lag2 == null ? null : Number(lag2.toFixed(3)),
      sentenceDirectionAlternationRatio: Number(alternationRatio.toFixed(3)),
    },
    observations,
    note: "这些结果只表示重复分布，不能证明文本由 AI 生成，也不直接判断文学质量。",
  };
}
