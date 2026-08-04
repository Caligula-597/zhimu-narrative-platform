const PATCHABLE_BLUEPRINT_ISSUE = /(?:缺失|过短|必须引用|遗漏|未被事件|objectKey|objectValue|未携带|缺少生成前合同指定|缺少逐人责任映射|未逐字|必须同时(?:写明|出现在)|不得暴露|引用未知|不相容|提前写入状态|只能写 controlMode=derived|效果语义冲突|世界内叙述声称越权|语义冲突，应为|initialValue\/allowedValues|客观观察状态.+合同真值|authorizationStatus 无效|beforeValue 与 afterValue 相同|必须被至少一条结局路线读取|evidenceKeys 至少需要)/u;

const PATCHABLE_ASSEMBLY_ISSUE = /(?:chapterBeats|(?:players\[\d+\]|playerChapterActions\[\d+\]|role-[\w-]+)\.chapterActions\[\d+\]|style(?:ChapterExpressions|Contract\.chapterExpressions)\[\d+\]|分支事件|状态变量|routes\[|资源 |行动没有使用因果锚点|虽有行动|行动结果没有形成|声称触发|玩家可见文本|proposal|fallbackAction)/u;

function issuesMatchPolicy(issues, maximum, pattern) {
  return Array.isArray(issues)
    && issues.length > 0
    && issues.length <= maximum
    && issues.every((issue) => pattern.test(String(issue || "")));
}

export function blueprintIssuesArePatchable(issues) {
  return issuesMatchPolicy(issues, 12, PATCHABLE_BLUEPRINT_ISSUE);
}

export function assemblyIssuesArePatchable(issues) {
  return issuesMatchPolicy(issues, 24, PATCHABLE_ASSEMBLY_ISSUE);
}
