import { evaluatePublishImpact } from "../../shared/publish-impact-preview.js";

export const PLAYER_PREVIEW_MEMBERSHIP_ROLES = new Set(["owner", "editor", "reviewer"]);

export function canPreviewPlayerView(world) {
  return PLAYER_PREVIEW_MEMBERSHIP_ROLES.has(String(world?.membership_role || ""));
}

export function playerPreviewRoomChoices(data = {}) {
  return [
    {
      id: "__testing__",
      name: "假设：测试房初始态",
      status: "testing",
      source: "hypothetical",
      inviteCode: ""
    },
    {
      id: "__active__",
      name: "假设：正式房初始态",
      status: "active",
      source: "hypothetical",
      inviteCode: ""
    },
    ...(data.rooms || []).map((room) => ({
      id: String(room.id || ""),
      name: `${room.name || "运行房"} · ${room.status || "active"} 初始态`,
      status: room.status || "active",
      source: "room",
      inviteCode: room.invite_code || room.inviteCode || ""
    })).filter((room) => room.id)
  ];
}

export function normalizePlayerPreviewDraft(data = {}, draft = {}) {
  const roles = Array.isArray(data.roles) ? data.roles : [];
  const rooms = playerPreviewRoomChoices(data);
  const chapters = Array.isArray(data.chapters) ? data.chapters : [];
  if (!roles.some((role) => role.id === draft.roleId)) draft.roleId = roles[0]?.id || "";
  if (!rooms.some((room) => room.id === draft.roomId)) draft.roomId = rooms[0]?.id || "__testing__";
  if (draft.chapterId && !chapters.some((chapter) => chapter.id === draft.chapterId)) draft.chapterId = "";
  return draft;
}

export function buildPlayerReaderPreview(data = {}, draft = {}) {
  normalizePlayerPreviewDraft(data, draft);
  const roles = Array.isArray(data.roles) ? data.roles : [];
  const rooms = playerPreviewRoomChoices(data);
  const role = roles.find((item) => item.id === draft.roleId) || null;
  const room = rooms.find((item) => item.id === draft.roomId) || rooms[0] || null;
  const impact = evaluatePublishImpact({
    roleSlotId: role?.id || "",
    roomStatus: room?.status || "testing",
    chapters: data.chapters || [],
    sections: data.sections || [],
    scenes: data.scenes || [],
    clues: data.clues || [],
    tasks: data.playerTasks || data.tasks || []
  });
  const authoredSections = new Map((data.sections || []).map((section) => [section.id, section]));
  const sections = impact.sections
    .map((item) => ({ ...authoredSections.get(item.id), ...item }))
    .filter((section) => !draft.chapterId || section.chapter_id === draft.chapterId)
    .sort((left, right) => Number(left.sequence || 0) - Number(right.sequence || 0));
  const visibleSections = sections.filter((section) => section.visible);
  const hiddenSections = sections.filter((section) => !section.visible);
  const warnings = [
    "这是与 Player 查询同口径的初始态推演，不读取运行中的解锁、线索持有、分享或阅读进度。",
    ...(room?.source === "room"
      ? ["已选择真实运行房，但此页只使用房间阶段判断发布状态；临场状态请进入独立玩家端核验。"]
      : []),
    ...impact.warnings
  ];
  return {
    role,
    room,
    roles,
    rooms,
    chapters: data.chapters || [],
    sections,
    visibleSections,
    hiddenSections,
    visibleScenes: impact.scenes.filter((item) => item.visible),
    hiddenScenes: impact.scenes.filter((item) => !item.visible),
    visibleClues: impact.clues.filter((item) => item.visible),
    hiddenClues: impact.clues.filter((item) => !item.visible),
    warnings: [...new Set(warnings)],
    summary: {
      visibleSections: visibleSections.length,
      hiddenSections: hiddenSections.length,
      visibleScenes: impact.scenes.filter((item) => item.visible).length,
      visibleClues: impact.clues.filter((item) => item.visible).length
    }
  };
}
