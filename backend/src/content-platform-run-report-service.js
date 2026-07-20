import { fetchRoomRunReportData } from "./repositories/content-platform-run-report-repository.js";

export function buildRoomRunReport({ reading = [], clues = [], votes = [] }) {
  const suggestions = clues
    .filter((clue) => clue.acquired_count === 0)
    .map((clue) => ({
      type: "clue_missing",
      title: `线索「${clue.name}」本场未被获取`,
      detail: "复盘时建议检查发放条件，或在下一版前移提示。"
    }));
  return { reading, clues, votes, suggestions };
}

export async function getRoomRunReport(roomId) {
  return buildRoomRunReport(await fetchRoomRunReportData(roomId));
}
