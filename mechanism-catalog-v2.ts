/**
 * 织幕机制成品目录 mechanism-catalog-v2.ts
 *
 * 依据：《织幕_机制成品设计库_V2.1_剧情原生机制补全版.md》（只读备份库）
 *
 * 定位：本模块是**只读 JSON 机制主模块（V2.1 成品层）**。V2.1 在 V2.0 十个家族基础上
 * 新增 M11 世界状态/现场改写/因果传播，并补 M01-10、M07-8 与跨机制组合协议 mechanism_chain。
 * 共 76 个可选择、可配置的具体机制（39 成品模板 + 37 剧情合同）。
 *
 * 两种生产方式（§0）：
 *  - READY_TEMPLATE 成品模板：规则与异常出口预写好，用户只选模板/时长/公开名/数值档/奖励映射。
 *  - STORY_CONTRACT 剧情合同：依赖客观事件/人物/阶段信息，逐项填写确认，禁止通用故事模板补齐。
 *
 * 创作用途（MechanismRole，与 kind 正交）：
 *  - GAME_MECHANISM（M02–M06、M09）：幕内玩法；runtime 主体冻结。
 *  - STORY_MECHANISM（M01、M07、M08、M10、M11）：母稿剧情骨架；先做叙事生产模板。
 *
 * 对外能力：
 *  - TEMPLATES：76 个成品项（template_id, family_id, nature, kind, ...）。
 *  - ATOMIC_EFFECTS：§第三部分 原子效果库（33 条，含 ENTITY_*、STATE_*、PERMISSION_* 等）。
 *  - CHAIN_PROTOCOL：§1.4 跨机制组合协议 mechanism_chain。
 *  - selectByKind(query)：按 kind/nature/family/人数/时长档程序筛选候选项。
 *  - getTemplate(id)：按 template_id 取唯一成品项。
 *  - DURATION_TIERS / PLAYER_ADAPTATION：§4.1/§4.2 模板参数兼容。
 *
 * 本文件不发起任何网络请求，不读写文件，所有导出均为纯数据/纯函数。
 * 机制正文不喂给模型；程序只用于筛选与校验。
 */

export type V2Kind = "READY_TEMPLATE" | "STORY_CONTRACT";
export type V2Nature = "PURE_GAME" | "STORY_BOUND" | "HYBRID";
export type ParticipationMode = "ALL" | "OPEN_ENTRY" | "TEAM_BY_RULE" | "STATE_QUALIFIED";
export type DurationTier = "QUICK" | "STANDARD" | "EXTENDED" | "STORY_MAJOR";

/**
 * 创作流程用途（与 kind/nature 正交）：
 * - GAME_MECHANISM：幕内可插拔玩法；主体 runtime 已冻结，只补 Placement/Intro/Outcome。
 * - STORY_MECHANISM：母稿剧情骨架；先做叙事生产模板，不做 runtime。
 */
export type MechanismRole = "GAME_MECHANISM" | "STORY_MECHANISM";

export type FamilyId =
  | "M01" | "M02" | "M03" | "M04" | "M05" | "M06" | "M07" | "M08" | "M09" | "M10" | "M11";

/** 家族 → 用途标签（ID 不变，只加用途）。 */
export const FAMILY_MECHANISM_ROLE: Readonly<Record<FamilyId, MechanismRole>> = Object.freeze({
  M01: "STORY_MECHANISM",
  M02: "GAME_MECHANISM",
  M03: "GAME_MECHANISM",
  M04: "GAME_MECHANISM",
  M05: "GAME_MECHANISM",
  M06: "GAME_MECHANISM",
  M07: "STORY_MECHANISM",
  M08: "STORY_MECHANISM",
  M09: "GAME_MECHANISM",
  M10: "STORY_MECHANISM",
  M11: "STORY_MECHANISM",
});

export function mechanismRoleForFamily(familyId: FamilyId): MechanismRole {
  return FAMILY_MECHANISM_ROLE[familyId];
}
/** 剧情绑定层（§1.2）：只做展示/来源/奖励/下一阶段映射，不得改写模板的规则。 */
export interface StoryBindingV2 {
  display_name: string;
  short_intro: string;
  source_fact_ids: string[];
  source_content_ids: string[];
  source_state_ids: string[];
  world_state_refs: string[];
  reward_mapping: string[];
  next_stage_mapping: string[];
}

/** 跨机制组合协议 mechanism_chain（§1.4）：只连接正式结算码/正式资源/正式状态，不读取普通谈话。 */
export interface MechanismChainV2 {
  chain_id: string;
  upstream_instance_id: string;
  trigger_on: "SETTLEMENT_CODE" | "STATE_CHANGE" | "RESOURCE_THRESHOLD";
  trigger_condition: Record<string, unknown>;
  downstream_instance_id: string;
  downstream_action: "OPEN" | "GRANT_PERMISSION" | "FEED_INPUT" | "APPLY_PRESET_STATE";
  payload_fields: string[];
  fallback_mapping: Record<string, unknown>;
}

export const CHAIN_PROTOCOL: ReadonlyArray<string> = Object.freeze([
  "上游输出与下游输入必须在开局前完成字段映射，下游机制本身也必须预先存在",
  "GRANT_PERMISSION 只开放下游已定义的合法操作，不允许现场生成新能力",
  "一个链条可以有多个出口，但不得形成无终止条件的循环依赖",
  "后续必需机制不得只依赖一个竞争性胜者；上游无人达成时必须配置公共或低档备用入口",
]);

/** 每套机制内置的通用异常状态码（§1.3）。 */
export const UNIVERSAL_EXCEPTION_CODES: ReadonlyArray<string> = Object.freeze([
  "NORMAL",
  "PARTIAL_SUBMISSION",
  "NO_SUBMISSION",
  "TIMEOUT",
  "DISCONNECTED",
  "TIE",
  "INVALID_ACTION",
  "EARLY_FINISH",
  "ABORTED_BY_TECHNICAL_FAILURE",
]);

/** V2.0 成品项统一结构。可选字段仅在文档该子型确有说明时填写。 */
export interface MechanismTemplateV2 {
  kind: V2Kind;
  template_id: string;
  family_id: FamilyId;
  name: string;
  default_name: string;
  nature: V2Nature;
  participation_mode: ParticipationMode;
  player_count: { min: number; max: number };
  duration_presets: Array<{ tier: DurationTier; minutes: string; structure: string }>;
  default_config: string;
  legal_actions: string[];
  round_flow: string[];
  settlement_rules: string[];
  tie_rule: string;
  timeout_rule: string;
  reconnect_rule: string;
  host_permissions: string[];
  online_components: string[];
  output_fields: string[];
  editable_parameters: string[];
  locked_rules: string[];
  exception_notes: string[];
  builtin_exception_codes: ReadonlyArray<string>;
  /** 创作用途：GAME=幕内玩法；STORY=母稿骨架。由家族映射注入，不改 template_id。 */
  role: MechanismRole;
  /** STORY_CONTRACT 特有 */
  required_fields?: string[];
  production_rules?: string[];
  verification_rules?: string[];
  story_binding?: StoryBindingV2;
}

/* ---------------- 小工具（仅拼装，不引入业务逻辑） ---------------- */

const E = UNIVERSAL_EXCEPTION_CODES as ReadonlyArray<string>;

/** 成品模板兜底时长档（按 §4.2 档位粗分，实际由 default_config 细化）。 */
function rt(
  template_id: string,
  family_id: FamilyId,
  react: Omit<MechanismTemplateV2, "template_id" | "family_id" | "role">,
): MechanismTemplateV2 {
  return {
    template_id,
    family_id,
    role: FAMILY_MECHANISM_ROLE[family_id],
    ...react,
    builtin_exception_codes: E,
  };
}

/* ==================== 第一部分：成品模板（READY_TEMPLATE，39 项） ==================== */

const READY_TEMPLATES: MechanismTemplateV2[] = [
  /* -------- M02 交易与交换 -------- */
  rt("M02-1", "M02", {
    kind: "READY_TEMPLATE", name: "自由交换", default_name: "双确认交易所", nature: "PURE_GAME",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STANDARD", minutes: "20", structure: "全员参与；每人0—6项可转移资源" }],
    default_config: "全员参与，20分钟；每人0—6项可转移资源；资源允许没有用途，也允许最终留在原持有人手中。",
    legal_actions: ["提出", "修改", "撤回", "接受", "拒绝"],
    round_flow: ["玩家公开或私下协商", "一方建立交易单", "选择立即转移/阶段末履约", "另一方核对", "双方确认", "服务器原子转移"],
    settlement_rules: ["倒计时结束关闭新建交易", "已双确认的阶段末交易统一执行", "余额不足则整单失败，不做部分扣除"],
    tie_rule: "不需要", timeout_rule: "倒计时结束关闭新建交易", reconnect_rule: "掉线前已确认的交易有效；单方确认无效",
    host_permissions: ["查看成交记录", "结束交易阶段"],
    online_components: ["资源栏", "交易单", "确认弹窗", "成交记录", "限时双人语音房"],
    output_fields: ["最终归属", "成交次数", "未履约交易码"],
    editable_parameters: ["时长", "资源是否公开", "每人并行交易单上限", "是否允许赠送"],
    locked_rules: ["必须双确认", "平台只记正式成交", "不得为推动剧情强制撮合"],
    exception_notes: ["单方确认无效", "同一资源被多单占用时，以第一张双确认交易锁定"],
  }),
  rt("M02-2", "M02", {
    kind: "READY_TEMPLATE", name: "固定比率兑换", default_name: "公共兑换台", nature: "PURE_GAME",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "QUICK", minutes: "15", structure: "三种基础资源；每人最多兑换3次" }],
    default_config: "15分钟；三种基础资源；每人最多兑换3次；公共库存有限。",
    legal_actions: ["查看比率与库存", "选择投入", "预览所得", "确认", "兑换"],
    round_flow: ["查看比率与库存", "选择投入", "预览所得", "确认", "立即扣除和发放"],
    settlement_rules: ["库存耗尽结束", "个人次数用尽结束", "倒计时结束", "未使用资源不自动折算"],
    tie_rule: "不需要", timeout_rule: "倒计时结束", reconnect_rule: "并发请求由服务器顺序锁定库存",
    host_permissions: ["设置比率档位", "设置库存与开放阶段"],
    online_components: ["兑换矩阵", "剩余库存", "个人次数", "成交回执"],
    output_fields: ["最终持仓", "兑换次数", "库存"], editable_parameters: ["比率", "库存", "次数", "开放阶段"],
    locked_rules: ["比率不得由主持人中途修改", "兑换台不能成为后续唯一必要内容的唯一入口"],
    exception_notes: ["并发请求由服务器顺序锁定库存", "扣除与发放必须同一事务完成"],
  }),
  rt("M02-3", "M02", {
    kind: "READY_TEMPLATE", name: "双边密议交易", default_name: "限时密谈", nature: "PURE_GAME",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STANDARD", minutes: "20", structure: "每人最多发起2次/接受2次密谈；单次3分钟" }],
    default_config: "20分钟；每人最多发起2次、接受2次密谈；单次3分钟；主房计时不暂停。",
    legal_actions: ["邀请", "接受", "拒绝", "进入语音房", "建立交易单", "双确认"],
    round_flow: ["邀请", "对方接受", "进入临时语音房", "任一方建立交易单", "双确认或计时结束", "返回主房"],
    settlement_rules: ["只结算交易单，不记录或执行口头承诺"],
    tie_rule: "不需要", timeout_rule: "单次密谈计时结束返回主房", reconnect_rule: "掉线后保留45秒席位，超时自动返回主房",
    host_permissions: ["查看邀请队列", "设置次数与房间时长"],
    online_components: ["邀请队列", "语音房倒计时", "交易单", "拒绝与屏蔽重复邀请"],
    output_fields: ["成交交易单", "未确认交易码"], editable_parameters: ["次数", "房间时长", "是否允许旁听者"],
    locked_rules: ["不能让全桌等待一组谈话", "不得分析或保存语音内容"],
    exception_notes: ["被邀请者15秒未回应视为拒绝", "未确认交易作废"],
  }),
  rt("M02-4", "M02", {
    kind: "READY_TEMPLATE", name: "公共报价板", default_name: "开放市场", nature: "PURE_GAME",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STANDARD", minutes: "25", structure: "每人最多3条有效报价" }],
    default_config: "25分钟；每人最多3条有效报价；报价可指定固定交换或接受替代报价。",
    legal_actions: ["发布提供/希望获得", "一键接受", "提交反报价", "确认成交", "撤回报价"],
    round_flow: ["发布提供/希望获得", "其他人一键接受或提交反报价", "原发布者确认", "成交并关闭关联报价"],
    settlement_rules: ["阶段结束撤销未成交报价", "已成交结果永久保留"],
    tie_rule: "不需要", timeout_rule: "阶段结束撤销未成交报价", reconnect_rule: "掉线后报价状态按服务器为准",
    host_permissions: ["设置报价公开范围", "结束报价阶段"],
    online_components: ["筛选报价板", "反报价抽屉", "个人资源", "成交历史"],
    output_fields: ["成交记录", "保留报价"], editable_parameters: ["报价公开范围", "有效条数", "是否隐藏发布者"],
    locked_rules: ["平台不显示推荐交换对象或资源价值", "没有买方不是异常"],
    exception_notes: ["资源被其他交易消耗后相关报价自动标记失效", "不能出现负库存"],
  }),
  rt("M02-5", "M02", {
    kind: "READY_TEMPLATE", name: "受限转移", default_name: "一次传递", nature: "PURE_GAME",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "QUICK", minutes: "15", structure: "每项特殊资源最多转移一次" }],
    default_config: "15分钟；每项特殊资源最多转移一次；支持赠送、交换、借用三种合同。",
    legal_actions: ["选择资源", "选择合同类型(赠送/交换/借用)", "选择对象", "确认转移"],
    round_flow: ["选择资源", "选择合同类型", "选择对象", "对方确认", "写入归属与剩余转移次数"],
    settlement_rules: ["借用物在阶段末自动返还", "已消耗的借用物不返还但记录消耗者", "赠送与交换永久生效"],
    tie_rule: "不需要", timeout_rule: "阶段末执行返还/消耗/永久转移", reconnect_rule: "掉线按未确认处理",
    host_permissions: ["设置次数与容量", "设置返还节点"],
    online_components: ["资源栏", "合同类型选择", "转移记录"],
    output_fields: ["当前持有人", "剩余转移次数", "归属变更记录"],
    editable_parameters: ["次数", "容量", "是否允许借用", "返还节点"],
    locked_rules: ["普通叙事信息不进入此系统", "只有具有机制状态的资源才登记"],
    exception_notes: ["接收方容量已满则拒绝"],
  }),
  rt("M02-6", "M02", {
    kind: "READY_TEMPLATE", name: "共享资源池", default_name: "公共储备", nature: "PURE_GAME",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STANDARD", minutes: "20", structure: "共4轮，同时提交；公共目标分三级" }],
    default_config: "20分钟；公共目标分三级；个人每轮可投入0—2或取出0—1；共4轮，同时提交。",
    legal_actions: ["选择投入", "选择取出", "不动", "提交"],
    round_flow: ["查看池状态", "秘密选择投入/取出/不动", "统一结算", "公开池总量与个人资源变化", "进入下一轮"],
    settlement_rules: ["按最终池量映射A/B/C/D四档结果", "不足不会阻断下一阶段"],
    tie_rule: "不需要", timeout_rule: "统一结算时对未提交采用默认", reconnect_rule: "掉线沿用服务器已接收状态",
    host_permissions: ["设置初始池", "设置轮数与阈值"],
    online_components: ["公共池状态", "投入条", "轮次进度"],
    output_fields: ["池总量", "个人资源变化", "档位结果"],
    editable_parameters: ["初始池", "轮数", "阈值", "个人操作上限", "是否公开个人贡献"],
    locked_rules: ["不得设置只有满额才继续", "不得把拒绝投入直接视为剧情立场"],
    exception_notes: ["多人取出超过库存时按等比例满足", "余数由服务器随机序列决定并公开日志"],
  }),

  /* -------- M03 竞价与拍卖 -------- */
  rt("M03-1", "M03", {
    kind: "READY_TEMPLATE", name: "公开递增竞价", default_name: "明拍", nature: "PURE_GAME",
    participation_mode: "OPEN_ENTRY", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "QUICK", minutes: "8/标的", structure: "起拍价2；最小加价1；有效出价补时15秒" }],
    default_config: "单标的8分钟；起拍价2；最小加价1；每次有效出价将剩余时间补至15秒。",
    legal_actions: ["出价", "放弃"],
    round_flow: ["展示规则与标的编号", "公开出价", "领先者与价格实时更新", "无人继续出价", "成交"],
    settlement_rules: ["最高有效价扣除资源并获得预设奖励", "无人出价进入流拍结果"],
    tie_rule: "同时最高由服务器时间决定先后", timeout_rule: "倒计时结束成交", reconnect_rule: "掉线不改变已冻结出价的效力",
    host_permissions: ["设置起拍价与加价幅度", "开拍前绑定标的结果"],
    online_components: ["实时价格", "领先者", "出价按钮", "倒计时"],
    output_fields: ["中标者", "成交价", "流拍码"], editable_parameters: ["起拍价", "加价幅度", "补时长度", "是否公开余额"],
    locked_rules: ["不得由客户端时间决定胜负", "标的结果在开拍前绑定"],
    exception_notes: ["出价时即冻结金额", "新高价出现后释放旧领先者冻结额"],
  }),
  rt("M03-2", "M03", {
    kind: "READY_TEMPLATE", name: "密封报价", default_name: "暗标", nature: "PURE_GAME",
    participation_mode: "OPEN_ENTRY", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "QUICK", minutes: "5提交", structure: "每人一次报价；第二价格规则" }],
    default_config: "5分钟提交；每人一次报价；采用第二价格规则：最高者获胜，支付第二高价加1，上限不超过本人报价。",
    legal_actions: ["提交报价", "截止前修改"],
    round_flow: ["查看标的", "秘密提交", "允许截止前修改", "统一开标", "公布胜者、支付额和匿名报价分布"],
    settlement_rules: ["按第二价格规则决定归属与支付额"],
    tie_rule: "最高价相同时，平价者进入30秒二次密封报价；再次平票由预先服务器随机种子决定",
    timeout_rule: "未提交视为0", reconnect_rule: "掉线不影响已提交报价",
    host_permissions: ["无权查看实时值", "开启开标"],
    online_components: ["报价输入", "开标结果", "匿名报价分布"],
    output_fields: ["胜者", "支付额", "报价分布"], editable_parameters: ["第一价格/第二价格", "是否公布全部报价", "二次竞价次数"],
    locked_rules: ["结算前不可读取他人报价", "主持人无权查看实时值"],
    exception_notes: ["未提交视为0", "余额不足的报价无法提交"],
  }),
  rt("M03-3", "M03", {
    kind: "READY_TEMPLATE", name: "降价竞拍", default_name: "时钟降价", nature: "PURE_GAME",
    participation_mode: "OPEN_ENTRY", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "QUICK", minutes: "12档", structure: "价格每8秒下降1档" }],
    default_config: "价格每8秒下降1档，共12档；第一名点击并经服务器确认者成交。",
    legal_actions: ["等待降价", "购买确认"],
    round_flow: ["显示当前价与下一次降价时间", "玩家等待或购买", "首个合法购买锁定"],
    settlement_rules: ["成交或最低价结束流拍"],
    tie_rule: "首个经服务器确认者成交", timeout_rule: "价格降至最低值结束流拍", reconnect_rule: "延迟超过阈值时显示连接风险但不补偿重拍",
    host_permissions: ["设置价格序列与最低价"],
    online_components: ["当前价", "倒计时", "购买按钮"],
    output_fields: ["成交者", "成交价", "流拍码"], editable_parameters: ["价格序列", "间隔", "最低价", "是否允许预设自动购买价"],
    locked_rules: ["禁止客户端先到先得判定"],
    exception_notes: ["使用服务器接收时间", "重大技术故障整轮作废并按原种子重开"],
  }),
  rt("M03-4", "M03", {
    kind: "READY_TEMPLATE", name: "多标的连续竞价", default_name: "连续拍卖会", nature: "PURE_GAME",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STANDARD", minutes: "4—6/件", structure: "4件标的；共享同一预算" }],
    default_config: "4件标的，每件4—6分钟；玩家共享同一预算；标的顺序开局公开。",
    legal_actions: ["出价", "弃拍"],
    round_flow: ["逐件展示", "竞价", "成交/流拍", "记录预算", "下一件"],
    settlement_rules: ["每件独立归属", "最后输出资产和剩余预算", "无人必须获得标的"],
    tie_rule: "单件不返场；按单件规则", timeout_rule: "单件时间结束进入下一件", reconnect_rule: "掉线保留既有预算与已获标的",
    host_permissions: ["设置件数", "设置预算与标的公开程度"],
    online_components: ["标的列表", "预算栏", "逐件竞价"],
    output_fields: ["资产", "剩余预算"], editable_parameters: ["件数", "竞价方式", "预算", "标的公开程度"],
    locked_rules: ["不得在看到购买结果后调换后续奖励", "不得平均分配避免垄断"],
    exception_notes: ["前一件技术失败只重开该件", "已经成交的项目不回滚"],
  }),
  rt("M03-5", "M03", {
    kind: "READY_TEMPLATE", name: "非货币竞价", default_name: "权限竞价", nature: "PURE_GAME",
    participation_mode: "STATE_QUALIFIED", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "QUICK", minutes: "按标的", structure: "使用行动次数/保护标记/下一阶段权限出价" }],
    default_config: "玩家使用行动次数、保护标记或下一阶段公开权限等可验证状态出价。",
    legal_actions: ["提交组合报价", "放弃"],
    round_flow: ["平台只显示允许作为支付的状态", "提交组合报价", "按公开换算分比较", "胜者支付全部承诺状态"],
    settlement_rules: ["先冻结支付，再发放标的", "无法原子执行则整单失败并顺位给下一合法报价"],
    tie_rule: "按公开换算分比较", timeout_rule: "未能原子执行顺位给下一合法报价", reconnect_rule: "掉线冻结状态按服务器为准",
    host_permissions: ["设置可支付状态与换算表"],
    online_components: ["可支付状态列表", "组合报价表单", "换算分"],
    output_fields: ["胜者", "支付状态", "标的归属"], editable_parameters: ["可支付状态", "换算表", "单项上限"],
    locked_rules: ["口头承诺、未来表演和无法核验的行为不能作为支付物"],
    exception_notes: [],
  }),

  /* -------- M04 桌面竞赛与现场游戏 -------- */
  rt("M04-1", "M04", {
    kind: "READY_TEMPLATE", name: "点数牌局", default_name: "二十一点成品版", nature: "PURE_GAME",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STANDARD", minutes: "20—30", structure: "全员10点耐久；最多5轮" }],
    default_config: "全员10点耐久；最多5轮；每轮每人起始两张牌，可选择要牌或停牌；超过21点本轮失败。",
    legal_actions: ["要牌", "停牌"],
    round_flow: ["每轮每人起始两张牌", "选择要牌或停牌", "庄家按固定规则行动", "结算损失", "进入下一轮"],
    settlement_rules: ["胜庄家造成2点损失，平局不变，败者损失3点", "天然21令庄家额外损失1点", "5轮后按耐久、胜轮数、累计有效点数依次排名"],
    tie_rule: "平局不变", timeout_rule: "轮限保证20—30分钟结束", reconnect_rule: "掉线者自动执行点数≥17停牌否则要牌",
    host_permissions: ["查看逐轮日志"],
    online_components: ["牌桌", "私人手牌", "公共庄家牌", "耐久条", "行动倒计时", "逐轮日志"],
    output_fields: ["耐久", "胜轮数", "累计有效点数", "排名"], editable_parameters: ["初始耐久", "轮数", "损失值", "庄家规则", "奖励名次"],
    locked_rules: ["随机序列、越界判定、掉线策略不可临场改动"],
    exception_notes: ["牌堆由服务器种子产生", "耐久归零者停止抽牌但进入观察状态"],
  }),
  rt("M04-2", "M04", {
    kind: "READY_TEMPLATE", name: "承受值竞赛", default_name: "极限耐受", nature: "PURE_GAME",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STANDARD", minutes: "6轮", structure: "每人承受上限10；每轮秘密选择0—3级挑战" }],
    default_config: "每人承受上限10；6轮；每轮秘密选择0—3级挑战，成功获得同值积分，失败增加同值加1的承受；承受达到10退出挑战。",
    legal_actions: ["选择0—3级挑战", "使用保护", "退出", "观战预测"],
    round_flow: ["秘密选择挑战等级", "统一判定", "累加积分或承受", "达到上限退出"],
    settlement_rules: ["积分最高获胜", "平分比较剩余承受空间再比较成功的最高等级"],
    tie_rule: "平分比较剩余承受空间，再比较成功的最高等级", timeout_rule: "超时按未提交处理", reconnect_rule: "掉线按本轮默认处理",
    host_permissions: ["设置轮数与概率表"],
    online_components: ["承受条", "选择界面", "观察预测栏"],
    output_fields: ["积分", "承受", "排名"], editable_parameters: ["轮数", "概率表", "上限", "保护次数"],
    locked_rules: ["仅为虚拟数值，不要求现实饮酒或危险动作"],
    exception_notes: ["1级必成，2级75%，3级50%；每人有一次保护", "退出者仍可观看并预测"],
  }),
  rt("M04-3", "M04", {
    kind: "READY_TEMPLATE", name: "同时选择", default_name: "三式博弈", nature: "PURE_GAME",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STANDARD", minutes: "7轮", structure: "每人三种姿态各最多用3次" }],
    default_config: "7轮；每人持进取、固守、迂回三种姿态，各姿态最多用3次；统一提交。",
    legal_actions: ["选择姿态", "选择公开目标", "提交"],
    round_flow: ["秘密选择姿态与目标", "统一提交", "统一公开并处理关系", "累计积分"],
    settlement_rules: ["进取胜迂回、迂回胜固守、固守胜进取", "克制成功得2分，同姿态各得1分，被克制0分"],
    tie_rule: "比较剩余姿态多样性，再比较被选择次数少者", timeout_rule: "超时按未提交处理", reconnect_rule: "掉线沿用默认姿态",
    host_permissions: ["设置轮数与目标限制"],
    online_components: ["姿态选择", "目标选择", "统一揭示"],
    output_fields: ["积分", "姿态余量", "排名"], editable_parameters: ["轮数", "姿态次数", "目标限制", "积分"],
    locked_rules: ["所有提交同时公开", "不得提前展示他人选择"],
    exception_notes: ["同一玩家连续两轮不能选同一目标", "被三人以上共同选择时获得1点补偿护盾"],
  }),
  rt("M04-4", "M04", {
    kind: "READY_TEMPLATE", name: "顺序夺取", default_name: "轮选资源", nature: "PURE_GAME",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "QUICK", minutes: "三轮", structure: "每轮公共区放置玩家数加2项资源" }],
    default_config: "三轮蛇形顺序；每轮公共区放置玩家数加2项资源；每人每轮选1项。",
    legal_actions: ["选择资源", "放弃"],
    round_flow: ["第一轮随机顺序", "第二轮反向", "第三轮按当前积分从低到高", "每人选1项"],
    settlement_rules: ["资源按预设组合计分或直接带入下一阶段", "未选资源弃置"],
    tie_rule: "不需要", timeout_rule: "超时自动选取公开基础价值最低且未拥有的资源", reconnect_rule: "掉线沿用该策略",
    host_permissions: ["设置轮数与顺序算法"],
    online_components: ["公共区资源", "顺序提示"],
    output_fields: ["所获资源", "积分"], editable_parameters: ["轮数", "资源数量", "顺序算法", "公开信息"],
    locked_rules: ["资源池在开局前生成", "主持人不能根据玩家选择替换后续资源"],
    exception_notes: [],
  }),
  rt("M04-5", "M04", {
    kind: "READY_TEMPLATE", name: "押注与风险推进", default_name: "止盈阶梯", nature: "PURE_GAME",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "QUICK", minutes: "5层", structure: "各层成功率90/75/60/45/30%" }],
    default_config: "5层；各层成功率90/75/60/45/30%，未锁收益为1/3/6/10/15；每层前可选择结算退出或继续。",
    legal_actions: ["结算退出", "继续", "放弃"],
    round_flow: ["秘密选择继续/退出", "退出者锁定收益", "继续者统一判定", "失败清空未锁收益但保留已锁奖励", "进入下一层"],
    settlement_rules: ["比较锁定收益", "最高层成功额外获得一次奖励选择权"],
    tie_rule: "平层比较已锁收益", timeout_rule: "无人继续则提前结束", reconnect_rule: "掉线默认退出并锁定当前收益",
    host_permissions: ["设置层数与概率"],
    online_components: ["已锁收益", "未锁收益", "成功率显示"],
    output_fields: ["锁定收益", "层级", "奖励选择权"], editable_parameters: ["层数", "概率", "收益曲线", "是否允许一次重试"],
    locked_rules: ["概率与收益开局公开", "不得让第一层退出成为稳定最高期望值"],
    exception_notes: [],
  }),
  rt("M04-6", "M04", {
    kind: "READY_TEMPLATE", name: "有限信息猜测", default_name: "区间侦测", nature: "PURE_GAME",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "QUICK", minutes: "1—100目标", structure: "全桌共享8次探测" }],
    default_config: "服务器从1—100选定目标；全桌共享8次探测；每次由当前操作者提交数字，系统只回复高/低/命中；顺序轮换。",
    legal_actions: ["公共探测", "私密探测"],
    round_flow: ["当前操作者提交数字", "系统回复高/低/命中", "轮换下一位", "私密探测可自行公开"],
    settlement_rules: ["命中者获得个人奖励，全桌同时获得完成码", "8次未命中按最终区间宽度结算公共档位"],
    tie_rule: "不需要", timeout_rule: "超时自动提交当前有效区间中点", reconnect_rule: "掉线沿用区间状态",
    host_permissions: ["设置范围与次数"],
    online_components: ["探测区", "高/低/命中反馈", "私密探测"],
    output_fields: ["命中者", "区间宽度", "档位"], editable_parameters: ["范围", "公共次数", "私密探测形式", "奖励"],
    locked_rules: ["目标由可复现随机种子生成，不能使用剧情答案替代"],
    exception_notes: ["重复数字被客户端阻止"],
  }),
  rt("M04-7", "M04", {
    kind: "READY_TEMPLATE", name: "团队累计得分", default_name: "接力积分", nature: "PURE_GAME",
    participation_mode: "TEAM_BY_RULE", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STANDARD", minutes: "4轮", structure: "按规则随机分为2队；同时任务" }],
    default_config: "按规则随机分为2队；4轮同时任务；每轮每人从稳健、标准、冒险三档选择，贡献为1固定、2点80%成功、4点50%成功。",
    legal_actions: ["选稳健", "选标准", "选冒险"],
    round_flow: ["秘密选择档位", "统一结算", "累加团队积分"],
    settlement_rules: ["累计高队获胜", "平分比较成功次数，仍平则双方同档奖励"],
    tie_rule: "平分比较成功次数，仍平则双方同档奖励", timeout_rule: "掉线默认稳健", reconnect_rule: "掉线默认稳健",
    host_permissions: ["设置队伍生成与轮数"],
    online_components: ["团队积分", "档位选择", "协作加成"],
    output_fields: ["团队积分", "胜负", "成功次数"],
    editable_parameters: ["队伍生成", "轮数", "概率", "协作加分"],
    locked_rules: ["不公开个人失败明细的版本应作为默认，避免现场变成绩效追责"],
    exception_notes: ["一队当轮三种档位均有人选择时加2分", "人数为奇数时少人队每轮获得1点基础补偿"],
  }),

  /* -------- M05 内容拼接与集合 -------- */
  rt("M05-1", "M05", {
    kind: "READY_TEMPLATE", name: "集齐指定组合", default_name: "组合提交台", nature: "PURE_GAME",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STANDARD", minutes: "按组合", structure: "3组目标，每组需3种不同类别组件" }],
    default_config: "3组目标，每组需3种不同类别组件；场上组件总量为需求量的140%，包含替代件。",
    legal_actions: ["持有或交易组件", "发起组合", "确认投入", "验证", "消耗并开放结果"],
    round_flow: ["玩家持有或交易组件", "任意持有人发起组合", "相关持有人分别确认投入", "平台验证", "消耗组件并开放预设结果"],
    settlement_rules: ["每组独立成功", "阶段末按完成0/1/2/3组输出档位"],
    tie_rule: "不需要", timeout_rule: "阶段末结束", reconnect_rule: "掉线保持已确认投入",
    host_permissions: ["设置组数与类别数"],
    online_components: ["组件栏", "组合区", "完成度"],
    output_fields: ["完成组数", "档位", "消耗组件"], editable_parameters: ["组数", "类别数", "替代件比例", "组件是否消耗"],
    locked_rules: ["不能要求每个组件都牵涉所有玩家", "允许空资源栏和无用途组件"],
    exception_notes: ["必要结果至少有一组可由公共组件或替代件完成", "单人可以独立凑齐，系统不强制共享"],
  }),
  rt("M05-2", "M05", {
    kind: "READY_TEMPLATE", name: "顺序排列", default_name: "序列复原", nature: "PURE_GAME",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STANDARD", minutes: "6—9张片段", structure: "公开拖拽；最多提交3次" }],
    default_config: "6—9张片段，公开拖拽；最多提交3次；每次只返回正确位置数量和相邻关系正确数量。",
    legal_actions: ["拖拽排列", "提交", "调整", "锁定"],
    round_flow: ["协商", "排列", "正式提交", "获得结构反馈", "调整", "最终锁定"],
    settlement_rules: ["全部正确为A", "错1—2位为B", "其余按正确相邻数输出C/D", "不阻断下一阶段"],
    tie_rule: "不需要", timeout_rule: "提交次数用尽结束", reconnect_rule: "多人编辑使用房主令牌或轮流30秒编辑",
    host_permissions: ["设置片段数与提交次数"],
    online_components: ["排序区", "结构反馈", "编辑锁"],
    output_fields: ["档位", "正确位置数", "正确相邻数"], editable_parameters: ["片段数", "反馈类型", "提交次数", "编辑权限"],
    locked_rules: ["片段之间必须含内部判断依据，不能只靠穷举"],
    exception_notes: ["多人编辑使用房主令牌或轮流30秒编辑，避免同时拖动冲突"],
  }),
  rt("M05-3", "M05", {
    kind: "READY_TEMPLATE", name: "空间拼合", default_name: "线路拼图", nature: "PURE_GAME",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "QUICK", minutes: "4×4区域", structure: "12块可用图块；连接入口与至少两个出口" }],
    default_config: "4×4区域，12块可用图块，要求连接入口与至少两个出口；图块可旋转，不可重叠。",
    legal_actions: ["选块", "旋转", "放置", "提交"],
    round_flow: ["选块", "旋转", "放置", "系统即时标记合法连接但不提示最优路线", "正式提交"],
    settlement_rules: ["按连通出口、剩余空位和特殊节点覆盖数计分"],
    tie_rule: "不需要", timeout_rule: "编辑锁最多20秒自动释放", reconnect_rule: "断线后恢复最后服务器版本",
    host_permissions: ["设置地图尺寸与图块集"],
    online_components: ["图板", "图块集", "合法连接标记"],
    output_fields: ["连通出口", "计分", "剩余空位"], editable_parameters: ["地图尺寸", "图块集", "出口数", "评分条件"],
    locked_rules: ["图块集开局固定", "不能由主持人悄悄补一块"],
    exception_notes: ["移动端提供点选放置"],
  }),
  rt("M05-4", "M05", {
    kind: "READY_TEMPLATE", name: "多条件激活", default_name: "接口矩阵", nature: "PURE_GAME",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STANDARD", minutes: "4接口", structure: "分别要求颜色/形状/数值/来源标签中的两项" }],
    default_config: "4个接口分别要求颜色、形状、数值、来源标签中的两项；组件可以满足1—2个接口。",
    legal_actions: ["拖入组件", "撤回", "提交激活"],
    round_flow: ["拖入组件", "系统只显示条件是否满足，不显示哪个标签错误", "允许撤回", "提交激活"],
    settlement_rules: ["满足2/3/4接口分别产生不同结果", "组件在正式提交后消耗"],
    tie_rule: "不需要", timeout_rule: "提交时限结束", reconnect_rule: "保持服务器端组件状态",
    host_permissions: ["设置接口数与标签维度"],
    online_components: ["组件池", "接口矩阵", "满足状态"],
    output_fields: ["接口数", "结果", "消耗组件"], editable_parameters: ["接口数", "标签维度", "反馈强度", "是否消耗"],
    locked_rules: ["不得只有一套作者预定填法"],
    exception_notes: ["至少存在两套合法解", "任何单一组件被持有或消耗都不应使最低结果不可达"],
  }),
  rt("M05-5", "M05", {
    kind: "READY_TEMPLATE", name: "可替代组件", default_name: "配方网络", nature: "PURE_GAME",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "QUICK", minutes: "按需求", structure: "1枚核心件或3枚通用件两种满足方式" }],
    default_config: "每项需求有1枚核心件或3枚通用件两种满足方式；通用件可跨目标使用但会消耗。",
    legal_actions: ["选择目标", "选择配方", "预览消耗", "确认", "生成结果"],
    round_flow: ["选择目标", "选择配方", "预览消耗", "确认", "生成结果"],
    settlement_rules: ["完成目标数量与剩余资源共同决定档位", "核心件并非必然优于通用件方案"],
    tie_rule: "不需要", timeout_rule: "提交时限结束", reconnect_rule: "资源被交易后实时重算可用配方",
    host_permissions: ["设置配方与替代比率"],
    online_components: ["配方表", "资源栏", "生成结果"],
    output_fields: ["完成目标", "剩余资源", "档位"], editable_parameters: ["配方数", "替代比率", "消耗", "完成上限"],
    locked_rules: ["替代方案必须有真实成本差异，不能仅改名称"],
    exception_notes: ["不会透露其他玩家库存"],
  }),
  rt("M05-6", "M05", {
    kind: "READY_TEMPLATE", name: "分阶段拼接", default_name: "递进组件", nature: "PURE_GAME",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STANDARD", minutes: "两阶段", structure: "第一阶段3个局部组合生成A/B/C中间件" }],
    default_config: "两阶段；第一阶段3个局部组合分别生成A/B/C中间件；第二阶段用任意两个中间件完成最终组合。",
    legal_actions: ["提交局部组合", "选择第二阶段方案", "输出结果"],
    round_flow: ["第一阶段独立提交并结算", "锁定中间件", "下一幕读取中间件", "选择第二阶段方案", "输出结果"],
    settlement_rules: ["第一阶段每个结果永久有效", "第二阶段不能追溯修改第一阶段组件含义"],
    tie_rule: "不需要", timeout_rule: "阶段时限结束", reconnect_rule: "保持已锁定中间件",
    host_permissions: ["设置阶段数与局部组合数"],
    online_components: ["局部组合区", "中间件", "第二阶段选择"],
    output_fields: ["中间件", "最终结果", "档位"], editable_parameters: ["阶段数", "局部组合数", "最低继续条件"],
    locked_rules: ["后段只增加用途，不推翻前段客观内容"],
    exception_notes: ["仅得到一个中间件时仍有低档出口", "得到三个允许选择使用哪两个，而非自动给最优解"],
  }),

  /* -------- M06 数值对抗 -------- */
  rt("M06-1", "M06", {
    kind: "READY_TEMPLATE", name: "基础生命对抗", default_name: "十点生存战", nature: "PURE_GAME",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STANDARD", minutes: "最多6轮", structure: "全员10生命、2基础攻击、1基础防御" }],
    default_config: "全员10生命、2基础攻击、1基础防御；最多6轮；同时选择行动和目标。",
    legal_actions: ["攻击", "防御", "蓄力", "急救", "预测目标"],
    round_flow: ["同时选择行动和目标", "统一结算：防御→反制→伤害→恢复→淘汰检查", "进入下一轮"],
    settlement_rules: ["攻击造成2", "防御使本轮首次伤害减2", "蓄力令下轮攻击+2", "急救恢复2且全局一次", "剩余生命、造成有效伤害、剩余一次性能力依次排名"],
    tie_rule: "剩余生命→造成有效伤害→剩余一次性能力依次排名", timeout_rule: "掉线默认防御", reconnect_rule: "掉线默认防御",
    host_permissions: ["设置轮数与数值"],
    online_components: ["生命条", "行动选择", "结算日志"],
    output_fields: ["剩余生命", "名次", "观察分"], editable_parameters: ["轮数", "数值", "是否允许自由选目标", "奖励档"],
    locked_rules: ["不得中途复活或改伤害", "不能把剧情必要内容只给唯一冠军"],
    exception_notes: ["归零者不再成为目标，但每轮可预测一名攻击者"],
  }),
  rt("M06-2", "M06", {
    kind: "READY_TEMPLATE", name: "行动点对抗", default_name: "三点指令", nature: "PURE_GAME",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STANDARD", minutes: "每轮3行动点共5轮", structure: "攻击/防御/移动/支援/蓄能" }],
    default_config: "每轮3行动点，共5轮；攻击1点、防御1点、移动1点、支援1点、蓄能2点。",
    legal_actions: ["攻击", "防御", "移动", "支援", "蓄能"],
    round_flow: ["分配行动点", "统一结算", "累加能量与积分"],
    settlement_rules: ["完成公开目标获得3分", "伤害或支援各按有效值计分", "固定轮数后比较"],
    tie_rule: "固定轮数后比较", timeout_rule: "超时采用上轮合法方案，若无则全防御", reconnect_rule: "掉线沿用上轮合法方案",
    host_permissions: ["设置点数与行动列表"],
    online_components: ["行动点分配", "目标进度"],
    output_fields: ["积分", "能量", "排名"], editable_parameters: ["点数", "行动列表", "目标", "计分权重"],
    locked_rules: ["所有行动必须有消费者", "不能放入永远不值得使用的装饰能力"],
    exception_notes: ["非法组合在提交前阻止", "蓄能产生1能量，可用于下一轮强化任一行动"],
  }),
  rt("M06-3", "M06", {
    kind: "READY_TEMPLATE", name: "姿态克制", default_name: "攻守谋三势", nature: "PURE_GAME",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STANDARD", minutes: "7轮", structure: "攻克谋、谋克守、守克攻" }],
    default_config: "攻克谋、谋克守、守克攻；7轮；每种姿态连续使用会使其下轮效果-1。",
    legal_actions: ["选择姿态", "选择目标", "提交"],
    round_flow: ["秘密选择姿态与目标", "统一结算", "累加优势"],
    settlement_rules: ["克制成功造成2优势", "同类各得1防备", "被克制不变", "优势达到8提前获胜，否则轮末比较"],
    tie_rule: "轮末比较优势", timeout_rule: "超时按未提交处理", reconnect_rule: "掉线沿用默认姿态",
    host_permissions: ["设置姿态数与轮数"],
    online_components: ["姿态选择", "历史选择反馈"],
    output_fields: ["优势", "防备", "排名"], editable_parameters: ["姿态数", "疲劳", "轮数", "目标限制"],
    locked_rules: ["必须有历史选择反馈，避免纯猜拳"],
    exception_notes: ["集中攻击补偿沿用M04-3规则"],
  }),
  rt("M06-4", "M06", {
    kind: "READY_TEMPLATE", name: "队伍对抗", default_name: "双线攻防", nature: "PURE_GAME",
    participation_mode: "TEAM_BY_RULE", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STANDARD", minutes: "5轮", structure: "两队；公共堡垒各12耐久" }],
    default_config: "两队；公共堡垒各12耐久；个人每轮在进攻、防守、补给三项选一；5轮同时结算。",
    legal_actions: ["进攻", "防守", "补给"],
    round_flow: ["秘密选择行动", "同时结算", "损伤堡垒", "进入下一轮"],
    settlement_rules: ["进攻总值减对方防守总值后损伤堡垒", "堡垒先归零者败", "同轮均归零比较超额伤害", "轮限到达比较堡垒、强化令和有效进攻"],
    tie_rule: "同轮均归零比较超额伤害", timeout_rule: "轮限到达比较", reconnect_rule: "掉线默认防守",
    host_permissions: ["设置分队方式与耐久"],
    online_components: ["堡垒耐久", "行动选择", "队内语音开关"],
    output_fields: ["剩余堡垒", "强化令", "有效进攻", "胜负"],
    editable_parameters: ["分队方式", "耐久", "轮数", "是否开放队内语音"],
    locked_rules: ["提前失利者不退出整场", "结果只在固定结算点产生"],
    exception_notes: ["奇数队获得轮换佣兵，佣兵按公开循环行动", "补给为下轮提供强化令"],
  }),
  rt("M06-5", "M06", {
    kind: "READY_TEMPLATE", name: "多方混战", default_name: "积分混战", nature: "PURE_GAME",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STANDARD", minutes: "5轮", structure: "全员独立，不采用永久淘汰" }],
    default_config: "全员独立，5轮，不采用永久淘汰；每轮可突袭、护持、转移目标或休整。",
    legal_actions: ["突袭", "护持", "转移目标", "休整"],
    round_flow: ["秘密选择行动", "统一结算", "累加积分"],
    settlement_rules: ["突袭成功得2分", "护持抵消一次并得1分", "休整恢复一次性能力", "固定轮数按积分排名"],
    tie_rule: "固定轮数按积分排名", timeout_rule: "超时按未提交处理", reconnect_rule: "掉线沿用默认行动",
    host_permissions: ["设置轮数与追赶强度"],
    online_components: ["积分榜", "行动选择", "追赶标记"],
    output_fields: ["积分", "排名", "追赶标记"], editable_parameters: ["轮数", "追赶强度", "目标收益衰减"],
    locked_rules: ["不能通过围攻最弱者无限获利"],
    exception_notes: ["多人集中同一目标时从第四个攻击开始不再得分", "最低分玩家每轮获得一枚追赶标记"],
  }),
  rt("M06-6", "M06", {
    kind: "READY_TEMPLATE", name: "首领协作战", default_name: "四阶段首领", nature: "PURE_GAME",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STANDARD", minutes: "4轮", structure: "首领生命为玩家数×6" }],
    default_config: "首领生命为玩家数×6；4轮；每轮按固定行为表发动范围攻击、锁定攻击、护盾或蓄力。",
    legal_actions: ["攻击", "防御", "支援", "破盾"],
    round_flow: ["公布首领行为", "每轮给每人两个只对本人可见的选择", "统一结算", "检查生命阈值", "切换阶段"],
    settlement_rules: ["击败为A", "未击败按剩余生命为B/C/D", "全员失能立即进入D但剧情继续"],
    tie_rule: "不需要", timeout_rule: "轮限到达按剩余生命结算", reconnect_rule: "掉线默认防御",
    host_permissions: ["设置生命系数与行为表"],
    online_components: ["首领生命条", "个人行动选择", "阶段提示"],
    output_fields: ["档位", "剩余生命", "阶段"], editable_parameters: ["生命系数", "轮数", "行为表", "奖励档"],
    locked_rules: ["首领不能由主持人临场控制", "失败有正式出口"],
    exception_notes: ["每轮给每人一个只对本人可见的两项选择，不允许队长替其提交", "首领随机目标由服务器生成并公开"],
  }),
  rt("M06-7", "M06", {
    kind: "READY_TEMPLATE", name: "控制区域对抗", default_name: "三域争夺", nature: "PURE_GAME",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STANDARD", minutes: "4轮", structure: "3个区域；每人每轮3力量" }],
    default_config: "3个区域，4轮；每人每轮有3力量，可分配到任意区域；同时提交。",
    legal_actions: ["分配力量到区域", "移动1力量", "提交"],
    round_flow: ["同时提交力量分配", "统一揭示", "各区域结算积分", "进入下一轮"],
    settlement_rules: ["每轮各区域力量最高者得其分值", "平手区域无人得分并累积1点到下轮", "累计区域分最高者或队伍获胜"],
    tie_rule: "平手区域无人得分并累积1点到下轮", timeout_rule: "掉线沿用上轮分配；首轮掉线平均分配", reconnect_rule: "掉线沿用上轮分配",
    host_permissions: ["设置区域数与人或队伍模式"],
    online_components: ["区域力量", "区域分值", "统一揭示"],
    output_fields: ["区域分", "总积分", "获胜者"], editable_parameters: ["区域数", "分值", "力量", "个人或队伍模式"],
    locked_rules: ["区域数量不超过5", "所有人提交后统一公开"],
    exception_notes: ["特殊能力仅允许移动1力量一次", "移动操作在揭示前完成"],
  }),
  rt("M06-8", "M06", {
    kind: "READY_TEMPLATE", name: "非淘汰式对抗", default_name: "优势赛道", nature: "PURE_GAME",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STANDARD", minutes: "6轮", structure: "每人优势0—12" }],
    default_config: "每人优势0—12，共6轮；行动为推进2、阻拦目标1、蓄势下轮推进4、清除一个负面状态。",
    legal_actions: ["推进", "阻拦目标", "蓄势", "清除负面状态"],
    round_flow: ["秘密选择行动", "统一结算", "更新优势", "进入下一轮"],
    settlement_rules: ["优势最高者胜", "平分比较完成不同类型行动的数量"],
    tie_rule: "平分比较完成不同类型行动的数量", timeout_rule: "掉线默认推进2", reconnect_rule: "掉线默认推进2",
    host_permissions: ["设置赛道长度与轮数"],
    online_components: ["优势条", "行动选择", "蓄势提示"],
    output_fields: ["优势", "排名", "负面状态"], editable_parameters: ["赛道长度", "轮数", "行动值", "信息可见度"],
    locked_rules: ["后半程必须保留追赶空间，但不能强制平均分"],
    exception_notes: ["领先者受到阻拦的收益递减", "落后者蓄势不公开具体数值，只显示已蓄势"],
  }),

  /* -------- M09 正式投票与集体裁决 -------- */
  rt("M09-1", "M09", {
    kind: "READY_TEMPLATE", name: "简单多数决", default_name: "单选多数", nature: "PURE_GAME",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "QUICK", minutes: "2分钟提交", structure: "2—5个候选；全员一票" }],
    default_config: "2—5个候选；全员一票；2分钟提交；截止前可修改。",
    legal_actions: ["投票", "截止前修改"],
    round_flow: ["查看候选", "投票", "截止", "计票"],
    settlement_rules: ["最高票胜", "平票进入预设平票出口，可为二轮限时复投或全部保留"],
    tie_rule: "平票进入预设平票出口，可为二轮限时复投或全部保留", timeout_rule: "未提交视为弃权", reconnect_rule: "掉线未提交视为弃权",
    host_permissions: ["设置候选与平票出口"],
    online_components: ["投票面板", "计票", "平票出口"],
    output_fields: ["结果", "票数分布"], editable_parameters: ["候选", "提交时长", "平票出口"],
    locked_rules: ["多数票只能形成集体决定，不能改变客观事实"],
    exception_notes: ["有效票为0时输出NO_DECISION"],
  }),
  rt("M09-2", "M09", {
    kind: "READY_TEMPLATE", name: "门槛表决", default_name: "提案通过", nature: "PURE_GAME",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "QUICK", minutes: "提交", structure: "赞成/反对/弃权；默认门槛三分之二" }],
    default_config: "赞成/反对/弃权；门槛按有效在场人数比例计算，默认三分之二。",
    legal_actions: ["赞成", "反对", "弃权"],
    round_flow: ["投票", "截止", "按有效在场人数计算门槛", "判定通过与否"],
    settlement_rules: ["赞成达到向上取整门槛则通过", "否则未通过", "弃权是否计入分母必须开局声明"],
    tie_rule: "不需要", timeout_rule: "掉线玩家按弃权", reconnect_rule: "掉线玩家按弃权",
    host_permissions: ["设置门槛与弃权算法"],
    online_components: ["投票面板", "门槛显示", "逐票开关"],
    output_fields: ["结果", "票数", "门槛"], editable_parameters: ["门槛", "弃权算法", "是否公开逐票"],
    locked_rules: [],
    exception_notes: ["人数变化实时重算门槛但锁票后不再变化"],
  }),
  rt("M09-3", "M09", {
    kind: "READY_TEMPLATE", name: "排序投票", default_name: "偏好排序", nature: "PURE_GAME",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STANDARD", minutes: "3—6个候选", structure: "即时决选" }],
    default_config: "3—6个候选；使用即时决选：统计第一偏好，淘汰最低者并转移选票，直至过半。",
    legal_actions: ["提交偏好排序", "不完整排序"],
    round_flow: ["统计第一偏好", "淘汰最低者", "转移选票", "直至过半"],
    settlement_rules: ["直至有候选过半"],
    tie_rule: "最低票并列时比较上一轮票数；仍平则二者均不淘汰，进入一次并列复投",
    timeout_rule: "未排序候选视为同等末位", reconnect_rule: "掉线保留已提交排序",
    host_permissions: ["设置候选"],
    online_components: ["排序面板", "逐轮计票", "审计轮次"],
    output_fields: ["胜者", "逐轮票数"], editable_parameters: ["候选", "是否允许不完整排序"],
    locked_rules: ["计票算法必须由程序执行并提供可审计轮次"],
    exception_notes: ["允许不完整排序，未排序候选视为同等末位"],
  }),
  rt("M09-4", "M09", {
    kind: "READY_TEMPLATE", name: "多答案保留", default_name: "有限保留", nature: "PURE_GAME",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "QUICK", minutes: "每人多选2", structure: "候选达到有效票40%即保留，最多保留3项" }],
    default_config: "每人最多选2项；候选达到有效票40%即保留，最多保留3项。",
    legal_actions: ["勾选候选", "提交"],
    round_flow: ["勾选", "提交", "按40%阈值保留", "截取上限"],
    settlement_rules: ["超过上限按票数截取", "边界平票全部进入TIED_PENDING_RULE或按预设优先级处理"],
    tie_rule: "边界平票全部进入TIED_PENDING_RULE或按预设优先级处理", timeout_rule: "未提交按空票", reconnect_rule: "掉线按空票",
    host_permissions: ["设置候选与上限"],
    online_components: ["多选面板", "保留列表"],
    output_fields: ["保留项", "票数"], editable_parameters: ["候选", "上限", "保留阈值"],
    locked_rules: ["不得无限勾选", "保留并不等于客观正确"],
    exception_notes: [],
  }),
  rt("M09-5", "M09", {
    kind: "READY_TEMPLATE", name: "带权票", default_name: "票权投入", nature: "PURE_GAME",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "QUICK", minutes: "每人3票权", structure: "可全部投一项或拆分" }],
    default_config: "每人拥有3票权，可全部投一项或拆分；用后消耗。",
    legal_actions: ["投入票权", "拆分投放"],
    round_flow: ["分配票权", "提交", "计票"],
    settlement_rules: ["按票权总量计", "未投入票权可按配置保留到下一次或阶段末清空"],
    tie_rule: "同票权平票按普通平票出口", timeout_rule: "余额不足阻止提交", reconnect_rule: "掉线保留已投入票权",
    host_permissions: ["设置票权来源规则"],
    online_components: ["票权分配", "票权余量"],
    output_fields: ["结果", "票权分布"], editable_parameters: ["票权额度", "是否清空"],
    locked_rules: ["票权来源必须是公开规则状态，不能由主持人临时授予"],
    exception_notes: [],
  }),
  rt("M09-6", "M09", {
    kind: "READY_TEMPLATE", name: "否决权表决", default_name: "一次否决", nature: "PURE_GAME",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "QUICK", minutes: "45秒否决窗", structure: "全场最多存在1—2枚否决权" }],
    default_config: "普通表决结束后开启45秒否决窗；全场最多存在1—2枚否决权；使用后消耗。",
    legal_actions: ["行使否决权", "放弃"],
    round_flow: ["普通表决", "开启否决窗", "行权或放弃", "送入预设替代分支"],
    settlement_rules: ["否决将结果送入预设替代分支，不自动让相反选项获胜"],
    tie_rule: "多人同时否决只消耗服务器确认的第一枚", timeout_rule: "45秒否决窗结束", reconnect_rule: "持有者掉线默认不使用",
    host_permissions: ["设置否决权数量"],
    online_components: ["否决窗", "否决权显示"],
    output_fields: ["结果", "否决权消耗"], editable_parameters: ["否决权数量", "否决窗时长"],
    locked_rules: ["否决必须有成本和次数上限"],
    exception_notes: ["不得代按"],
  }),
  rt("M09-7", "M09", {
    kind: "READY_TEMPLATE", name: "分组表决", default_name: "双层议决", nature: "PURE_GAME",
    participation_mode: "TEAM_BY_RULE", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "QUICK", minutes: "2—3组", structure: "组内简单多数形成组票" }],
    default_config: "按公开规则分2—3组；组内简单多数形成组票；组票再按多数或一致门槛聚合。",
    legal_actions: ["组内投票"],
    round_flow: ["组内投票", "组内简单多数形成组票", "组票按门槛聚合"],
    settlement_rules: ["同时保存个人票、组内结果和总结果", "组内平票按该组弃权处理"],
    tie_rule: "组内平票按该组弃权处理", timeout_rule: "未提交按弃权", reconnect_rule: "掉线按弃权",
    host_permissions: ["设置分组与聚合门槛"],
    online_components: ["分组面板", "双层计票"],
    output_fields: ["个人票", "组内结果", "总结果"], editable_parameters: ["分组", "聚合门槛"],
    locked_rules: ["分组必须来自既有公开结构，不为制造复杂度临时分配"],
    exception_notes: ["单人组的个人票即组票", "无人组不计分母"],
  }),
];

/* ==================== 第二部分：剧情绑定机制的完整生产合同（STORY_CONTRACT，30 项） ==================== */

function sc(
  template_id: string,
  family_id: FamilyId,
  react: Omit<MechanismTemplateV2, "template_id" | "family_id" | "role">,
): MechanismTemplateV2 {
  return {
    template_id,
    family_id,
    role: FAMILY_MECHANISM_ROLE[family_id],
    ...react,
    builtin_exception_codes: E,
  };
}

const STORY_CONTRACTS: MechanismTemplateV2[] = [
  /* -------- M01 追凶与事件调查 -------- */
  sc("M01-1", "M01", {
    kind: "STORY_CONTRACT", name: "行为人判断", default_name: "谁实施了决定性行为", nature: "STORY_BOUND",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STORY_MAJOR", minutes: "60—90", structure: "调查、讨论、提交" }],
    default_config: "对谁实施了决定性行为作出判断；由既有事实路径支持，非性格/动机猜测。",
    legal_actions: ["获取既有信息", "公开讨论", "提交一名/多名/无法确认"],
    round_flow: ["获取信息", "公开讨论", "提交结论", "输入下一幕"], settlement_rules: [
      "CORRECT、PARTIAL、WRONG、UNRESOLVED分别映射有限状态", "错误不阻断后续",
    ],
    tie_rule: "UNRESOLVED", timeout_rule: "未提交按UNRESOLVED", reconnect_rule: "掉线保留已开放事实",
    host_permissions: ["开放事实", "开启提交"], online_components: ["信息面板", "提交面板"],
    output_fields: ["判断类别", "有限状态"], editable_parameters: ["问题范围", "提交时限"],
    locked_rules: ["不按性格/动机猜测", "错误不阻断后续"],
    exception_notes: [],
    required_fields: ["待判断行为", "真实执行者", "执行时间窗", "权限与机会", "至少两条可达判断路径"],
    verification_rules: ["移除人物性格和动机描述后，仍能凭行动与信息判断；否则不通过"],
  }),
  sc("M01-2", "M01", {
    kind: "STORY_CONTRACT", name: "真实原因判断", default_name: "表面结果由什么真实原因造成", nature: "STORY_BOUND",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STORY_MAJOR", minutes: "60—90", structure: "因果候选筛选" }],
    default_config: "对表面结果的真实物理或规则原因作判断；先形成至少三种结构不同候选再人工选择。",
    legal_actions: ["获取信息", "讨论", "提交原因判定"],
    round_flow: ["提出候选", "人工选择", "核对必要链条", "输出有限状态"],
    settlement_rules: ["原因类别与必要链条分开计分", "不能只靠说中关键词"],
    tie_rule: "未决", timeout_rule: "未提交按未决", reconnect_rule: "掉线保留已开放事实",
    host_permissions: ["开放事实"], online_components: ["信息面板", "候选面板"],
    output_fields: ["原因类别", "必要链条", "有限状态"], editable_parameters: ["候选数", "提交时限"],
    locked_rules: [],
    required_fields: ["表面原因", "真实物理或规则原因", "必要条件", "排除其他候选的内部依据"],
    production_rules: ["至少提出三种结构不同的因果候选，人工选择后才继续", "涉及医学化学法律工程时外部专业确认"],
    verification_rules: ["答案不得依赖剧本未提供的冷知识"],
  }),
  sc("M01-3", "M01", {
    kind: "STORY_CONTRACT", name: "决定性行为判断", default_name: "哪项行为真正改变最终结果", nature: "STORY_BOUND",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STORY_MAJOR", minutes: "60—90", structure: "删除测试驱动" }],
    default_config: "对多项行为中哪一项真正改变最终结果作判断；以删除测试为内部依据。",
    legal_actions: ["获取信息", "讨论", "提交判定"],
    round_flow: ["梳理相关行为", "删除测试", "提交判定", "输出有限状态"],
    settlement_rules: ["决定性、促成性、无关分别保存", "不平均分配责任"],
    tie_rule: "未决", timeout_rule: "未提交按未决", reconnect_rule: "掉线保留已开放事实",
    host_permissions: ["开放事实"], online_components: ["信息面板", "行为清单"],
    output_fields: ["行为类别", "责任范围"], editable_parameters: ["行为清单", "提交时限"],
    locked_rules: [],
    required_fields: ["所有相关行为", "每项独立后果", "相互作用", "删除测试"],
    verification_rules: ["若所有行为删除后都不影响结果，说明只是嫌疑装饰，必须返工"],
  }),
  sc("M01-4", "M01", {
    kind: "STORY_CONTRACT", name: "行动顺序判断", default_name: "按什么先后发生", nature: "STORY_BOUND",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STORY_MAJOR", minutes: "60—90", structure: "顺序还原" }],
    default_config: "对若干已知行为的先后顺序作判断；系统可返回结构反馈但不泄露答案节点。",
    legal_actions: ["排列事件", "提交", "获取结构反馈"],
    round_flow: ["排列事件", "提交", "获得结构反馈", "调整", "最终锁定"],
    settlement_rules: ["全序正确、关键先后正确、错误、未决"],
    tie_rule: "未决", timeout_rule: "未提交按未决", reconnect_rule: "掉线保留已开放事实",
    host_permissions: ["开放事实"], online_components: ["排序区", "结构反馈"],
    output_fields: ["顺序类别", "有限状态"], editable_parameters: ["节点", "反馈类型"],
    locked_rules: [],
    required_fields: ["顺序节点", "时间锚点", "先后约束", "允许并行的动作", "至少一项能排除错误顺序的内容"],
    verification_rules: ["不同顺序必须产生可辨别后果，否则问题没有意义"],
  }),
  sc("M01-5", "M01", {
    kind: "STORY_CONTRACT", name: "意图判断", default_name: "行为是故意/误判/未遂/临时/无意", nature: "STORY_BOUND",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STORY_MAJOR", minutes: "60—90", structure: "主观意图判定" }],
    default_config: "对行为意图类别（故意/明知风险/疏忽/无法确认）作判断；不把结果严重程度直接等同主观意图。",
    legal_actions: ["获取信息", "讨论", "提交意图类别"],
    round_flow: ["梳理客观动作与信息", "提交意图类别", "输出有限状态"],
    settlement_rules: ["故意、明知风险、疏忽、无法确认等类别", "不把结果严重程度直接等同主观意图"],
    tie_rule: "无法确认", timeout_rule: "未提交按无法确认", reconnect_rule: "掉线保留已开放事实",
    host_permissions: ["开放事实"], online_components: ["信息面板", "意图选择"],
    output_fields: ["意图类别", "可支持范围"], editable_parameters: ["类别集", "提交时限"],
    locked_rules: [],
    required_fields: ["客观动作", "行动者当时掌握的信息", "可预见后果", "替代行为", "意图证据来源"],
    verification_rules: ["不能只靠本人内心独白", "至少存在外部行动或此前选择支持"],
  }),
  sc("M01-6", "M01", {
    kind: "STORY_CONTRACT", name: "责任划分", default_name: "多名参与者分别承担什么责任", nature: "STORY_BOUND",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STORY_MAJOR", minutes: "60—90", structure: "逐人责任判定" }],
    default_config: "将多名参与者的责任分类并保存整体状态；允许无人承担主要责任。",
    legal_actions: ["对每人选择责任类别", "提交一条因果说明"],
    round_flow: ["逐人选择责任类别", "提交因果说明", "逐人结算", "生成整体状态"],
    settlement_rules: ["逐人结算后再生成整体状态", "允许无人承担主要责任"],
    tie_rule: "无主要责任", timeout_rule: "未提交按无责任", reconnect_rule: "掉线保留已开放事实",
    host_permissions: ["开放事实"], online_components: ["责任选择", "因果说明"],
    output_fields: ["逐人责任", "整体状态"], editable_parameters: ["责任类别集", "提交时限"],
    locked_rules: ["责任不按参与人数平均", "相关不等于致因"],
    required_fields: ["多名参与者的独立贡献", "知情范围", "控制能力", "可替代结果"],
    verification_rules: [],
  }),
  sc("M01-7", "M01", {
    kind: "STORY_CONTRACT", name: "公开说法核验", default_name: "已公开解释是否成立", nature: "STORY_BOUND",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STORY_MAJOR", minutes: "60—90", structure: "断言核验" }],
    default_config: "对一项已公开解释是否成立作出集体采信决策；不改变客观真相。",
    legal_actions: ["对每条断言选择成立/不成立/部分成立/不足"],
    round_flow: ["拆分为断言", "逐个判断", "形成集体采信状态"],
    settlement_rules: ["形成集体采信状态，但不改变客观真相"],
    tie_rule: "部分成立", timeout_rule: "未提交按不足", reconnect_rule: "掉线保留已开放事实",
    host_permissions: ["开放事实"], online_components: ["断言列表", "判断面板"],
    output_fields: ["采信状态", "支持/反驳项"], editable_parameters: ["断言集", "判断时限"],
    locked_rules: ["结论不改变客观真相"],
    required_fields: ["被核验说法的精确文本", "可拆分断言", "支持事实", "反驳事实", "证据不足边界"],
    verification_rules: ["说法必须在剧情中自然出现，而非主持人为引导调查临时提出"],
  }),
  sc("M01-8", "M01", {
    kind: "STORY_CONTRACT", name: "单幕追凶", default_name: "单幕闭环案件", nature: "STORY_BOUND",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STORY_MAJOR", minutes: "60—90", structure: "单幕完整调查闭环" }],
    default_config: "进入案件→观察与信息获取→自由讨论→正式提交→只公布规定范围结算→输出下一幕字段。",
    legal_actions: ["观察", "获取信息", "讨论", "提交", "机动中间状态"],
    round_flow: ["进入案件", "观察与信息获取", "自由讨论", "正式提交", "只公布规定范围结算", "输出下一幕字段"],
    settlement_rules: ["错判、平票、无人提交都进入下一幕", "不得现场补发答案"],
    tie_rule: "错判/平票/无人提交均进入下一幕", timeout_rule: "无人提交进入下一幕", reconnect_rule: "掉线保留已开放事实",
    host_permissions: ["开放事实批次", "开启提交"],
    online_components: ["信息批次", "中间状态", "提交面板"],
    output_fields: ["提交状态", "下一幕字段"], editable_parameters: ["信息批次", "中间状态", "提交时限"],
    locked_rules: ["该幕结束后不再靠后续内容补齐本幕本应可达的必要判断材料"],
    required_fields: ["信息批次", "可改变调查重点的中间状态", "正式提交项", "规定范围结算", "下一幕字段"],
    verification_rules: ["60—90分钟至少需要两个信息批次、一次可改变调查重点的中间状态和一个正式提交"],
  }),
  sc("M01-9", "M01", {
    kind: "STORY_CONTRACT", name: "贯穿式追凶", default_name: "每幕一个独立问题", nature: "STORY_BOUND",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STORY_MAJOR", minutes: "多幕", structure: "逐幕独立结算直至汇总" }],
    default_config: "每幕一个独立问题；前幕结果、玩家提交状态和新开放事实进入后幕；最终才可汇总。",
    legal_actions: ["每幕提交", "前幕状态进入后幕"],
    round_flow: ["每幕独立问题", "前幕结果与提交状态进入后幕", "新开放事实发放", "最终汇总"],
    settlement_rules: ["保存每幕PLAYER_SUBMISSION与OBJECTIVE_ANSWER，两者绝不覆盖"],
    tie_rule: "前幕错误状态也必须有后续路径", timeout_rule: "未提交按未决进入后幕", reconnect_rule: "掉线保留已开放事实",
    host_permissions: ["开放逐幕事实"], online_components: ["逐幕问题", "提交状态", "事实面板"],
    output_fields: ["逐幕提交", "逐幕客观答案", "最终汇总"], editable_parameters: ["逐幕问题", "事实开放计划"],
    locked_rules: ["前几幕必须有独立结算，不能只是等最后揭晓"],
    required_fields: ["逐幕独立问题", "前幕结果读入", "新开放事实", "逐幕有限状态"],
    verification_rules: ["后幕可以重新解释前幕认识，但不能修改已发生动作", "前幕错误状态也必须有后续路径"],
  }),
  sc("M01-10", "M01", {
    kind: "STORY_CONTRACT", name: "动态现场调查", default_name: "版本化现场", nature: "STORY_BOUND",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STORY_MAJOR", minutes: "60—90", structure: "读取 M11 可变现场后调查" }],
    default_config: "玩家调查的地点可能已被其他玩家通过 M11 移动/损坏/替换/伪造/新增对象；本机制只读取现场，不负责修改现场。",
    legal_actions: ["进入地点", "读取当时快照", "检查现存对象与痕迹", "与已获得信息比对", "提交判断"],
    round_flow: ["进入地点", "读取当时快照", "检查现存对象与痕迹", "与已获得信息比对", "提交判断"],
    settlement_rules: ["保存玩家实际读取的现场版本、正式判断和客观答案", "后来现场再次变化不得追溯修改已读取内容"],
    tie_rule: "UNRESOLVED", timeout_rule: "未提交按 UNRESOLVED", reconnect_rule: "掉线保留已取得快照",
    host_permissions: ["开放进入地点"], online_components: ["版本快照", "对象列表", "痕迹", "判断面板"],
    output_fields: ["现场版本", "正式判断", "客观答案"], editable_parameters: ["快照规则", "对玩家可见的溯源范围"],
    locked_rules: ["M01 只能读取 M11 当前状态和允许公开的溯源", "不得因玩家伪造物件就把伪造内容升级成客观事实"],
    exception_notes: ["关键对象已被删除或移走时，仍通过其他地点/人物观察/不可变记录保留最低可达判断", "不得由主持人把原物偷偷放回"],
    required_fields: ["客观事件版本", "M11 现场引用", "进入现场时的快照规则", "对玩家可见的溯源项", "至少两条不依赖同一可毁对象的必要判断路径"],
    verification_rules: ["本机制自身不修改现场；现场改写必须走 M11"],
  }),

  /* -------- M07 记忆、身份与阶段显现 -------- */
  sc("M07-1", "M07", {
    kind: "STORY_CONTRACT", name: "固定阶段开放", default_name: "按指定阶段自动发放", nature: "STORY_BOUND",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "QUICK", minutes: "按阶段", structure: "到达指定阶段自动发放" }],
    default_config: "到达指定阶段自动发放既有内容；支持个人、分组和全体范围。",
    legal_actions: ["无（自动发放）"],
    round_flow: ["到达指定阶段", "自动发放", "进入待领取箱管理"],
    settlement_rules: ["不掉线按指定阶段发放", "掉线者内容进入待领取箱重连后补领", "已发放不重复触发"],
    tie_rule: "不需要", timeout_rule: "按指定阶段发放", reconnect_rule: "掉线内容进入待领取箱，重连后补领",
    host_permissions: ["配置发放计划"], online_components: ["发放队列", "待领取箱"],
    output_fields: ["已发放内容码", "开放权限变化"], editable_parameters: ["发放字段与范围"],
    locked_rules: ["不单独计为主要玩法时长"],
    required_fields: ["content_id", "事实来源", "接收者", "最早可开放幕"],
    verification_rules: [],
  }),
  sc("M07-2", "M07", {
    kind: "STORY_CONTRACT", name: "条件触发开放", default_name: "按正式状态触发", nature: "STORY_BOUND",
    participation_mode: "STATE_QUALIFIED", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "QUICK", minutes: "按条件", structure: "读取正式状态触发" }],
    default_config: "条件只能读取正式状态（完成某组合/获得某结算码/使用某权限）；条件满足后由服务器发放。",
    legal_actions: ["无（自动发放）"],
    round_flow: ["校验正式状态", "满足则发放"],
    settlement_rules: ["条件满足后由服务器发放", "主持人不能判断玩家表现够不够"],
    tie_rule: "不需要", timeout_rule: "必要内容必须有超时替代条件", reconnect_rule: "掉线保留已满足状态",
    host_permissions: ["配置条件"], online_components: ["条件校验", "发放日志"],
    output_fields: ["已发放内容码", "触发条件"], editable_parameters: ["条件", "超时替代"],
    locked_rules: ["可选内容可以永久未开放"],
    required_fields: ["content_id", "事实来源", "开放条件", "最早可开放幕", "超时替代路径", "开放后权限变化"],
    verification_rules: [],
  }),
  sc("M07-3", "M07", {
    kind: "STORY_CONTRACT", name: "多路径开放", default_name: "同一内容多条到达路径", nature: "STORY_BOUND",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "QUICK", minutes: "按配置", structure: "至少两条真正不同路径" }],
    default_config: "同一内容配置至少两条真正不同的到达路径；首条完成可开放附加内容。",
    legal_actions: ["无（自动发放）"],
    round_flow: ["按到达路径推进", "首条完成开放内容", "可开放附加内容"],
    settlement_rules: ["多路径完成可开放附加内容，但不得出现互相矛盾版本"],
    tie_rule: "不需要", timeout_rule: "按单路径可达", reconnect_rule: "保持已开放状态",
    host_permissions: ["配置多路径"], online_components: ["路径进度"],
    output_fields: ["首次开放路径", "已开放内容"], editable_parameters: ["路径定义"],
    locked_rules: ["平台保存首次开放路径用于维护分析，不向玩家标注最优路径"],
    required_fields: ["content_id", "事实来源", "接收者", "至少两条到达路径", "最早可开放幕", "开放条件", "开放后权限变化"],
    verification_rules: ["路径可以是调查、交换、拼接或正式选择"],
  }),
  sc("M07-4", "M07", {
    kind: "STORY_CONTRACT", name: "个人记忆分层", default_name: "独立层级记忆", nature: "STORY_BOUND",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "QUICK", minutes: "按层级", structure: "每人独立层级与含量" }],
    default_config: "每人拥有独立层级和不同内容量，不追求平均；当前层开放后允许自行公开、隐瞒或误述。",
    legal_actions: ["自行公开", "隐瞒", "误述", "获取下一层"],
    round_flow: ["当前层开放", "可公开/隐瞒/误述", "条件满足开放下一层"],
    settlement_rules: ["下一层条件只能读取本人的正式状态"],
    tie_rule: "不需要", timeout_rule: "最低内容不得被卡死", reconnect_rule: "掉线保留已开放层",
    host_permissions: ["配置分层"], online_components: ["记忆层", "开放按钮"],
    output_fields: ["已开放层", "本人正式状态"], editable_parameters: ["层级条件", "层内含量"],
    locked_rules: ["平台不跟踪普通谈话", "不能因其他玩家没配合而永久卡住最低内容"],
    required_fields: ["content_id", "事实来源", "接收者", "层条件", "超时替代", "开放后权限变化"],
    verification_rules: [],
  }),
  sc("M07-5", "M07", {
    kind: "STORY_CONTRACT", name: "身份权限变化", default_name: "先发内容再启用权限", nature: "STORY_BOUND",
    participation_mode: "STATE_QUALIFIED", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "QUICK", minutes: "按身份", structure: "两字段分离：内容先发，界面权限后启用" }],
    default_config: "身份显现与权限变更分两个字段：先发内容，再由规则表启用界面权限。",
    legal_actions: ["无（自动启用）"],
    round_flow: ["先发内容", "再按规则表启用界面权限"],
    settlement_rules: ["新权限必须在底稿中已有来源、范围、次数和失效节点"],
    tie_rule: "不需要", timeout_rule: "按规则表", reconnect_rule: "掉线保留身份状态",
    host_permissions: ["配置权限表"], online_components: ["身份状态", "权限开关"],
    output_fields: ["身份显现", "启用权限"], editable_parameters: ["权限表"],
    locked_rules: ["不允许新身份突然获得用来解决既有设计缺口的万能能力"],
    required_fields: ["content_id", "权限来源", "范围", "次数", "失效节点", "最早可开放幕"],
    verification_rules: [],
  }),
  sc("M07-6", "M07", {
    kind: "STORY_CONTRACT", name: "旧事实重新解释", default_name: "只加背景不改行动", nature: "STORY_BOUND",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "QUICK", minutes: "按补充", structure: "保存OBJECTIVE_EVENT/EARLY_INTERPRETATION/LATER_CONTEXT" }],
    default_config: "后续只增加背景或主观意义，不能改写早期动作、位置与已知范围。",
    legal_actions: ["补充解释"],
    round_flow: ["保存三层数据", "补充背景或主观意义", "运行早期知情冲突检查"],
    settlement_rules: ["不改写早期动作、位置与已知范围", "自动运行早期知情冲突检查"],
    tie_rule: "不需要", timeout_rule: "冲突则暂停", reconnect_rule: "保持既有数据",
    host_permissions: ["接收补充"], online_components: ["三层数据", "冲突检查提示"],
    output_fields: ["早期知情冲突结果"], editable_parameters: ["补充内容"],
    locked_rules: ["后续设定若意味着人物早期必知却仍按未知行动，则暂停"],
    required_fields: ["content_id", "OBJECTIVE_EVENT", "EARLY_INTERPRETATION", "LATER_CONTEXT"],
    verification_rules: ["不能改写早期动作、位置与已知范围"],
  }),
  sc("M07-7", "M07", {
    kind: "STORY_CONTRACT", name: "主动选择保留或恢复", default_name: "优先开放既有内容", nature: "STORY_BOUND",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "QUICK", minutes: "按选择", structure: "从2-4项既有内容中选择优先开放" }],
    default_config: "玩家从2—4项既有内容中选择优先开放，或支付正式资源增加选择数。",
    legal_actions: ["选择优先开放项", "支付资源增加选择数"],
    round_flow: ["展示候选", "选择优先开放", "未选择项继续保持封闭"],
    settlement_rules: ["结算保存所选内容ID和永久关闭状态", "不让主持人口头补齐"],
    tie_rule: "未选即保持封闭", timeout_rule: "未提交按保持封闭", reconnect_rule: "掉线保留选择",
    host_permissions: ["配置候选"], online_components: ["候选列表", "资源支付"],
    output_fields: ["所选内容ID", "永久关闭状态"], editable_parameters: ["候选", "选择数"],
    locked_rules: ["未选择项允许继续封闭，但不可含后续启动所需的唯一事实"],
    required_fields: ["候选内容", "每次选择代价", "封锁状态"],
    verification_rules: [],
  }),
  sc("M07-8", "M07", {
    kind: "STORY_CONTRACT", name: "集合属性探测", default_name: "聚合验身", nature: "STORY_BOUND",
    participation_mode: "STATE_QUALIFIED", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "QUICK", minutes: "按探测", structure: "2—5人一组；只返回集合信息" }],
    default_config: "玩家按规则选择一组合法对象正式提交；服务器读取同一时点真实属性，只返回预设聚合结果（多数/数量/区间/奇偶/是否一致/是否至少一名），不直接标出任何个人。",
    legal_actions: ["选择一组合法对象", "正式提交"],
    round_flow: ["选择一组合法对象", "正式提交", "服务器读取同一时点的真实属性", "只返回预设聚合结果"],
    settlement_rules: ["默认只给多数/数量/区间/奇偶/是否一致/是否至少一名等集合信息", "不直接标出任何个人"],
    tie_rule: "不需要", timeout_rule: "超时不消耗次数", reconnect_rule: "掉线发起者按未提交处理",
    host_permissions: ["配置被探测字段", "设置集合大小与聚合模式", "设置次数与信息预算"],
    online_components: ["对象选择", "聚合结果", "次数余量"],
    output_fields: ["聚合结果", "剩余次数"], editable_parameters: ["聚合模式", "集合大小", "次数", "信息预算"],
    locked_rules: ["被探测属性必须已存在于正式身份/阵营/状态字段，不能临时生成善恶值等作者解释", "聚合结果只能描述既有字段，不能因多数为某阵营就反向改写任何人的真实归属"],
    exception_notes: ["对象不足、重复对象、非法对象或超时均不消耗次数", "同一次探测中所有对象必须读取同一时点"],
    required_fields: ["被探测属性", "合法对象集", "集合大小", "聚合模式", "次数上限", "快照规则", "信息预算"],
    verification_rules: ["动态身份必须明确读取当前状态还是阶段锁定快照", "单次探测即可意外唯一解出全桌身份而设计目标并非如此时返回 HOLD"],
  }),

  /* -------- M08 阵营机制 -------- */
  sc("M08-1", "M08", {
    kind: "STORY_CONTRACT", name: "固定公开阵营", default_name: "开场公布归属与目标", nature: "STORY_BOUND",
    participation_mode: "TEAM_BY_RULE", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STANDARD", minutes: "按任务", structure: "公开阵营多任务结算" }],
    default_config: "开场公布归属、目标和能力；人数与能力差异分开平衡。",
    legal_actions: ["阵营专属行动", "公共任务行动"],
    round_flow: ["开场公布归属目标能力", "阵营行动", "公共任务多方式结算"],
    settlement_rules: ["可采用队伍资源、区域分或公共任务不同完成方式结算"],
    tie_rule: "不需要", timeout_rule: "按公共任务结算", reconnect_rule: "掉线保留阵营归属",
    host_permissions: ["配置阵营与目标"], online_components: ["阵营面板", "任务进度"],
    output_fields: ["阵营结果", "任务完成度"], editable_parameters: ["阵营", "目标", "结算方式"],
    locked_rules: ["不能让人数多的一方同时拥有信息与数值优势"],
    required_fields: ["阵营", "归属时间线", "知识范围", "合法阵营行动", "可观察后果", "成功条件", "平局/拒绝/掉线规则"],
    verification_rules: [],
  }),
  sc("M08-2", "M08", {
    kind: "STORY_CONTRACT", name: "固定隐藏阵营", default_name: "归属仅本人可见", nature: "STORY_BOUND",
    participation_mode: "TEAM_BY_RULE", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STANDARD", minutes: "按任务", structure: "隐藏阵营+可观察行动差异" }],
    default_config: "归属固定但仅本人可见；必须存在可观察行动差异，而非只能猜身份。",
    legal_actions: ["普通行动", "阵营专属行动"],
    round_flow: ["秘密提交普通/专属行动", "专属行动可隐去行动者但保留结果", "统一结算"],
    settlement_rules: ["普通行动与阵营专属行动分开提交", "专属行动可隐去行动者但保留结果"],
    tie_rule: "不需要", timeout_rule: "按公共任务", reconnect_rule: "掉线保留阵营归属",
    host_permissions: ["配置阵营"], online_components: ["行动提交", "结果面板"],
    output_fields: ["阵营结果", "可观察后果"], editable_parameters: ["阵营", "行动差异"],
    locked_rules: ["结算前不得由主持人提前泄露阵营数量"],
    required_fields: ["阵营", "归属时间线", "可观察行动差异", "知识范围", "合法阵营行动", "成功条件"],
    verification_rules: ["必须存在可观察行动差异，而非只能猜身份"],
  }),
  sc("M08-3", "M08", {
    kind: "STORY_CONTRACT", name: "非对称阵营", default_name: "各阵营不同接口与条件", nature: "STORY_BOUND",
    participation_mode: "TEAM_BY_RULE", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STANDARD", minutes: "按任务", structure: "非对称接口与成功条件" }],
    default_config: "各阵营拥有不同操作接口、资源和成功条件；允许同时成功或同时失败。",
    legal_actions: ["各阵营专属行动"],
    round_flow: ["阵营独立行动", "按各自条件结算"],
    settlement_rules: ["允许同时成功或同时失败"],
    tie_rule: "允许同成同败", timeout_rule: "按各方条件", reconnect_rule: "掉线保留阵营归属",
    host_permissions: ["配置非对称阵营"], online_components: ["阵营面板", "结果面板"],
    output_fields: ["各阵营结果", "共同状态影响"], editable_parameters: ["阵营", "接口", "条件"],
    locked_rules: ["平衡以达到目标的机会而非文字长度或人数相等衡量", "每个阵营必须有至少一种能影响共同状态的有效行动"],
    required_fields: ["阵营", "操作接口", "资源", "成功条件", "共同状态", "可观察后果"],
    verification_rules: [],
  }),
  sc("M08-4", "M08", {
    kind: "STORY_CONTRACT", name: "动态阵营", default_name: "只在预设节点改变归属", nature: "STORY_BOUND",
    participation_mode: "TEAM_BY_RULE", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STANDARD", minutes: "按节点", structure: "预设节点改变归属" }],
    default_config: "只在预设节点因选择、结算码或身份恢复改变归属；保存历史归属。",
    legal_actions: ["阵营行动", "触发改变节点"],
    round_flow: ["阵营行动", "触发改变条件", "保存历史归属", "旧贡献按当时阵营解释"],
    settlement_rules: ["保存历史归属、当前归属、旧贡献归属算法和知情范围"],
    tie_rule: "不需要", timeout_rule: "按预设节点", reconnect_rule: "掉线保留归属状态",
    host_permissions: ["配置节点"], online_components: ["归属面板", "变更日志"],
    output_fields: ["当前归属", "历史归属", "旧贡献归属"], editable_parameters: ["改变条件", "知情范围"],
    locked_rules: ["变化后此前行动仍按当时阵营解释，不能追溯重算"],
    required_fields: ["阵营", "预设节点", "改变条件", "历史归属", "旧贡献归属算法", "知情范围"],
    verification_rules: [],
  }),
  sc("M08-5", "M08", {
    kind: "STORY_CONTRACT", name: "个人目标叠加阵营目标", default_name: "阵营与个人分别结算", nature: "STORY_BOUND",
    participation_mode: "TEAM_BY_RULE", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STANDARD", minutes: "按任务", structure: "阵营+个人双结算" }],
    default_config: "阵营与个人分别结算，可同时成败；个人目标不要求全部背叛阵营。",
    legal_actions: ["阵营行动", "个人目标行动"],
    round_flow: ["阵营行动", "个人目标行动", "分别结算"],
    settlement_rules: ["阵营与个人分别结算，可同时成败"],
    tie_rule: "不需要", timeout_rule: "按两种条件", reconnect_rule: "掉线保留目标状态",
    host_permissions: ["配置个人目标"], online_components: ["阵营目标", "个人目标"],
    output_fields: ["阵营结果", "个人结果"], editable_parameters: ["个人目标", "阵营条件"],
    locked_rules: ["个人目标不应全部要求背叛阵营", "个人结算只读取正式状态，不读取无法核验表演结果"],
    required_fields: ["阵营", "个人目标", "个人高级条件", "正式状态读取范围"],
    verification_rules: ["每人0—2项个人目标即可，允许某些人没有额外目标"],
  }),
  sc("M08-6", "M08", {
    kind: "STORY_CONTRACT", name: "临时联盟", default_name: "规定节点建立联盟", nature: "STORY_BOUND",
    participation_mode: "TEAM_BY_RULE", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STANDARD", minutes: "按节点", structure: "双确认联盟+共享范围" }],
    default_config: "玩家可在规定节点建立联盟；需双确认，设持续时间、共享范围和退出成本。",
    legal_actions: ["提出联盟", "接受", "退出"],
    round_flow: ["规定节点提出联盟", "双确认", "写入持续时间/共享范围/退出成本", "退出"],
    settlement_rules: ["只共享合同规定的资源、行动或结算", "退出需支付成本"],
    tie_rule: "不需要", timeout_rule: "超时未确认作废", reconnect_rule: "掉线保留联盟状态",
    host_permissions: ["配置联盟规则"], online_components: ["联盟面板", "共享资源"],
    output_fields: ["联盟", "共享范围", "退出成本"], editable_parameters: ["联盟规则"],
    locked_rules: ["联盟不会自动共享私人内容", "零成本反复加入退出应被规则禁止"],
    required_fields: ["联盟成员", "持续时间", "共享范围", "退出成本", "正式状态读取范围"],
    verification_rules: [],
  }),
  sc("M08-7", "M08", {
    kind: "STORY_CONTRACT", name: "阵营影响公共任务", default_name: "先公共后阵营", nature: "STORY_BOUND",
    participation_mode: "TEAM_BY_RULE", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STANDARD", minutes: "按任务", structure: "公共任务客观状态先结算" }],
    default_config: "先定义独立可运行的公共任务，再定义各阵营希望其成功、失败、延迟或采用不同方案。",
    legal_actions: ["公共任务行动", "正式破坏动作"],
    round_flow: ["先结算公共任务客观状态", "分别检查阵营条件"],
    settlement_rules: ["先结算公共任务客观状态，再分别检查阵营条件"],
    tie_rule: "不需要", timeout_rule: "按公共任务结算", reconnect_rule: "掉线保留公共任务状态",
    host_permissions: ["配置公共任务"], online_components: ["公共任务", "阵营结果"],
    output_fields: ["公共任务状态", "阵营条件结果"], editable_parameters: ["公共任务", "破坏规则"],
    locked_rules: ["破坏必须通过有次数与成本的正式动作", "拒绝参与不能成为稳定必胜策略"],
    required_fields: ["公共任务", "阵营立场偏好", "正式破坏动作", "次数/成本", "共同状态"],
    verification_rules: [],
  }),
  sc("M08-8", "M08", {
    kind: "STORY_CONTRACT", name: "多阵营并存", default_name: "三阵营非对称", nature: "STORY_BOUND",
    participation_mode: "TEAM_BY_RULE", player_count: { min: 7, max: 9 },
    duration_presets: [{ tier: "STANDARD", minutes: "按任务", structure: "条件表结算，不强制单一冠军" }],
    default_config: "推荐7—9人、3个阵营；阵营数不得接近玩家数。",
    legal_actions: ["阵营行动"],
    round_flow: ["阵营行动", "条件表结算"],
    settlement_rules: ["使用条件表结算，不强制单一冠军", "允许A成功+B失败+C部分成功"],
    tie_rule: "不强制单一冠军，允许多档并存", timeout_rule: "按条件表", reconnect_rule: "掉线保留阵营归属",
    host_permissions: ["配置阵营与条件表"], online_components: ["阵营面板", "条件表"],
    output_fields: ["各阵营档位", "共同状态"], editable_parameters: ["阵营", "条件表"],
    locked_rules: ["阵营数不得接近玩家数", "必须测试两阵营联合是否能无成本永久压制第三方"],
    required_fields: ["阵营", "条件表", "胜负档位", "可观察后果", "成功条件"],
    verification_rules: [],
  }),

  /* -------- M10 阶段选择与结局映射 -------- */
  sc("M10-1", "M10", {
    kind: "STORY_CONTRACT", name: "单项正式选择", default_name: "每人选一项", nature: "STORY_BOUND",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "QUICK", minutes: "按阶段", structure: "2-5个有真实差异的选项" }],
    default_config: "每人从2—5个有真实差异的选项中选一项；可设公开或私密、是否允许截止前修改。",
    legal_actions: ["选择一项", "截止前修改"],
    round_flow: ["展示选项", "选择", "截止", "改变后续状态或文本分支"],
    settlement_rules: ["每项必须至少改变一个后续状态或文本分支"],
    tie_rule: "不需要", timeout_rule: "未提交走预设保守出口，不由主持人代选", reconnect_rule: "掉线走保守出口",
    host_permissions: ["配置选项"], online_components: ["选项列表", "选择面板"],
    output_fields: ["选择项", "改变的分支"], editable_parameters: ["选项", "公开程度", "是否可改"],
    locked_rules: ["同义选项应合并"],
    required_fields: ["有真实差异的选项", "每项后续状态/文本分支", "保守出口"],
    verification_rules: ["未提交走预设保守出口，不由主持人代选"],
  }),
  sc("M10-2", "M10", {
    kind: "STORY_CONTRACT", name: "多项优先级选择", default_name: "完整排序或有限点数", nature: "STORY_BOUND",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "QUICK", minutes: "按阶段", structure: "完整排序或有限点数分配" }],
    default_config: "采用完整排序或有限点数分配；系统校验重复名次和超额点数。",
    legal_actions: ["排序", "分配点数", "提交"],
    round_flow: ["排序或分配点数", "校验", "结算读取最高优先项与明确放弃项"],
    settlement_rules: ["结算读取最高优先项与明确放弃项", "如果全部都能获得，机制无效"],
    tie_rule: "平级时使用此前状态或预设并存结果", timeout_rule: "按预设保守出口", reconnect_rule: "掉线保留已提交",
    host_permissions: ["配置选项与点数"], online_components: ["排序面板", "点数分配"],
    output_fields: ["最高优先项", "放弃项", "结果"], editable_parameters: ["选项", "点数", "校验规则"],
    locked_rules: ["平级时使用此前状态或预设并存结果，不临场解释"],
    required_fields: ["选项", "点数上限", "平级规则", "保守出口"],
    verification_rules: [],
  }),
  sc("M10-3", "M10", {
    kind: "STORY_CONTRACT", name: "成对或分组问答", default_name: "组合关系问答", nature: "STORY_BOUND",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "QUICK", minutes: "按选择", structure: "每组1-3个预先写定问题" }],
    default_config: "组合关系必须在前文成立；每组回答1—3个预先写定问题；保存双方各自答案与一致/分歧。",
    legal_actions: ["回答问题", "确认一致/分歧"],
    round_flow: ["展示组合", "各自回答", "保存一致性", "输出结果"],
    settlement_rules: ["保存双方各自答案与一致/分歧，不强制达成共识"],
    tie_rule: "分歧作为结果保存", timeout_rule: "未提交按无答案", reconnect_rule: "掉线保留已答",
    host_permissions: ["配置问答"], online_components: ["问题面板", "一致性显示"],
    output_fields: ["双方答案", "一致/分歧", "结果"], editable_parameters: ["问题", "组合关系"],
    locked_rules: ["每种答案组合都有结果，不能只写一致成功、分歧再议"],
    required_fields: ["组合关系", "每组问题", "答案组合结果集"],
    verification_rules: [],
  }),
  sc("M10-4", "M10", {
    kind: "STORY_CONTRACT", name: "条件式结局矩阵", default_name: "按前序状态匹配结局", nature: "STORY_BOUND",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STANDARD", minutes: "按矩阵", structure: "条件按优先级匹配" }],
    default_config: "输入仅限前序结算码、剩余资源、正式关系、阵营结果和最终选择；条件按优先级匹配。",
    legal_actions: ["无（读取状态）"],
    round_flow: ["枚举合法输入组合", "按优先级匹配", "报告无出口与不可达结局"],
    settlement_rules: ["每个可能状态至少命中一个结果", "多个条件同时命中时使用明确覆盖顺序"],
    tie_rule: "按覆盖顺序", timeout_rule: "按兜底结果", reconnect_rule: "按兜底结果",
    host_permissions: ["配置矩阵"], online_components: ["结局矩阵", "覆盖顺序"],
    output_fields: ["命中结局", "不可达报告"], editable_parameters: ["条件", "优先级", "结局"],
    locked_rules: ["M10不创造新的关系/历史/答案"],
    required_fields: ["前序结算码", "剩余资源", "正式关系", "阵营结果", "最终选择", "优先级", "兜底结果"],
    verification_rules: ["编译器枚举合法输入组合，报告无出口和不可达结局"],
  }),
  sc("M10-5", "M10", {
    kind: "STORY_CONTRACT", name: "个人结果与公共结果并行", default_name: "两层结果都保留", nature: "STORY_BOUND",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STANDARD", minutes: "按结果", structure: "先公共后逐人" }],
    default_config: "先生成公共结果，再逐人读取个人状态生成去向；两层都保留。",
    legal_actions: ["无（读取状态）"],
    round_flow: ["先生成公共结果", "逐人读取个人状态", "生成去向"],
    settlement_rules: ["同一公共结果下个人可不同", "个人结果至少读取一项此前正式状态"],
    tie_rule: "不需要", timeout_rule: "某人缺分支用中性兜底", reconnect_rule: "按兜底映射",
    host_permissions: ["配置结果"], online_components: ["公共结果", "个人去向"],
    output_fields: ["公共结果", "逐人去向"], editable_parameters: ["结果映射", "兜底"],
    locked_rules: ["个人结果不能完全由最后一次点击决定"],
    required_fields: ["公共结果", "个人状态读取项", "逐人去向", "中性兜底"],
    verification_rules: ["某人缺少个人分支时使用中性兜底，不补写临时经历"],
  }),
  sc("M10-6", "M10", {
    kind: "STORY_CONTRACT", name: "延迟结算", default_name: "锁定选择后按时展示", nature: "STORY_BOUND",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "QUICK", minutes: "按延迟", structure: "当前节点锁定选择直到规定阶段" }],
    default_config: "当前节点只锁定选择，直到规定阶段才展示；锁定后是否可撤回必须明确。",
    legal_actions: ["锁定选择"],
    round_flow: ["当前节点锁定选择", "到规定阶段展示", "触发失败则按已锁选择进入兜底"],
    settlement_rules: ["后续触发失败、提前结束或掉线时，仍按已锁选择进入兜底映射"],
    tie_rule: "不需要", timeout_rule: "按已锁选择进入兜底映射", reconnect_rule: "按已锁选择进入兜底映射",
    host_permissions: ["配置延迟节点"], online_components: ["选择面板", "锁定期提示"],
    output_fields: ["已锁选择", "展示结果"], editable_parameters: ["延迟节点", "是否可撤回"],
    locked_rules: ["锁定后是否可撤回必须明确"],
    required_fields: ["选择项", "延迟展示节点", "撤回规则", "兜底映射"],
    verification_rules: ["选择界面应说明影响维度，但可以不透露具体文本"],
  }),

  /* -------- M11 世界状态、现场改写与因果传播 -------- */
  sc("M11-1", "M11", {
    kind: "STORY_CONTRACT", name: "可变现场", default_name: "现场改写", nature: "STORY_BOUND",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STANDARD", minutes: "按现场", structure: "2—5个地点；每人0—2次改写额度" }],
    default_config: "2—5个地点；每名合格玩家0—2次改写额度；进入地点时读取服务器当前快照；玩家的正式操作会改变之后别人面对的世界状态。",
    legal_actions: ["移动", "隐藏", "损坏", "移除", "恢复可恢复对象"],
    round_flow: ["选择合法改写动作", "服务器原子更新对象当前位置与状态", "写入不可删除的内部修改日志", "后续进入者读取更新后的现场"],
    settlement_rules: ["服务器原子更新对象当前位置与状态", "写入不可删除的内部修改日志", "后续进入者读取更新后的现场"],
    tie_rule: "不需要", timeout_rule: "超时保留额度", reconnect_rule: "掉线保留已确认改写",
    host_permissions: ["配置地点与改写额度", "锁定 IMMUTABLE_TRUTH 与最低备用路径"],
    online_components: ["地点列表", "对象位置", "当前快照", "改写日志"],
    output_fields: ["对象当前位置", "对象状态", "修改日志"], editable_parameters: ["地点数", "改写额度", "合法改动白名单"],
    locked_rules: ["玩家改变的是现场，不是过去；移动凶器不会改变谁曾经使用它，洗掉血迹不会改变曾经发生过流血"],
    exception_notes: ["同一对象被同时操作时按服务器锁顺序执行", "后提交者若前置状态已变化则收到 INVALID_ACTION 并保留额度", "任何后续必需判断至少有一条不依赖单一可移除对象的备用路径"],
    required_fields: ["地点", "不可变真相引用", "现场实体", "可变字段", "合法改动白名单", "改动额度", "观察规则", "最低备用路径", "超时与恢复规则"],
    verification_rules: ["IMMUTABLE_TRUTH 与 CURRENT_WORLD_STATE 分离维护", "每项修改保留 PROVENANCE；是否向玩家开放溯源由剧情合同决定"],
  }),
  sc("M11-2", "M11", {
    kind: "STORY_CONTRACT", name: "有源伪造", default_name: "新增与篡改对象", nature: "STORY_BOUND",
    participation_mode: "STATE_QUALIFIED", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STANDARD", minutes: "按伪造", structure: "预声明对象类型与可填写字段创建" }],
    default_config: "允许玩家制造假物/假标记/假记录，或修改现有对象的可见字段以误导后来调查者；只改变可观察现场，不自动改变身份、历史、责任或真相。",
    legal_actions: ["选择对象类型或目标对象", "填写允许字段", "选择地点", "预览", "确认写入"],
    round_flow: ["选择对象类型或目标对象", "填写允许字段", "选择地点", "预览", "确认", "写入当前世界"],
    settlement_rules: ["对玩家显示的对象与内部 PROVENANCE 分开保存", "后续 M01 只按进入时可观察到的版本提供信息"],
    tie_rule: "不需要", timeout_rule: "超时整次失败不部分写入", reconnect_rule: "掉线保留已写入对象",
    host_permissions: ["配置伪造额度与对象类型", "锁定真实来源与不可变字段"],
    online_components: ["对象类型选择", "字段填写", "地点选择", "预览"],
    output_fields: ["新对象", "可见字段", "PROVENANCE"], editable_parameters: ["对象类型", "可填写字段", "伪造额度", "地点容量"],
    locked_rules: ["自由文字只作为展示内容，不自动获得真实身份证明/伤害值/系统权限等机械属性", "平台不替玩家判断伪造像不像真的；伪造成功仅表示对象合法进入世界，不代表其他玩家必须相信"],
    exception_notes: ["伪造额度用尽、对象类型非法、目标字段锁定或地点容量不足时整次失败", "真实来源、原始创建者和客观事件引用永久保留"],
    required_fields: ["预声明对象类型", "可填写字段白名单", "篡改字段白名单", "伪造额度", "地点容量", "不可变字段"],
    verification_rules: ["篡改只能修改白名单字段；真实来源与不可变字段永不覆盖"],
  }),
  sc("M11-3", "M11", {
    kind: "STORY_CONTRACT", name: "剧情状态传播", default_name: "状态改变后续行动", nature: "STORY_BOUND",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "STANDARD", minutes: "按状态", structure: "预声明正式状态驱动下游变化" }],
    default_config: "某个正式行为使人物进入可验证状态，而该状态改变后续能做什么/能看到什么/触发什么机制；名称可换题材，但执行语义必须明确。",
    legal_actions: ["施加状态（按规则）", "读取状态"],
    round_flow: ["正式行为触发状态", "读取状态字段", "改变后续行动/可见度/触发机制", "按恢复规则解除"],
    settlement_rules: ["每个下游变化必须明确读取哪个状态字段", "状态未触发时必须存在对应未触发分支"],
    tie_rule: "不需要", timeout_rule: "状态未触发走未触发分支", reconnect_rule: "掉线保留状态时点",
    host_permissions: ["配置状态定义与触发", "锁定不可写关系/动机/罪责"],
    online_components: ["状态面板", "状态症状", "下游触发"],
    output_fields: ["状态", "开始/结束时点", "行动权限变化"], editable_parameters: ["状态定义", "时长", "叠加规则", "恢复规则"],
    locked_rules: ["不得写因此他情绪失控所以一定去杀人这类人格强制", "不能禁止现实玩家发言，也不能让角色永久离场", "M11 只传播正式状态及其规则后果，不自动生成新关系/动机/罪责/情感立场"],
    exception_notes: ["状态开始、结束和观察时点必须可追溯", "若某人当时处于无法行动状态，后续时间线不得同时要求其完成冲突动作", "必要后续不得只有某玩家必须成功施加状态这一条入口"],
    required_fields: ["触发动作或事件", "目标", "状态加入", "开始条件", "时长或结束条件", "行动权限变化", "可见度变化", "可观察症状", "下游触发", "叠加规则", "恢复规则"],
    verification_rules: [],
  }),
  sc("M11-4", "M11", {
    kind: "STORY_CONTRACT", name: "现场快照与版本读取", default_name: "时点见证", nature: "STORY_BOUND",
    participation_mode: "ALL", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "QUICK", minutes: "按进入", structure: "进入地点时保存快照" }],
    default_config: "为不同玩家保存进入同一地点时看到的不同版本，支持先来者改过、后来者看到已改现场的连续运行。",
    legal_actions: ["进入地点（读取快照）", "重复进入"],
    round_flow: ["进入地点", "读取当时快照", "保存版本号与溯源", "后续回忆引用自己快照"],
    settlement_rules: ["玩家之后回忆或提交只能引用自己实际取得的快照与后来正式获得的信息", "平台不自动把最新现场同步成你当时也看见了"],
    tie_rule: "不需要", timeout_rule: "技术断线发生在快照确认前则不算进入", reconnect_rule: "确认后即使掉线，已取得快照仍有效",
    host_permissions: ["配置快照字段"],
    online_components: ["快照面板", "版本号"],
    output_fields: ["快照", "版本号", "溯源"], editable_parameters: ["快照字段", "是否允许重复进入"],
    locked_rules: ["旧快照保留不覆盖"],
    exception_notes: ["若规则允许再次进入，则产生新快照；旧快照保留不覆盖"],
    required_fields: ["地点", "快照字段（地点/进入时间/可见对象ID/对象可见字段/当时可见状态）", "版本号规则", "溯源可见范围"],
    verification_rules: [],
  }),
  sc("M11-5", "M11", {
    kind: "STORY_CONTRACT", name: "世界状态恢复", default_name: "合法复原", nature: "STORY_BOUND",
    participation_mode: "STATE_QUALIFIED", player_count: { min: 4, max: 9 },
    duration_presets: [{ tier: "QUICK", minutes: "按恢复", structure: "预设行动恢复可恢复对象" }],
    default_config: "某些对象或状态允许通过预设行动恢复；恢复只改变 CURRENT_WORLD_STATE，历史修改日志仍保留。",
    legal_actions: ["恢复可恢复对象", "保留可见痕迹"],
    round_flow: ["选择可恢复对象", "支付所需资源/权限", "恢复到指定版本", "保留可见痕迹"],
    settlement_rules: ["恢复只改变 CURRENT_WORLD_STATE", "历史修改日志仍保留"],
    tie_rule: "不需要", timeout_rule: "超时按未恢复处理", reconnect_rule: "掉线保留已恢复状态",
    host_permissions: ["配置可恢复范围与版本"],
    online_components: ["可恢复列表", "恢复确认"],
    output_fields: ["恢复后的当前状态", "历史修改日志"], editable_parameters: ["可恢复范围", "所需资源/权限", "目标版本"],
    locked_rules: ["不可恢复对象必须在开局前标记", "不能因为玩家解题困难而临时把不可恢复对象复原"],
    exception_notes: [],
    required_fields: ["可恢复范围", "所需资源/权限", "恢复到哪个版本", "是否保留可见痕迹"],
    verification_rules: ["恢复不是主持人救场式回滚"],
  }),
];

/* ==================== 第三部分：原子效果库 ==================== */

export interface AtomicEffectV2 {
  code: string;
  semantics: string;
  params: string;
  conflict: string;
}

/** §第三部分 原子效果库：效果码与表现名称分离；换题材只改表现，不改执行语义。 */
export const ATOMIC_EFFECTS: ReadonlyArray<AtomicEffectV2> = Object.freeze([
  { code: "DAMAGE", semantics: "减少目标生命或耐久", params: "amount,target", conflict: "先减护盾后减生命" },
  { code: "HEAL", semantics: "恢复但不超过上限", params: "amount,target", conflict: "归零后是否可恢复由模板锁定" },
  { code: "SHIELD", semantics: "抵消后续损失", params: "amount,duration", conflict: "同类默认相加，上限由模板设定" },
  { code: "DRAW", semantics: "从服务器牌堆取得内容", params: "count,visibility", conflict: "牌堆不足按预设洗回或停止" },
  { code: "DISCARD", semantics: "移除所持组件", params: "count,selector", conflict: "不足时整次失败" },
  { code: "STEAL", semantics: "从目标转移资源", params: "amount,resource_scope", conflict: "仅可转移规则资源，不触碰普通信息" },
  { code: "SWAP", semantics: "两个正式状态互换", params: "field_a,field_b", conflict: "必须原子执行" },
  { code: "COPY", semantics: "复制一次可复制效果", params: "source,effect_scope", conflict: "不复制唯一奖励与身份状态" },
  { code: "LOCK", semantics: "暂停某项合法操作", params: "action,duration", conflict: "不得锁死全部操作" },
  { code: "SILENCE", semantics: "禁止正式提交某类动作", params: "action,duration", conflict: "不限制现实语音发言" },
  { code: "SKIP_TURN", semantics: "本轮采用模板默认行动", params: "target", conflict: "不让玩家永久离场" },
  { code: "EXTRA_ACTION", semantics: "增加一次正式行动", params: "action_scope", conflict: "不能跨越阶段上限" },
  { code: "RESOURCE_GAIN", semantics: "增加规则资源", params: "resource,amount", conflict: "受容量上限限制" },
  { code: "RESOURCE_LOSS", semantics: "扣除规则资源", params: "resource,amount", conflict: "不产生负数" },
  { code: "REVEAL_PUBLIC", semantics: "向全体开放既有内容", params: "content_id", conflict: "内容必须预先存在" },
  { code: "REVEAL_PRIVATE", semantics: "向指定玩家开放既有内容", params: "content_id,target", conflict: "接收者自行决定是否公开" },
  { code: "REROLL", semantics: "重投一次随机结果", params: "scope", conflict: "新结果覆盖旧结果并保留日志" },
  { code: "REDIRECT", semantics: "改变一个动作目标", params: "source,new_target", conflict: "只能在结算窗口内使用" },
  { code: "COUNTER", semantics: "取消一个允许被反制的效果", params: "effect_id", conflict: "不能反制结算码" },
  { code: "IMMUNITY", semantics: "在期限内免疫指定效果", params: "effect_scope,duration", conflict: "不允许全效果永久免疫" },
  { code: "AREA_CONTROL", semantics: "增减区域控制值", params: "area,amount", conflict: "同时提交后统一结算" },
  { code: "SCORE_GAIN", semantics: "增加正式积分", params: "amount", conflict: "记录来源" },
  { code: "SCORE_MULTIPLY", semantics: "乘算一类得分", params: "factor,scope", conflict: "默认在加算后执行" },
  { code: "BID", semantics: "冻结并提交报价", params: "amount,asset", conflict: "成交或失败后解冻/扣除" },
  { code: "WITHDRAW", semantics: "撤销尚未成交操作", params: "action_id", conflict: "已结算状态不可撤回" },
  { code: "ENTITY_CREATE", semantics: "在可变世界中创建一个规则允许的对象", params: "entity_type,location,fields", conflict: "服务器生成唯一ID；自由文字不自动获得机械属性" },
  { code: "ENTITY_MOVE", semantics: "改变对象当前地点", params: "entity_id,new_location", conflict: "原子移动；对象状态已变则整次失败" },
  { code: "ENTITY_ALTER", semantics: "修改对象白名单字段", params: "entity_id,field_patch", conflict: "真实来源与不可变字段永不覆盖" },
  { code: "ENTITY_REMOVE", semantics: "令对象从当前现场不可见/不可用", params: "entity_id,mode", conflict: "仅改当前状态；内部来源与修改日志保留" },
  { code: "STATE_APPLY", semantics: "向目标施加预声明正式状态", params: "state_id,target,duration", conflict: "按该状态的 stacking_rule 处理" },
  { code: "STATE_CLEAR", semantics: "解除一个允许恢复的正式状态", params: "state_id,target", conflict: "不可恢复状态拒绝执行；历史记录保留" },
  { code: "PERMISSION_GRANT", semantics: "临时开放既有正式操作权限", params: "action_scope,target,duration", conflict: "只能开放模板预声明操作" },
  { code: "PERMISSION_REVOKE", semantics: "临时关闭指定正式操作权限", params: "action_scope,target,duration", conflict: "不得关闭全部基础参与能力" },
]);

/* ==================== 第四部分：模板参数兼容与选择 ==================== */

/** §4.2 时长档位结构。 */
export const DURATION_TIERS: ReadonlyArray<{ tier: DurationTier; minutes: string; structure: string }> = Object.freeze([
  { tier: "QUICK", minutes: "10—15分钟", structure: "一次提交或单轮结算" },
  { tier: "STANDARD", minutes: "20—30分钟", structure: "3—6轮，至少一次状态变化" },
  { tier: "EXTENDED", minutes: "35—50分钟", structure: "多轮加阶段转折，不靠拉长发言" },
  { tier: "STORY_MAJOR", minutes: "60—90分钟", structure: "仅用于有足够底稿的剧情绑定机制" },
]);

/** §4.1 人数适配（4—5人 / 6—7人 / 8—9人 场景建议，紧凑文本，非可执行逻辑）。 */
export const PLAYER_ADAPTATION: ReadonlyArray<{ tag: string; fourFive: string; sixSeven: string; eightNine: string }> = Object.freeze([
  { tag: "自由交易", fourFive: "可直接私聊", sixSeven: "限制并行单数", eightNine: "优先报价板与限次密谈" },
  { tag: "单标的竞价", fourFive: "直接运行", sixSeven: "直接运行", eightNine: "缩短叫价窗或用暗标" },
  { tag: "轮流牌局", fourFive: "可逐人操作", sixSeven: "采用同步决策", eightNine: "必须同步决策" },
  { tag: "拼接", fourFive: "一块共享板", sixSeven: "一名编辑者轮换", eightNine: "分组或编辑令牌" },
  { tag: "数值对抗", fourFive: "个人或2队", sixSeven: "同时提交", eightNine: "避免逐人动画与长期淘汰" },
  { tag: "投票", fourFive: "普通多数", sixSeven: "普通或排序", eightNine: "排序、多答案保留更稳" },
  { tag: "隐藏阵营", fourFive: "谨慎使用", sixSeven: "双阵营可用", eightNine: "可用非对称三阵营" },
  { tag: "集合属性探测", fourFive: "2—3人一组、少量次数", sixSeven: "3人组最稳定", eightNine: "限制探测次数并做信息预算检查" },
  { tag: "可变现场", fourFive: "2—3地点、每人至多1次改写", sixSeven: "3—4地点、允许顺序进入", eightNine: "分区或地点锁，避免全员同时改同一现场" },
  { tag: "状态因果传播", fourFive: "少量状态直接读取", sixSeven: "可串联1—2个下游机制", eightNine: "必须限制触发扇出，避免状态组合爆炸" },
]);

/* ==================== 导出与工具函数 ==================== */

export const TEMPLATES: ReadonlyArray<MechanismTemplateV2> = Object.freeze([
  ...READY_TEMPLATES,
  ...STORY_CONTRACTS,
]);

export const READY_TEMPLATE_COUNT = READY_TEMPLATES.length;   // 39
export const STORY_CONTRACT_COUNT = STORY_CONTRACTS.length;   // 37
export const TEMPLATE_COUNT = TEMPLATES.length;                // 76

export interface TemplateSelectionQuery {
  kind?: V2Kind;
  nature?: V2Nature;
  family_id?: FamilyId;
  role?: MechanismRole;
  min_players?: number;
  max_players?: number;
  duration_tier?: DurationTier;
}

/** 按条件程序筛出候选项（只读筛选，不改数据）。 */
export function selectByKind(query: TemplateSelectionQuery = {}): MechanismTemplateV2[] {
  return TEMPLATES.filter((t) => {
    if (query.kind && t.kind !== query.kind) return false;
    if (query.nature && t.nature !== query.nature) return false;
    if (query.family_id && t.family_id !== query.family_id) return false;
    if (query.role && t.role !== query.role) return false;
    if (query.min_players != null && t.player_count.max < query.min_players) return false;
    if (query.max_players != null && t.player_count.min > query.max_players) return false;
    if (query.duration_tier && !t.duration_presets.some((d) => d.tier === query.duration_tier)) return false;
    return true;
  });
}

export function getTemplate(template_id: string): MechanismTemplateV2 | undefined {
  return TEMPLATES.find((t) => t.template_id === template_id);
}

export function isStoryContract(template_id: string): boolean {
  return getTemplate(template_id)?.kind === "STORY_CONTRACT";
}

export function isReadyTemplate(template_id: string): boolean {
  return getTemplate(template_id)?.kind === "READY_TEMPLATE";
}

export function mechanismRoleForTemplate(template_id: string): MechanismRole | undefined {
  const t = getTemplate(template_id);
  return t?.role ?? (t ? FAMILY_MECHANISM_ROLE[t.family_id] : undefined);
}

export function isGameMechanism(template_id: string): boolean {
  return mechanismRoleForTemplate(template_id) === "GAME_MECHANISM";
}

export function isStoryMechanism(template_id: string): boolean {
  return mechanismRoleForTemplate(template_id) === "STORY_MECHANISM";
}

export function selectByRole(role: MechanismRole): MechanismTemplateV2[] {
  return TEMPLATES.filter((t) => t.role === role);
}

/** 程序断言 76 = 39 + 37，防止未来编辑漏配。 */
export function assertTemplateIntegrity(): string[] {
  const problems: string[] = [];
  if (TEMPLATE_COUNT !== 76) problems.push(`期望 76 项，实际 ${TEMPLATE_COUNT}`);
  if (READY_TEMPLATE_COUNT !== 39) problems.push(`期望成品模板 39 项，实际 ${READY_TEMPLATE_COUNT}`);
  if (STORY_CONTRACT_COUNT !== 37) problems.push(`期望剧情合同 37 项，实际 ${STORY_CONTRACT_COUNT}`);
  const seen = new Set<string>();
  for (const t of TEMPLATES) {
    if (seen.has(t.template_id)) problems.push(`重复 template_id: ${t.template_id}`);
    seen.add(t.template_id);
    if (t.kind === "STORY_CONTRACT" && !t.required_fields?.length) {
      problems.push(`剧情合同缺少 required_fields: ${t.template_id}`);
    }
    if (!t.role) problems.push(`缺少 role: ${t.template_id}`);
    else if (t.role !== FAMILY_MECHANISM_ROLE[t.family_id]) {
      problems.push(`role 与家族映射不符: ${t.template_id} ${t.role} vs ${FAMILY_MECHANISM_ROLE[t.family_id]}`);
    }
  }
  return problems;
}

/** STORY_CONTRACT 已全部字段就绪可逐项确认时返回 true（用于确认协议闸门）。 */
export function isContractReadyForConfirm(template: MechanismTemplateV2): boolean {
  if (template.kind !== "STORY_CONTRACT") return true;
  return Boolean(template.required_fields?.length && template.duration_presets.length);
}

/** §1.4 跨机制链条校验：上游必须真实存在、下游必须真实存在、不得成环、无人达成时必须有兜底。 */
export function validateChain(chains: MechanismChainV2[]): string[] {
  const problems: string[] = [];
  for (const c of chains) {
    if (!getTemplate(c.upstream_instance_id)) problems.push(`链 ${c.chain_id} 上游 ${c.upstream_instance_id} 不存在`);
    if (!getTemplate(c.downstream_instance_id)) problems.push(`链 ${c.chain_id} 下游 ${c.downstream_instance_id} 不存在`);
    if (c.upstream_instance_id === c.downstream_instance_id) problems.push(`链 ${c.chain_id} 自环`);
    if (!Object.keys(c.fallback_mapping).length) problems.push(`链 ${c.chain_id} 缺少兜底映射 fallback_mapping`);
  }
  // 全链无终止循环（DFS 检测有向环）。
  const adj = new Map<string, string[]>();
  for (const c of chains) {
    const from = c.upstream_instance_id;
    adj.set(from, [...(adj.get(from) ?? []), c.downstream_instance_id]);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const dfs = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const next of adj.get(id) ?? []) {
      if (dfs(next)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  for (const id of adj.keys()) {
    if (dfs(id)) { problems.push(`跨机制链条存在循环依赖，涉及 ${id}`); break; }
  }
  return problems;
}