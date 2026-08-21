import test from "node:test";
import assert from "node:assert/strict";

import {
  diagnosePlayerFacingRoleDocument,
  diagnosePlayerScript,
  diagnosePlayerTaskCard,
  diagnoseTaskCardCollection,
  diagnoseScriptCollection,
  fingerprintScriptCollection,
  inspectPlayerProse
} from "../../shared/prose-quality-gate.js";
import {
  IMMEDIATE_CHARACTER_STATE_CONTRACT_BLOCK,
  PLAYER_FACING_PROSE_CONTRACT_BLOCK
} from "../../shared/player-facing-contract.js";
import { analyzeNarrativeRhythm } from "../../shared/narrative-rhythm.js";

const rejectedSample = `你没有签。

不是舍不得。你只是那阵子忙，三号机组刚换氟，两个老员工办退休，银行来查消防改造款。等这些事忙完，你会签。

你一直这么告诉自己。`;

const sceneSample = `离婚协议在柜台的玻璃板下压了三个月。今天唐远来交维修单，收银员把那叠纸一起抽出来，推到他手边。

“还差你一个名字。”

唐远捏着笔，没有碰协议。他先把维修单上的数字圈了一遍，又问：“三号机组的发票呢？”

收银员看了他一会儿，把协议翻回正面：“发票昨天就给你了。”

门外有人催缴费。唐远把笔帽扣上，拿走维修单，协议仍留在玻璃板上。`;

const compressedDialogueSample = `唐峥把存款截单压在手下，许青问：“你到底能拿多少？”

“五万。”

“上个月你说十三。”

“八万是手术押金。”`;

const callbackSample = `四张封面排在桌上。陈克填最终分配表时，手指一直压着那枚提交码，像怕别人抢。没人能抢走，码只认他的账号。

我的章也只认我。`;

const strategyMenuSample = `我可以把原会议簿拿出来，换周放承认这笔账。也可以继续压着不动，先让陈克补足医疗款。第三种办法是把存款贴进去。`;

const matrixSerializationSample = `像我有退休金，名字就该往上填。许青母亲那几年受过我的照应，不等于许青的房贷也该从我卡里走。她念漏了空置、漏水和提前退出中的哪一项，我就把章扣回掌心；念全了，我也还得算一遍每月买药以后剩多少。`;

test("scene-first gate blocks the exact self-explaining narration regression", () => {
  const result = diagnosePlayerScript(rejectedSample);
  assert.equal(result.passed, false);
  assert.ok(result.issues.some((issue) => issue.code === "corrective_thesis"));
  assert.ok(result.issues.some((issue) => issue.code === "self_explaining_narrator"));
});

test("scene-first gate accepts action and dialogue without explaining their meaning", () => {
  const result = diagnosePlayerScript(sceneSample);
  assert.equal(result.passed, true);
  assert.equal(result.summary.high, 0);
  assert.ok(result.metrics.sceneEvidenceRatio >= 0.5);
});

test("pov gate blocks first-person author analysis while allowing lived first-person action", () => {
  const lived = diagnosePlayerScript("我把柜门关上，说早扔了。女儿没再问。", { expectedPov: "first" });
  const explained = diagnosePlayerScript("我把柜门关上。我之所以不肯拿出来，是因为我始终无法面对过去。", { expectedPov: "first" });
  assert.equal(lived.passed, true);
  assert.equal(explained.passed, false);
  assert.ok(explained.issues.some((issue) => issue.code === "first_person_self_analysis"));
});

test("pov gate blocks narration switching between first and second person", () => {
  const first = diagnosePlayerScript("我把柜门关上。你站在门口没动。", { expectedPov: "first" });
  const second = diagnosePlayerScript("你把柜门关上。我站在门口没动。", { expectedPov: "second" });
  assert.ok(first.issues.some((issue) => issue.code === "mixed_narrative_pov"));
  assert.ok(second.issues.some((issue) => issue.code === "mixed_narrative_pov"));
});

test("narrative rhythm reports telegraphic question-answer ladders without grading prose", () => {
  const result = diagnosePlayerScript(`${compressedDialogueSample}\n\n“哪天？”\n\n“十四号。”\n\n“几点？”\n\n“八点。”\n\n“确定？”\n\n“确定。”`);
  assert.ok(result.rhythm.observations.some((item) => item.code === "dense_two_to_five_char_dialogue"));
  assert.equal("score" in result, false);
});

test("reader-language gate blocks compressed pseudo-jargon and missing predicates", () => {
  const result = diagnosePlayerScript("我正在给猴王换腕子。半轮月掉到桌下，我捡起来，断口毛，针眼倒还齐。", { expectedPov: "first" });
  assert.equal(result.passed, false);
  assert.ok(result.issues.some((issue) => issue.code === "compressed_trade_expression"));
});

test("narrative rhythm observes frequent single-sentence paragraphs without a quality score", () => {
  const result = analyzeNarrativeRhythm(`我把旧账册摊在桌上。

窗外有人敲门。

周敏摸了摸抽屉上的锁。

我把杯子挪开。

门外的脚步绕到了后窗。

周敏把窗帘拉严。

抽屉里只有两张收据。

后窗又响了一次。`);
  assert.ok(result.observations.some((item) => item.code === "frequent_single_sentence_paragraphs"));
  assert.equal("score" in result, false);
  assert.equal("passed" in result, false);
});

test("diagnostics do not prescribe a minimum number of transition words", () => {
  const result = diagnosePlayerScript(`我把账册摊在桌上，纸角压着一枚旧钥匙。门外有人敲了两次，我没有应声，只把钥匙收进袖口。

周敏推门进来，鞋底带着院里的泥。她看见桌上的账册，伸手翻到最后一页，把其中一个名字圈了起来。

我按住她的笔，问她从哪里听到这个名字。她抬眼看着我，嘴里说不记得，手却一直没有松开。

院门又响了一次，窗纸上映出两个人影。周敏把账册合上，抱进怀里，叫我先去把后窗插牢。

后窗下面放着一只木箱，锁眼里塞着半截红线。我抽出红线，认出是去年绑在货单上的那一根。

周敏蹲下来翻木箱，最底下只有两张收据。她把收据递给我，指着同一个名字，问我还准备瞒多久。

我没有回答，把后窗推开一条缝。巷口停着一辆没见过的车，车上的人正朝院门走。`, { expectedPov: "first" });
  assert.ok(!result.issues.some((issue) => issue.code === "missing_transition_bridges"));
});

test("conversation-shape gate allows brief relational exchanges without field delivery", () => {
  const result = diagnosePlayerScript(`陈克站在门口，看着她从吊柜里摸出红布包。\n\n“找这个？”\n\n“晚上要用。”\n\n“你先把鞋换了。”\n\n他没换，只把公文包放到饭桌边。`);
  assert.equal(result.passed, true);
  assert.ok(!result.issues.some((issue) => issue.code === "compressed_dialogue_ladder"));
  assert.ok(!result.issues.some((issue) => issue.code === "manufactured_fragment_rhythm"));
});

test("a local callback is not converted into an automatic literary verdict", () => {
  const result = diagnosePlayerScript(callbackSample);
  assert.ok(!result.issues.some((issue) => issue.code === "manufactured_callback_punchline"));
  assert.equal("score" in result, false);
});

test("role-agency gate blocks strategy menus disguised as narration", () => {
  const result = diagnosePlayerScript(strategyMenuSample);
  assert.equal(result.passed, false);
  assert.ok(result.issues.some((issue) => issue.code === "strategy_menu_narration"));
});

test("scene gate blocks information matrices serialized as first-person prose", () => {
  const result = diagnosePlayerScript(matrixSerializationSample);
  assert.equal(result.passed, false);
  assert.ok(result.issues.some((issue) => issue.code === "matrix_serialization"));
});

test("scene gate allows the same dispute to emerge through a situated exchange", () => {
  const result = diagnosePlayerScript(`许青把合同转到罗姨面前。罗姨先把纸抽了回去：“别急着写我。我有退休金归我有退休金，总不能你这房贷也跟着从我卡里扣。你妈那几年，我跑人事科是我愿意，买房不是一回事。”\n\n许青把担保栏翻给她看：“我没让你还房贷。这里写的是漏水维修，你先听我念完。”`);
  assert.equal(result.passed, true);
  assert.ok(!result.issues.some((issue) => issue.code === "matrix_serialization"));
});

test("dialogue may contain a disputed phrase without being treated as narrator voice", () => {
  const result = diagnosePlayerScript(`周敏把申请表拍在桌上。“不是舍不得。你只是怕他们问到账。”\n\n你把表格推了回去。`);
  assert.equal(result.passed, true);
});

test("collection diagnostics identify the blocked role-act cell", () => {
  const result = diagnoseScriptCollection({
    role1: { act1: { body: sceneSample }, act2: { body: rejectedSample } }
  });
  assert.equal(result.passed, false);
  assert.equal(result.summary.blockedCells, 1);
  assert.equal(result.issues.find((issue) => issue.severity === "high")?.cell, "role1_act2");
});

test("script fingerprint is stable and changes after an edit", () => {
  const left = { role2: { act1: { body: "乙" } }, role1: { act1: { body: "甲" } } };
  const reordered = { role1: { act1: { body: "甲" } }, role2: { act1: { body: "乙" } } };
  const edited = { role1: { act1: { body: "甲改" } }, role2: { act1: { body: "乙" } } };
  assert.equal(fingerprintScriptCollection(left), fingerprintScriptCollection(reordered));
  assert.notEqual(fingerprintScriptCollection(left), fingerprintScriptCollection(edited));
});

test("upload inspection returns evidence without scores, levels or authorship claims", () => {
  const rejected = inspectPlayerProse(rejectedSample, { sections: [{ title: "坏段", body: rejectedSample }] });
  const sceneBased = inspectPlayerProse(sceneSample, { sections: [{ title: "场景", body: sceneSample }] });
  assert.equal(rejected.review.decision, "manual_review");
  assert.equal(rejected.review.required, true);
  assert.equal(sceneBased.review.required, false);
  assert.equal("score" in rejected, false);
  assert.equal("level" in rejected, false);
  assert.equal("dimensions" in rejected, false);
  assert.match(rejected.disclaimer, /未调用 AI 评审/u);
});

test("player-surface boundary blocks the leaked authoring template regression", () => {
  const result = diagnosePlayerScript(`## 公开朗读

你没有回避过自己和林渡的关系。

### 与梁策

你们不是朋友，而是互相欠债的人。

## 第一幕

- 时间：21:08
- 原句：“我不会关门。”
- 指定证据：E-08

你现在可以公开：

- 许栖改过校准时间。

你暂时最想隐瞒：

- 21:09 的关门命令来自你。

### 第一幕行动建议

- 如果有人把责任推给许栖，你可以强调“改期的人制造了危险”。`);

  const codes = new Set(result.issues.map((issue) => issue.code));
  assert.equal(result.passed, false);
  assert.ok(codes.has("readaloud_instruction"));
  assert.ok(codes.has("relationship_dossier"));
  assert.ok(codes.has("relationship_verdict"));
  assert.ok(codes.has("relationship_meta_summary"));
  assert.ok(codes.has("prop_schema_leak"));
  assert.ok(codes.has("internal_key_leak"));
  assert.ok(codes.has("player_instruction_block"));
  assert.ok(codes.has("player_strategy_directive"));
});

test("player-surface boundary allows time, intimacy and conflict inside a lived scene", () => {
  const result = diagnosePlayerScript(`墙上的钟刚过九点八分，林渡把湿外套搭到椅背，水顺着袖口滴在你刚拖过的地上。

“又去旧仓库了？”你把抹布丢进桶里。

他没答，弯腰替你拧干抹布。小时候每逢父亲喝醉，他也是这样蹲在厨房门后，把摔碎的碗一片片捡进簸箕。后来他离开港口，你们有七年没在同一张桌上吃过饭。

雨敲得窗玻璃发白。林渡从内袋里摸出一张受潮的纸，放到桌沿：“姐，爸当年没有喝酒。”

你盯着他指甲缝里的黑泥，把抹布从他手里拿回来。`);
  assert.equal(result.passed, true);
  assert.ok(!result.issues.some((issue) => issue.category === "player_surface_boundary"));
});

test("complete role-document gate rejects an undersized public opening", () => {
  const result = diagnosePlayerFacingRoleDocument({
    publicBody: "雨夜里，你推开旧邮局的门。",
    acts: [{ key: "act-1", body: sceneSample }]
  }, { minimumPublicChars: 80, minimumActChars: 80 });
  assert.equal(result.passed, false);
  assert.ok(result.issues.some((issue) => issue.code === "public_body_too_short"));
});

test("shared generation contract permanently names every blocked leakage layer", () => {
  assert.match(PLAYER_FACING_PROSE_CONTRACT_BLOCK, /知识矩阵/u);
  assert.match(PLAYER_FACING_PROSE_CONTRACT_BLOCK, /证据编号/u);
  assert.match(PLAYER_FACING_PROSE_CONTRACT_BLOCK, /关系必须通过共同经历/u);
  assert.match(PLAYER_FACING_PROSE_CONTRACT_BLOCK, /行动建议/u);
  assert.match(PLAYER_FACING_PROSE_CONTRACT_BLOCK, /主持人手册/u);
});

test("time-memory gate blocks a player paragraph that serializes the minute ledger", () => {
  const result = diagnosePlayerScript(`七点四十二分，你离开前厅。七点五十分，你进了档案间。八点二十分，灯灭了。八点二十七分，灯又亮起。九点零二分，袁素推开分拣室的门。`);
  assert.equal(result.passed, false);
  assert.ok(result.issues.some((issue) => issue.code === "minute_grid_narration"));
});

test("time-memory gate allows one exact anchor among ordinary fuzzy recollection", () => {
  const result = diagnosePlayerScript(`你到旧所时天刚擦黑，雨还没有落密。七点四十分前后，前厅的人逐渐散开。后来有人关过一次总闸，灯灭了约莫一袋烟的工夫。墙钟重新走起来后，你特意看了一眼：八点二十七分。再往后的脚步声隔着雨，谁也说不准相差几分钟。`);
  assert.equal(result.passed, true);
  assert.equal(result.metrics.exactMinuteMentions, 1);
});

test("prose gate blocks undefined concrete-to-abstract afterglow", () => {
  const result = diagnosePlayerScript(`镇上的病人来来去去。你认得他们的旧伤，也认得他们进门时不愿说出的那一部分。`);
  assert.equal(result.passed, false);
  assert.ok(result.issues.some((issue) => issue.code === "undefined_abstract_afterglow"));
});

test("prose gate blocks the caregiving-silence subtext kit", () => {
  const result = diagnosePlayerScript(`罗启川发烧住院那晚，忽然问你邮车是否去过南岸。你替他把被子拉高，没有回答。`);
  assert.equal(result.passed, false);
  assert.ok(result.issues.some((issue) => issue.code === "caregiving_silence_template"));
});

test("independent task cards allow outcomes but block player strategy", () => {
  const accepted = diagnosePlayerTaskCard(`## 本幕任务\n\n- 确认赵善言的直接死因。\n- 还原停电前后进入分拣室的人。\n- 决定是否把旧诊疗簿交入共同调查。`);
  const rejected = diagnosePlayerTaskCard(`## 本幕任务\n\n- 如果有人怀疑你，你可以先把责任推给罗启川。\n- 暂时不要公开九点十二分的诊疗记录。`);
  assert.equal(accepted.passed, true);
  assert.equal(rejected.passed, false);
  assert.ok(rejected.issues.some((issue) => issue.code === "task_strategy_leak"));
});

test("task-card collection remains separate from role prose", () => {
  const result = diagnoseTaskCardCollection({
    role1: {
      act1: `## 本幕任务\n\n- 查明分拣室格架是否造成致命伤。`,
      act2: `## 本幕任务\n\n- 还原挂号信从北坡到邮电所的路线。`
    }
  });
  assert.equal(result.passed, true);
  assert.equal(result.cards.length, 2);
});
