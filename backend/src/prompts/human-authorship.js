/**
 * Human-authorship constitution shared by outline, narrative and player-script prompts.
 *
 * "De-AI" is treated as a story-causality problem first and a wording problem second.
 * A prose polish pass cannot rescue a thesis-first, morally balanced demonstration.
 */
export const HUMAN_AUTHORSHIP_VERSION = "v1.10-grounded-reader-language";

const AUTONOMOUS_PREMISE_BANS = [
  {
    code: "retirement_care_premise",
    label: "养老、退休待遇或养老金分配",
    pattern: /(?:养老(?:院|制度|负担|问题|危机|费用|责任)?|养老金|退休金|退休待遇|退休职工|延迟退休|退休医疗)/u
  },
  {
    code: "missing_person_premise",
    label: "人员失踪、失联或寻找失踪者",
    pattern: /(?:(?:人员|员工|职工|乘客|学生|居民|成员).{0,8}(?:失踪|失联|丢失)|(?:失踪|失联).{0,8}(?:人员|员工|职工|乘客|学生|居民|成员)|寻找.{0,8}(?:失踪者|失联者)|有人失踪)/u
  },
  {
    code: "old_workplace_welfare_premise",
    label: "旧单位改制、职工安置或福利补偿分配",
    pattern: /(?:旧厂改制|单位改制|职工安置|福利分配|补偿款分配|老职工待遇)/u
  }
];

const ADMINISTRATIVE_PREMISE_PATTERN = /(?:开会|会议|协商|表态|投票|签字|签署|授权|署名|版本|方案|责任归属|交换权限|分配名额|分配份额|承担代价)/u;
const EMBODIED_PLAYER_ACTION_PATTERN = /(?:逃|追|藏|偷|抢|骗|认亲|搜|演|喊|唱|扮|拆|烧|毒|救|护|陷害|顶罪|毁证|上钟|分客|竞拍|闯入|夺走|冒名|绑架|背叛|杀害|下毒|纵火|盗取|替换|赶走|占领|拼接|排序|交易|经营|对抗)/u;
const SYMMETRIC_PERMISSION_PATTERN = /(?:每(?:个|名)人|六(?:个|名)人).{0,24}(?:掌握|拥有|各持).{0,18}(?:一项|一个|一张).{0,16}(?:不可替代|别人绕不过去|否决|权限|权利)/u;

function normalizeWorldSpecificActions(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).map((item) => {
    if (typeof item === "string") return { action: item, whyOnlyHere: "", changes: "" };
    return {
      action: String(item?.action || "").trim(),
      whyOnlyHere: String(item?.whyOnlyHere || "").trim(),
      changes: String(item?.changes || "").trim()
    };
  });
}

/**
 * Concept-stage gate for new AI premises. It prevents the truth schema from being used
 * backwards as a story generator: final decision -> permissions -> job-title characters.
 */
export function scanExperienceFirstPremise(truthBible = {}, { sourceText = "" } = {}) {
  const playerExperiencePromise = String(truthBible.playerExperiencePromise || "").trim();
  const retellableMoment = String(truthBible.retellableMoment || "").trim();
  const worldSpecificActions = normalizeWorldSpecificActions(truthBible.worldSpecificActions);
  const coreParts = [
    truthBible.summary,
    truthBible.centralQuestion,
    truthBible.publicCrisis,
    playerExperiencePromise,
    retellableMoment
  ].map((item) => String(item || ""));
  const source = String(sourceText || "");
  const sourceAnchoredAdministrativePremise = ADMINISTRATIVE_PREMISE_PATTERN.test(source);
  const violations = [];

  if (!playerExperiencePromise) {
    violations.push({ code: "missing_player_experience_promise", label: "缺少玩家体验承诺" });
  }
  if (!retellableMoment) {
    violations.push({ code: "missing_retellable_moment", label: "缺少可被玩家次日复述的具体场面" });
  }

  const completeActions = worldSpecificActions.filter((item) => item.action && item.whyOnlyHere && item.changes);
  const distinctActions = new Set(completeActions.map((item) => item.action));
  if (distinctActions.size < 2) {
    violations.push({ code: "missing_world_specific_actions", label: "至少两种世界专属动作未被证明" });
  }

  const administrativeParts = coreParts.filter((item) => ADMINISTRATIVE_PREMISE_PATTERN.test(item)).length;
  const embodiedParts = [playerExperiencePromise, retellableMoment, ...completeActions.map((item) => item.action)]
    .filter((item) => EMBODIED_PLAYER_ACTION_PATTERN.test(item)).length;
  if (!sourceAnchoredAdministrativePremise && administrativeParts >= 2 && embodiedParts === 0) {
    violations.push({
      code: "decision_only_administrative_premise",
      label: "题材只说明最终决定、签署或分配，没有玩家亲历的戏剧行为"
    });
  }

  const combined = coreParts.join("\n");
  if (!sourceAnchoredAdministrativePremise && SYMMETRIC_PERMISSION_PATTERN.test(combined)) {
    violations.push({
      code: "symmetric_permission_characters",
      label: "用每人一项不可替代权限制造表面对称角色"
    });
  }

  return {
    passed: violations.length === 0,
    blocked: violations.length > 0,
    scope: "ai_autonomous_concept_sequence",
    violations,
    proof: {
      playerExperiencePromise,
      retellableMoment,
      completeWorldSpecificActions: completeActions.length,
      administrativeParts,
      embodiedParts
    },
    sourceAnchoredAdministrativePremise
  };
}

/** Blocks recurring safe premises when the AI invents a new central story. */
export function scanAutonomousPremiseRegression(truthBible = {}, { sourceText = "" } = {}) {
  const core = [
    truthBible.summary,
    truthBible.centralQuestion,
    truthBible.publicCrisis,
    truthBible.irreversibleDeadline,
    truthBible.motive
  ].filter(Boolean).join("\n");
  const source = String(sourceText || "");
  const sourceForbids = /(?:禁止|严禁|不要|避免|不得).{0,18}(?:养老|退休|养老金|退休金|失踪|失联|人员丢失|旧厂改制|职工安置|福利补偿)/u.test(source);
  const violations = AUTONOMOUS_PREMISE_BANS
    .filter((rule) => rule.pattern.test(core) && (sourceForbids || !rule.pattern.test(source)))
    .map((rule) => ({ code: rule.code, label: rule.label }));
  return {
    passed: violations.length === 0,
    blocked: violations.length > 0,
    scope: "ai_autonomous_central_premise",
    violations,
    sourceAnchored: violations.length === 0 && AUTONOMOUS_PREMISE_BANS.some((rule) => rule.pattern.test(core) && rule.pattern.test(source))
  };
}

export function buildPlayerPovBlock(pov = "second") {
  const firstPerson = pov === "first";
  const chosen = firstPerson ? "第一人称「我」" : "第二人称「你」";
  const forbidden = firstPerson ? "第二人称「你」" : "第一人称「我」";
  const example = firstPerson
    ? `- 第一人称不是让角色给自己写人物分析。可以写“我把柜门关上，说早扔了”，不要写“我之所以不肯拿出来，是因为我始终无法面对过去”。后一句是作者借角色的嘴解释角色。`
    : `- 第二人称只贴着角色当时的注意、误判和动作，不替玩家规定理解。可以写“你把柜门关上，说早扔了”，不要写“你不肯拿出来，因为你始终无法面对过去”。`;
  return `【叙述人称合同 · 全篇锁定】
- 本角色全书正文锁定为${chosen}。引号外的叙述、回忆、心理和场景过渡全部使用${chosen}，不得切换成${forbidden}，也不得突然用角色姓名旁观自己。引号内他人的原话不受此限制。
- 幕与幕、段与段不重新选择人称；修稿不得为了句子顺口临时换视角。任务栏、合同原文等独立物料应与正文分栏，不得借物料混入另一套叙述声音。
${example}
- 心理只写当时确实冒出来、尚未被整理好的念头，例如想问却改口、认错人、先算错一笔账。禁止角色回头替作者归纳“我/你为什么会成为这样的人”“我/你真正害怕什么”“这件事说明了什么”。
- 判断一个心理句是否该留：角色当时若不可能在脑中用这套完整措辞对自己说一遍，就删除；需要交代的事实改由动作、对话、物料或后续后果承担。`;
}

export const HUMAN_STORY_FOUNDATION_BLOCK = `【真人化创作宪法 · 生活先于命题】
- 创作驾驶舱的顺序是不可倒置的因果合同：概念/体验 → 架构/真相 → 人物/关系 → 流程/机制 → 文稿/物料。允许发现问题后回退，不得从终局决定、结局轴、物料或权限反向拼出人物与题材。
- 概念进入真相层前必须先回答三件事：玩家亲自经历什么；哪一个具体场面值得第二天讲给别人听；至少两种什么动作只可能发生在这个世界、身份和场所中。全桌最后“决定什么”只是结果，不能代替玩家体验。
- centralQuestion、publicCrisis、endingAxes、权限、资源和结算字段是制作合同，不是创意种子。禁止先写“六个人各持一项不可替代权限”，再给六枚权限补职业、创伤和关系；六张不同名称的否决票仍然是结构对称。
- 若一句话梗概只能写成“利益相关者在期限前协商、签署、分配、选择版本或决定由谁承担代价”，必须退回概念阶段。增加一次事故、秘密或背叛不能自动把职业伦理会议变成剧情。
- AI 自主选题禁区：不得再把养老、退休金或退休待遇分配写成核心题材；不得用人员失踪、人员失联、寻找失踪者推动主线；不得回到旧单位改制、职工安置、福利补偿分配这一组安全现实主义母题。它们不能通过换机构、换年代、换物件重新出现。创作者明确提供的原素材另行忠实处理，但模型不得主动补入。
- “贴近现实”不等于围绕钱款表格、旧档案和福利分配开会。核心事件必须先具有戏剧性：有人当众夺走、背叛、冒名、逼迫、反咬、抢先成交、毁掉资格或做出其他不可撤销的行动；不能只让几个人坐下来协商一个较公平的方案。
- 原始素材若含有多组递进、互相反噬的矛盾，不得为追求“一句话钩子”只摘取其中最醒目的一组。创作前必须逐项确认：这组矛盾由谁亲历、在哪次关系或权力变化中发生、给后续哪一幕留下了什么现实后果。它们要进入同一批人物的命运并彼此作用，不能被缩成单一隐喻，也不能并列成议题清单。
- 作者可以有明确、锋利甚至偏激的答案；禁止的是把该答案编码成玩家必须抵达的唯一正确结局，再倒推人物遭遇充当证明。先写人物做过的不可逆行为、彼此欠下的具体旧账和眼前欲望，让作者立场成为会推动行动、伤害关系并可能反噬信奉者的一股力量。
- 作品可以有鲜明甚至偏激的作者立场，不必为了“客观”给反方补足同等正确性；但立场必须化成角色会执行、会伤人、会反噬自己的行动，不能由旁白宣布胜利。
- 世界、案件、制度和机制必须先能独立运转，不能只为了演示“效率与尊严”“真相与代价”“人性与系统”等二元命题而存在。
- 角色不是观点席位。禁止把玩家一一配成理性方、感性方、中立方、既得利益者、受害者和无辜下一代；每个人至少要有一项偏离主题轴的私人欲望、一段无法用立场概括的关系和一种不体面的自我辩护。
- 完整性不等于对称。不得给所有角色机械复制“一个秘密、一个创伤、一项任务、一次反转、一段弧光”的同构人生；信息量、表达能力、责任大小和变化幅度可以不平均，但每个人都必须能实际改变别人。
- 游戏公平只指规则可理解、重要事实可获得、弱势玩家仍有反制或交易机会；不指收益平均、损失平均、戏份平均、结局奖惩平均，更不指每一种观点都由作者安排同等正确。允许一个人赢走多数利益、另一个人承担不成比例的后果，只要这是玩家行动可造成、对手有机会阻止且主持能够结算的结果。
- 开场不准替未来写历史总结，不准先宣布“起初人们以为……后来才发现……”，不准解释本故事讨论什么。应从一个正在发生、尚未被人物理解完整的具体行动开始。
- 允许生活有余量：并非每件旧物都象征主题，并非每个细节都在终幕回收，并非每句闲话都承担线索功能。细节首先属于人物的日常、关系和当时的注意力。
- 线索只证明可观察事实，不替玩家写道德结论；关键材料要容许误读、用途变化和延迟重释。
- 当一场戏被设计为正面冲突，张力来自不可兼容：两个人不能在不牺牲对方的情况下同时得到想要的东西，拖延会继续涨价，行动会关闭退路。仅有争吵、秘密或“矛盾点”不算冲突。非冲突场可以通过误解、错过、共同克制、合作、假胜利或安静重估改变关系，不得硬套同一公式。
- 每幕至少保留一项会制造明确赢家与受损者的关键主动行为，并给受损者留下报复、揭露、截胡、抬价、换边或拒绝合作的反制窗口；探索、合作和关系缓冲不必强造受害者，但必须有具体成本或后续变化。“讨论后共同投票”“大家分别表态”“协商出折中方案”不得成为连续多幕的唯一玩法。
- 不确定性不等于真相含糊或终幕空降。事实应能还原；真正开放的是人物为何那样做、玩家愿意相信谁、以及他们肯用什么代价把哪一种事实变成公共版本。
- 结局结算人物已经做出的事及其具体后果，不替作者完成一篇中心思想，也不把所有立场配平成“每个人都有道理”。允许失败、决裂、冤屈和无人被原谅；禁止自动安排大团圆。`;

export const HUMAN_PROSE_BLOCK = `【真人化正文 · 叙述权交还给人物】
- 角色本正文必须先有“正在发生的场景”：具体地点、在场关系、可见动作或原话，以及离场前能观察到的变化。冲突场可以有未解决的索取/拒绝；其他场可以由误解、错过、克制、合作、假胜利或安静重估推进。若一段只能概括成“作者告诉玩家这个人怎么想”，该段不得进入正文。
- 角色档案里的“真实处境、欲望、底线、失败代价、内在矛盾、关系债、误读、可隐瞒事实”是创作侧检查答案，不是玩家本标题或人物自述。正文写完后用这些字段反查玩家能否从经历中理解，禁止在开头把它们浓缩成说明书。
- 信息矩阵是事实边界，不是段落提纲。禁止把每个字段依次换成第一人称句子，也禁止在一段内完成“事实、权利边界、三个条件、选择后果”的整套交付。场景可以暂时漏掉已知信息；人物不负责替系统保证覆盖率。
- 若一段删掉人物姓名后可以无损还原成表格、合同摘要或策划说明，它不是玩家正文。退回场景，先写谁正向谁要什么、对方为什么此刻不肯，再允许一部分事实从冲突里露出来。
- 硬性禁用自我诊断旁白：“你一直/总是这样告诉自己”“你终于明白”“直到这一刻你才意识到”，以及“不是……。你只是/其实……”式先否定再解释。这些句子不是留白，而是在替玩家理解人物；应删除或改成现场动作与对话。
- 第一人称也不能成为作者解释人物的通行证。禁止“我之所以这样做，是因为……”“我知道自己为什么……”“我很清楚自己真正想要/害怕的是……”等事后归因。角色可以当场想错、嘴硬或改口，不需要向自己复述人物小传、动机说明和性格结论。
- 叙述者只写当前视角能注意、误解和回避的东西。不要在画面、动作或对白之后立刻解释“这意味着什么”；让含义晚一场、晚一幕甚至到复盘才出现。
- 少写抽象判断，多写选择造成的麻烦。但不要把“抽象情绪”机械替换成机油味、手指发抖、杯壁发烫等通用感官模板；细节必须来自这个人的长期习惯，并真正影响动作。
- 不追求句句漂亮。允许句子因人物犹豫而中断，因羞耻而绕开重点，因关系亲疏而使用只有两个人明白的旧称呼；不要把每段结尾都写成金句或象征物特写。
- 控制“不是……而是……”“起初……后来……”“真正的……”“这意味着……”等论证句式。偶尔符合人物口气可以使用，连续出现就说明作者在替人物总结。
- 对白不是轮流陈述立场。人物可以没听懂、答非所问、记错、改口、只回答对自己有利的一半；同一场谈话不必让各方观点完整闭环。
- 禁止把交谈剪成固定的“提问—几个字回答—追问—报数字”：连续三句短对白不得各自独立成段。短答只有在沉默、打断或权力压迫确实发生时才单独落段；其余应放回完整话语和动作里。
- 对话不能只负责把作者已经设计好的数值依次报给玩家。人物说钱、期限和责任时，也会护短、算旧账、试探关系、故意含混或先纠正对方的称呼；不得人人都像在填写同一张客服问答表。
- 每个角色必须有自己的“语言权限”：年龄、职业、教育、关系亲疏决定他熟悉哪些词、会把什么说错、哪些事只能用生活经验讲。除非档案有依据，不得让厨师、维修工、平台工与企业负责人同样熟练地分析法律边界、合同效力和方案风险；事实一致不等于人人使用同一种准确术语。
- 角色说出偏激、刺耳或政治不正确的话时，不要立刻安排另一个人代表作者纠正；让这句话先改变房间里的关系，并在后续行动中承担后果。
- 不用旁白给每个人补一半道理来显得复杂。复杂来自欲望、认识和行为互相冲突，并在后续场景付出代价。
- 段落节奏服从当下意识与动作，不采用自动化的“一句一段 + 三段排比 + 象征收尾”。同一篇中应有密、有疏、有笨拙处，也有刻意不说透的空白。
- 禁止把每一段加工成近似长度、每段固定三四句、依次执行“动作—解释—对白—点题”。长短段落必须由现场变化决定：一次争执可以挤在同一段里，一件不愿细想的旧事也可以突然停下；不能像按模具切块。
- 禁止连接词堆叠不等于删除连接。时间跨越、因果承接、预期落空和人物改口必须让读者跟得上；该用“后来、等到、不过、可、所以、偏偏、这时”时正常使用。不要每段都用同一个词开头，也不要把自然连接全部换成动作硬切或无缘无故换场。
- 不得为了制造行当感擅自压缩或发明读者无法从上下文理解的短词。职业身份和人物声线不提供造词权；所有精确行业词必须通过独立的 terminologyGroundingContract 溯源。
- 禁止省掉必要谓语、只留下貌似利落的名词块。人物口语可以吞字，叙述不能靠随机缺词冒充行话；应写成当下视角自然会说的完整表达，说明哪里发生了什么、怎样影响下一步。
- 禁止用上一段的关键词换一个主语再回扣成金句，例如前文写“提交码只认账号”，下一段就写“我的章也只认我”。这种对称句不是人物说话，是作者在展示句法。
- 玩家正文首先是一段被活过的人生，不是任务说明书。任务和机制另列；正文应让玩家自然生出行动理由，不反复写“你需要、你必须、你的目标是”。
- 玩家正文禁止用“我可以……也可以……还可以……”逐项罗列可选策略及利弊。选项、资源和结算条件放在独立机制字段；正文只写人物眼前看见什么、舍不得什么、正在拖延哪一个动作，让玩家自己发现策略。`;

export const HUMAN_REWRITE_BLOCK = `【结构性真人化编辑 · 不是文学喷漆】
- 允许删除解释句、合并或拆开段落、打破排比、把过早说出的结论留到后文；不是只替换几个高频词。
- 保持既有事实、事件先后、知识边界、线索权限和人物关系，不得为了“更像真人”发明新经历或新物件。
- 若原段核心只是人物轮流讨论命题，局部改写无法修复：保留事实但缩短论辩，并在 suggestions 写明 upstream_rebuild，指出应退回哪一场重新设计行动与后果。
- 不强行把每个抽象感受改成身体反应；优先寻找人物当下做错、漏看、嘴硬、改口或不肯做的事情。
- 命中短对白阶梯时必须重写整段会话，不能只把四句对白并到同一段。补回人物真实会说的限定、旧称呼、推脱和未回答部分，允许信息晚一点才拼全。
- 命中整齐段落节拍时，不得只随机加长或删短句子；先确认每一段发生了什么变化，再按动作是否连续重新并段或断段。删除无意义的名词残句与未登记行话，不能换成另一批更冷僻的词。
- 命中转折/承接不足时，只在真实发生时间推进、因果变化、预期落空或话题转向的位置补连接；不得机械轮换“然而、与此同时、于是”给每段装路标。
- 改写后仍应有不被旁白解释的含义空隙；禁止用更漂亮的金句重新封口。`;

export const HUMAN_REVIEW_BLOCK = `【反 AI 母体审查 · 必须单独判断】
逐项检查的不是几个套话，而是文本的生成骨架：
1. 前 10% 是否已经宣布议题、阵营和最终道德方向，使后文只剩举例证明；
2. 角色是否可被一一翻译成观点或社会类别，人物之间是否被过度配平；
3. 世界规则、案件与稀缺资源是否专门为一个哲学两难题搭台，而非从人物历史中生长；
4. 旁白是否在动作、对白、旧物之后立即解释意义，剥夺读者误读和迟到理解的空间；
5. 每个物件是否都被赋予象征、每段是否都以总结或金句收尾，生活没有无用余量；
6. 各角色是否共享同一种分幕配方、句长、感官反应、秘密数量和弧光节拍；
7. 正文是否只在包装 tasks，玩家没有从关系和处境中自发行动的理由。
8. 是否出现“你一直这样告诉自己”“你终于明白”“不是……你只是……”等作者代替角色完成自我诊断的句子；是否能删掉这些句子而不损失任何可观察事实。
9. 是否反复用“问一句—答几个字—再问—再报数”的短对白阶梯传递设定；是否有人答非所问、绕开难堪、说出关系语气。
10. 是否在段末把上一段关键词换成“我/我的……也……”重新说一遍，制造整齐的回扣金句。
11. 是否在正文中用“我可以……也可以……”替玩家列出策略菜单、完整分析各选项利弊，导致玩家只需照作者答案执行。
12. 遮掉人名后，能否仍从词汇、句法、误解方式和不肯说出口的内容判断是谁；若所有角色都像同一名合同顾问，必须退回角色语言权限重写。
13. 引号外是否从选定的“我”切成“你”，或从“你”切成“我”；第一人称是否只是把作者分析前面加了一个“我”。两种情况都不是沉浸，必须整段重写。
14. AI 是否又把养老退休、人员失踪失联、旧单位改制和福利补偿分配当成“现实题材”的默认答案；换名、换年代或换机构不算新题材。
15. 所谓公平是否把收益、损失、戏份和道德判断全部配平，导致没有人能踩着另一个人的损失获利；每幕是否只剩讨论、表态和共同投票，没有背叛、截胡、逼迫与可执行反制。
16. 一句话梗概是否只说明全桌最后决定什么，却没有说明玩家将亲自经历什么。
17. 是否先分配“每人一项不可替代权限”，再把职业、创伤和关系粘到六枚权限上；所谓非对称是否其实只是六张否决票。
18. 核心玩法是否可以无损搬到公司、医院、剧组、实验室或直播间，只需替换行业名词。
19. 是否存在一个不依赖中心思想也值得次日复述的具体场面，以及至少两种能改变后续现实的世界专属动作。
20. 精确行业词、工序词、部件名、制度简称与旧规矩能否逐项追溯到作者素材、已确认物料或术语合同；是否仅因人物职业、声线或时代氛围而被擅自发明。来源不明不是“文风问题”，应判为世界事实幻觉并退回重写。
21. 是否所有场景都只服务主线、每段回忆都解释案件、每个物件都是伏笔、每句闲聊都承担信息；人物是否从不记错、逃避、换话题或做无用但属于自己的事。高度闭环不是天然优点，过度功能化会让人生变成设计图。
若 1～3 任一项严重成立，必须判为上游结构问题，不能建议“润色、增加细节、对白口语化”后直接通过。`;

const countMatches = (text, pattern) => (String(text || "").match(pattern) || []).length;

/**
 * Heuristic advisory only. It identifies thesis-first narration patterns for review routing;
 * it is deliberately not a hard rejection gate because quotations and period language vary.
 */
export function scanThesisFirstAdvisory(text) {
  const raw = String(text || "");
  const opening = raw.slice(0, 900);
  const hits = [];

  if (/后来的人们.{0,30}(?:回忆|谈起|说起)|多年以后.{0,30}(?:才|人们)/s.test(opening)) {
    hits.push("未来回望式开场先替故事定性");
  }
  if (/(?:最早|起初|一开始).{0,80}(?:人们|所有人|大家).{0,40}(?:相信|以为|认为)/s.test(opening)) {
    hits.push("起初/后来式议题摘要开场");
  }
  if (/这是一个关于|这个故事(?:讲述|讨论)|真正(?:需要|重要|可怕|公平)的(?:并)?不是/s.test(opening)) {
    hits.push("开场直接宣布中心思想");
  }

  const thesisTransitions = countMatches(raw, /(?:起初|最初|后来|直到|这意味着|这说明|真正的|归根结底)/g);
  if (thesisTransitions >= 6) hits.push(`论证转接词过密(${thesisTransitions})`);

  const balancedContrasts = countMatches(raw, /不是[^。！？\n]{1,36}而是/g);
  if (balancedContrasts >= 4) hits.push(`“不是…而是…”判断句过密(${balancedContrasts})`);

  const positionMapping = countMatches(raw, /(?:一方|另一方|代表|支持者|反对者|理性派|感性派).{0,30}(?:认为|会问|主张|坚持)/g);
  if (positionMapping >= 3) hits.push(`人物/阵营被写成观点席位(${positionMapping})`);

  const explainedImages = countMatches(raw, /(?:这|那)(?:不是|并非).{0,30}(?:而是|更像)|(?:这|那)(?:意味着|说明|提醒着)/g);
  if (explainedImages >= 5) hits.push(`意象后即时解释过密(${explainedImages})`);

  return {
    passed: hits.length === 0,
    advisory: true,
    hits
  };
}
