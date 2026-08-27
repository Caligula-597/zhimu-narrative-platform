/**
 * Clue library audit report for creator QA (P1-04 / L2-04).
 * Mirrors src/views/clues.js clueAuditCards logic for API consistency.
 */

function linkedPoints(clueId, points) {
  return points.filter((point) => point.clue_id === clueId);
}

function hasDiscoveryPath(clue, points) {
  const metadata = clue?.metadata || {};
  return Boolean(
    linkedPoints(clue.id, points).length
    || metadata.segmentKey
    || metadata.segment_key
    || metadata.allowUnbound === true
  );
}

function hasRuleOrStoryEdge(clueId, edges) {
  return edges.some(
    (edge) =>
      (edge.from_type === "clue" && edge.from_id === clueId) ||
      (edge.to_type === "clue" && edge.to_id === clueId)
  );
}

export function evaluateClueAudit(snapshot) {
  const clues = snapshot.clues ?? [];
  const points = snapshot.investigationPoints ?? [];
  const edges = snapshot.edges ?? [];
  const total = clues.length;

  const withText = clues.filter((clue) => String(clue.public_text || "").trim()).length;
  const linked = clues.filter((clue) => hasDiscoveryPath(clue, points)).length;
  const withRules = clues.filter((clue) => hasRuleOrStoryEdge(clue.id, edges)).length;
  const keyed = clues.filter((clue) => clue?.metadata?.importance === "key").length;

  const missingText = clues.filter((clue) => !String(clue.public_text || "").trim());
  const unlinked = clues.filter((clue) => !hasDiscoveryPath(clue, points));
  const noRuleLinks = clues.filter((clue) => !hasRuleOrStoryEdge(clue.id, edges));

  const nameCounts = clues.reduce((acc, clue) => {
    const key = String(clue.name || "").trim();
    if (key) acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const duplicated = Object.entries(nameCounts)
    .filter(([, count]) => count > 1)
    .map(([name]) => name);

  const score = total ? Math.round(((withText + linked + withRules) / (total * 3)) * 100) : 0;

  const cards = [
    { key: "content", icon: "文", label: "内容审核", value: `${withText}/${total}`, ok: !missingText.length },
    { key: "investigation", icon: "线", label: "调查关联", value: `${linked}/${total}`, ok: !unlinked.length },
    { key: "triggers", icon: "规", label: "触发关联", value: `${withRules}/${total}`, ok: !noRuleLinks.length },
    { key: "key_clues", icon: "测", label: "关键线索", value: `${keyed}/${Math.max(keyed, 1)}`, ok: keyed > 0 || !total }
  ];

  const issues = [
    missingText.length
      ? {
          id: "clues.missing_public_text",
          tone: "warn",
          title: "缺少玩家可见正文",
          detail: missingText.slice(0, 8).map((clue) => clue.name).join("、"),
          clueIds: missingText.slice(0, 8).map((clue) => clue.id)
        }
      : null,
    unlinked.length
      ? {
          id: "clues.unlinked_investigation",
          tone: "warn",
          title: "未关联调查点",
          detail: unlinked.slice(0, 8).map((clue) => clue.name).join("、"),
          clueIds: unlinked.slice(0, 8).map((clue) => clue.id)
        }
      : null,
    noRuleLinks.length
      ? {
          id: "clues.no_trigger_links",
          tone: "warn",
          title: "未接入触发条件或前置线索",
          detail: noRuleLinks.slice(0, 8).map((clue) => clue.name).join("、"),
          clueIds: noRuleLinks.slice(0, 8).map((clue) => clue.id)
        }
      : null,
    duplicated.length
      ? {
          id: "clues.duplicate_names",
          tone: "danger",
          title: "线索名称重复",
          detail: duplicated.slice(0, 8).join("、"),
          clueIds: []
        }
      : null,
    !keyed && total
      ? {
          id: "clues.no_key_clue",
          tone: "warn",
          title: "没有标记关键线索",
          detail: "建议至少标记 1 条用于真相节点或章节推进。",
          clueIds: []
        }
      : null
  ].filter(Boolean);

  return {
    total,
    score,
    cards,
    issues,
    ok: !issues.length,
    summary: {
      withText,
      linked,
      withRules,
      keyed,
      issueCount: issues.length
    }
  };
}
