/**
 * Static publish-impact preview: what a role would see given room.status,
 * before room_content_unlocks / clue ownership (noted separately).
 */

export const PUBLICATION_STATUS_LABEL = {
  draft: "草稿",
  testing: "测试中",
  published: "已发布"
};

/**
 * @param {string} publicationStatus
 * @param {string} roomStatus - rooms.status: testing | active | archived …
 */
export function publicationVisibleToPlayer(publicationStatus, roomStatus) {
  const status = publicationStatus || "draft";
  if (status === "published") {
    return { visible: true, reason: "已发布 · 玩家端可读（仍可能需解锁）" };
  }
  if (status === "testing") {
    if (roomStatus === "testing") {
      return { visible: true, reason: "测试中 · 仅测试房可见" };
    }
    return { visible: false, reason: "测试中 · 正式房不可见" };
  }
  return { visible: false, reason: "草稿 · 任何房间对玩家不可见" };
}

function sceneOpenStatus(scene) {
  const meta = scene?.metadata && typeof scene.metadata === "object" ? scene.metadata : {};
  return meta.openStatus || "locked";
}

function sceneVisibleRoles(scene) {
  const meta = scene?.metadata && typeof scene.metadata === "object" ? scene.metadata : {};
  return Array.isArray(meta.visibleRoleSlotIds) ? meta.visibleRoleSlotIds.filter(Boolean) : [];
}

/**
 * @param {object} input
 * @param {string} input.roleSlotId
 * @param {string} [input.roomStatus]
 * @param {Array} [input.chapters]
 * @param {Array} [input.sections]
 * @param {Array} [input.scenes]
 * @param {Array} [input.clues]
 * @param {Array} [input.tasks]
 */
export function evaluatePublishImpact({
  roleSlotId,
  roomStatus = "testing",
  chapters = [],
  sections = [],
  scenes = [],
  clues = [],
  tasks = []
} = {}) {
  const chapterItems = chapters.map((chapter) => {
    const gate = publicationVisibleToPlayer(chapter.publication_status, roomStatus);
    return {
      id: chapter.id,
      kind: "chapter",
      title: chapter.title || "未命名章节",
      status: chapter.publication_status || "draft",
      visible: gate.visible,
      reason: gate.reason
    };
  });

  const chapterVisible = new Map(chapterItems.map((c) => [c.id, c.visible]));

  const sectionItems = sections
    .filter((section) => section.role_slot_id === roleSlotId)
    .map((section) => {
      const gate = publicationVisibleToPlayer(section.publication_status, roomStatus);
      let visible = gate.visible;
      let reason = gate.reason;
      if (visible && section.chapter_id && chapterVisible.get(section.chapter_id) === false) {
        visible = false;
        reason = "所属章节对玩家不可见";
      } else if (visible && Number(section.sequence) > 1) {
        reason = `${gate.reason} · 非序幕，常需主持解锁后才真正可读`;
      }
      return {
        id: section.id,
        kind: "section",
        title: section.title || "未命名分幕",
        status: section.publication_status || "draft",
        visible,
        reason
      };
    });

  const sceneItems = scenes.map((scene) => {
    const open = sceneOpenStatus(scene);
    const roles = sceneVisibleRoles(scene);
    const roleOk = !roles.length || roles.includes(roleSlotId);
    let visible = open === "unlocked" && roleOk;
    let reason;
    if (open === "locked") {
      visible = false;
      reason = "场景锁定 · 需规则或主持开放";
    } else if (!roleOk) {
      visible = false;
      reason = "角色不在该场景可见范围";
    } else {
      reason = "已开放 · 初始对该角色可见";
    }
    if (visible && scene.chapter_id && chapterVisible.get(scene.chapter_id) === false) {
      visible = false;
      reason = "所属章节对玩家不可见";
    }
    return {
      id: scene.id,
      kind: "scene",
      title: scene.name || "未命名场景",
      status: open,
      visible,
      reason
    };
  });

  const clueItems = clues.map((clue) => {
    const visibility = clue.visibility || "private";
    if (visibility === "public") {
      return {
        id: clue.id,
        kind: "clue",
        title: clue.name || "未命名线索",
        status: visibility,
        visible: true,
        reason: "公开线索 · 进入房间即可查看"
      };
    }
    if (visibility === "host") {
      return {
        id: clue.id,
        kind: "clue",
        title: clue.name || "未命名线索",
        status: visibility,
        visible: false,
        reason: "仅主持可见"
      };
    }
    return {
      id: clue.id,
      kind: "clue",
      title: clue.name || "未命名线索",
      status: visibility,
      visible: false,
      reason: "私密 · 需获得/主持授予后才可见（本预览不模拟持有）"
    };
  });

  const taskItems = (tasks || [])
    .filter((task) => !task.role_slot_id || task.role_slot_id === roleSlotId)
    .map((task) => {
      const visibility = task.visibility || "role";
      if (visibility === "host") {
        return {
          id: task.id,
          kind: "task",
          title: (task.body || "").slice(0, 48) || "未命名任务",
          status: visibility,
          visible: false,
          reason: "仅主持可见"
        };
      }
      return {
        id: task.id,
        kind: "task",
        title: (task.body || "").slice(0, 48) || "未命名任务",
        status: visibility,
        visible: true,
        reason: visibility === "public" ? "公开任务" : "绑定本角色的任务"
      };
    });

  const all = [...chapterItems, ...sectionItems, ...sceneItems, ...clueItems, ...taskItems];
  const visibleCount = all.filter((item) => item.visible).length;
  return {
    roomStatus,
    roleSlotId,
    summary: {
      total: all.length,
      visible: visibleCount,
      hidden: all.length - visibleCount
    },
    chapters: chapterItems,
    sections: sectionItems,
    scenes: sceneItems,
    clues: clueItems,
    tasks: taskItems
  };
}
