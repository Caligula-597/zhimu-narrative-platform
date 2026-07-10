function count(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function rate(value, denominator) {
  return denominator > 0 ? Math.round((value / denominator) * 1000) / 10 : null;
}

export function buildCreatorAnalytics(data) {
  const suggestions = [];
  for (const row of data.sections) {
    if (row.started_count > 0 && row.completed_count === 0) {
      suggestions.push({
        type: "section_completion",
        severity: "medium",
        title: `分幕「${row.title}」有开始但无人完成`,
        detail: "建议检查文本长度、任务提示或解锁顺序。",
        ref: { sectionId: row.id, roleName: row.role_name }
      });
    }
  }
  for (const row of data.clues) {
    if (row.acquired_count === 0) {
      suggestions.push({
        type: "clue_hit_rate",
        severity: "medium",
        title: `线索「${row.name}」尚无获取记录`,
        detail: "建议检查线索发放规则、调查点或主持手动发放路径。",
        ref: { clueId: row.id }
      });
    }
  }

  const raw = data.funnel || {};
  const joinedPlayers = count(raw.joined_players);
  const startedReading = count(raw.started_reading);
  const completedOpening = count(raw.completed_opening);
  const investigated = count(raw.investigated);
  const readClue = count(raw.read_clue);
  const firstSessionFunnel = {
    roomCount: count(raw.room_count),
    roomsWithPlayers: count(raw.rooms_with_players),
    joinedPlayers,
    startedReading,
    completedOpening,
    investigated,
    readClue,
    startRate: rate(startedReading, joinedPlayers),
    openingCompletionRate: rate(completedOpening, joinedPlayers),
    investigationRate: rate(investigated, joinedPlayers),
    clueReadRate: rate(readClue, joinedPlayers),
    medianSecondsToOpeningComplete: raw.median_seconds_to_opening_complete == null
      ? null
      : Math.max(0, Math.round(Number(raw.median_seconds_to_opening_complete)))
  };

  if (joinedPlayers >= 3 && firstSessionFunnel.startRate < 70) {
    suggestions.unshift({
      type: "first_session_start",
      severity: "high",
      title: "加入房间后开始阅读的玩家偏少",
      detail: "优先检查选角后的入口文案、首幕可见性和玩家端下一步提示。",
      ref: { joinedPlayers, startedReading }
    });
  } else if (startedReading >= 3 && completedOpening / startedReading < 0.6) {
    suggestions.unshift({
      type: "opening_completion",
      severity: "high",
      title: "首幕阅读中途流失偏高",
      detail: "优先缩短首幕、前置角色目标，并确认移动端阅读体验。",
      ref: { startedReading, completedOpening }
    });
  }

  return {
    sections: data.sections,
    clues: data.clues,
    feedback: data.feedback,
    firstSessionFunnel,
    suggestions: suggestions.slice(0, 20)
  };
}
