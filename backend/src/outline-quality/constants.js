/** Outline-quality-specific policy plus neutral contract re-exports. */

export {
  OUTLINE_VERSION,
  OUTLINE_REVISION,
  OUTLINE_REVISIONS,
  GENERIC_FINGERPRINT,
  GENERIC_ENDING_TITLE,
  STATE_OPERATIONS,
  RESOURCE_OPERATIONS,
  ENTITY_TYPES,
  RESPONSIBILITY_TYPES,
  CAUSAL_RESPONSIBILITY_TYPES,
  AUTHORIZATION_STATUSES,
  OPTION_EFFECT_TARGET_TYPES,
  OPTION_EFFECT_OPERATIONS,
  RESOURCE_VALUE_TYPES,
  RESOURCE_OWNER_TYPES,
  INTERNAL_CHOICE_LANGUAGE,
  INTERNAL_NARRATIVE_LANGUAGE,
  SOURCE_SHELL_ENTITY,
  GENERIC_RESPONSIBILITY_ACTION,
  GENERIC_RESPONSIBILITY_EFFECT,
  MISDIRECTION_KINDS,
  BATCH_FINGERPRINT_FIELDS
} from "../story-outline-contract/vocabulary.js";

export const PLACEHOLDER_NAME = /^(?:角色|玩家|队员|嘉宾|嫌疑人|成员|人物|role|player)[\s_-]*(?:[a-h]|[1-8]|[一二三四五六七八])?$/iu;
export const UNRESOLVED_LOGIC = /真凶\s*[（(]?\s*或|凶手\s*或\s*幕后黑手|真凶\s*或\s*幕后黑手|实为[^。；]{0,40}(?:但|却|又)\s*实为|(?:真相|真凶|凶手|幕后黑手|核心责任|答案|结论)[^。；]{0,16}(?:待定|尚未确定|任选其一)|(?:待定|尚未确定|任选其一)[^。；]{0,16}(?:真相|真凶|凶手|幕后黑手|核心责任|答案|结论)|可能是\s*[A-ZＡ-Ｚ]\s*也可能是/iu;

export const GENERIC_ACTION_ONLY = /^(?:(?:玩家|众人|角色|他|她|他们|全员)\s*)?(?:主动|继续|开始|尝试|决定|选择|共同|分别|再次|秘密地|公开地)?\s*(?:调查|搜查|寻找|收集|分析|核对|查看|检查|质问|询问|讨论|交换|分享|公开|隐瞒|阻止|保护|说服|合作|追查|推进)(?:线索|证据|信息|秘密|真相|某人|对方|问题|情况|调查)?(?:并(?:继续)?调查)?[。.!！]?$/iu;
export const GENERIC_EFFECT_ONLY = /^(?:这|该行动|该选择)?(?:将会|会|能够|可能)?\s*(?:影响|改变|推进|阻碍)(?:后续|下一章|之后的)?(?:联盟|调查|关系|局势|选择|资源|进程|结果)(?:和|与|或|、[\p{L}\p{N}]+)*[。.!！]?$/iu;
export const GENERIC_CAUSAL_SEQUENCE = /发现(?:资料|线索|异常)?[-—→>、，\s]*(?:质疑|讨论)[-—→>、，\s]*(?:承认|秘密暴露|坦白)[-—→>、，\s]*(?:锁定|确认)[-—→>、，\s]*(?:投票|选择)/iu;

export const GENERIC_TRUST_STATE = /^(?:state[-_])?(?:trust|team[-_]?trust|group[-_]?trust|relationship[-_]?trust)$/iu;
export const MECHANIC_USE_SECTIONS = [/触发[：:]/u, /判定[：:]/u, /成功[：:]/u, /失败[：:]/u];
export const GENRE_MODES = new Set(["mystery", "emotional", "political", "variety", "survival", "hybrid"]);
export const PROGRESS_MODES = new Set(["evidence", "relationship", "commitment", "memory", "resource", "authority", "alliance", "task", "performance", "audience", "risk", "mixed"]);
export const GENRE_PROGRESS = {
  mystery: new Set(["evidence", "mixed"]),
  emotional: new Set(["relationship", "commitment", "memory", "mixed"]),
  political: new Set(["resource", "authority", "alliance", "mixed"]),
  variety: new Set(["task", "performance", "audience", "mixed"]),
  survival: new Set(["resource", "risk", "mixed"]),
  hybrid: PROGRESS_MODES
};

export const ACTION_COMMITMENT_MODES = new Set(["proposal", "attempt", "conditional", "committed"]);

export const FACT_TRUTH_VALUES = new Set([true, false]);

export const CONTRIBUTION_ANCHOR_TYPES = new Set(["evidence", "relationship", "commitment", "authority", "resource", "task", "risk", "memory", "audience"]);

export const GENERIC_DECISION_CAPACITY = /(?:decision[-_]?capacity|决策容量)/iu;

export const GENRE_ANCHOR_TYPES = {
  mystery: new Set(["evidence", "authority", "task", "relationship", "commitment"]),
  emotional: new Set(["relationship", "commitment", "memory"]),
  political: new Set(["authority", "resource", "commitment", "relationship"]),
  variety: new Set(["task", "relationship", "commitment", "audience"]),
  survival: new Set(["resource", "risk", "authority", "commitment"]),
  hybrid: CONTRIBUTION_ANCHOR_TYPES
};
export const REQUIREMENT_TARGET_TYPES = new Set(["state", "resource", "evidence"]);
export const ENTRY_CONDITION_MODES = new Set(["none", "all", "any"]);
