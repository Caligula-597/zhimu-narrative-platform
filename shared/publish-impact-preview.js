/**
 * Static publish-impact preview: what a role would see given room.status and
 * the supplied runtime evidence. Empty evidence represents the Player
 * initial state, not an already-running room.
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
 * @param {Array<string>} [input.unlockedSectionIds]
 * @param {Array<string>} [input.unlockedSceneIds]
 * @param {Array<string>} [input.ownedClueIds]
 * @param {Array<string>} [input.sharedClueIds]
 */
export function evaluatePublishImpact({
  roleSlotId,
  roomStatus = "testing",
  chapters = [],
  sections = [],
  scenes = [],
  clues = [],
  tasks = [],
  unlockedSectionIds = [],
  unlockedSceneIds = [],
  ownedClueIds = [],
  sharedClueIds = []
} = {}) {
  const unlockedSections = new Set(unlockedSectionIds.filter(Boolean));
  const unlockedScenes = new Set(unlockedSceneIds.filter(Boolean));
  const ownedClues = new Set(ownedClueIds.filter(Boolean));
  const sharedClues = new Set(sharedClueIds.filter(Boolean));
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

  const sectionItems = sections
    .filter((section) => section.role_slot_id === roleSlotId)
    .map((section) => {
      const gate = publicationVisibleToPlayer(section.publication_status, roomStatus);
      let visible = gate.visible;
      let reason = gate.reason;
      const isInitialSection = Number(section.sequence) === 1;
      const isUnlocked = unlockedSections.has(section.id);
      if (visible && !isInitialSection && !isUnlocked) {
        visible = false;
        reason = "发布状态允许，但 Player 端尚无该分幕的运行时解锁记录";
      } else if (visible) {
        reason = isInitialSection
          ? `${gate.reason} · 首幕默认进入 Player 阅读列表`
          : `${gate.reason} · 已有运行时解锁记录`;
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
    const visible = unlockedScenes.has(scene.id);
    const reason = visible
      ? "已有运行时场景解锁记录 · Player 探索页可见"
      : open === "unlocked"
        ? "创作状态标记为开放，但 Player 端尚无运行时场景解锁记录"
        : "场景尚无运行时解锁记录";
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
    if (ownedClues.has(clue.id) || sharedClues.has(clue.id)) {
      return {
        id: clue.id,
        kind: "clue",
        title: clue.name || "未命名线索",
        status: visibility,
        visible: true,
        reason: ownedClues.has(clue.id) ? "已有获取记录 · Player 端可见" : "已有分享记录 · Player 端可见"
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
    if (visibility === "public") {
      return {
        id: clue.id,
        kind: "clue",
        title: clue.name || "未命名线索",
        status: visibility,
        visible: false,
        reason: "标记为公开，但 Player 端仍需获取或分享记录"
      };
    }
    return {
      id: clue.id,
      kind: "clue",
      title: clue.name || "未命名线索",
      status: visibility,
      visible: false,
      reason: "私密 · 需获得或由主持授予后才可见"
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
  const warnings = [];
  const chapterById = new Map(chapterItems.map((item) => [item.id, item]));
  const sectionById = new Map(sectionItems.map((item) => [item.id, item]));
  if (sections.some((section) => sectionById.get(section.id)?.visible && section.chapter_id && chapterById.get(section.chapter_id)?.visible === false)) {
    warnings.push("Player 当前按分幕自身发布状态与解锁记录读取，不会因父章节未发布而自动隐藏该分幕。");
  }
  if (clues.some((clue) => (clue.visibility || "private") === "public" && !ownedClues.has(clue.id) && !sharedClues.has(clue.id))) {
    warnings.push("公开线索不会仅凭 visibility 自动出现在 Player；仍需获取或分享记录。");
  }
  if (scenes.some((scene) => sceneOpenStatus(scene) === "unlocked" && !unlockedScenes.has(scene.id))) {
    warnings.push("场景 metadata.openStatus 不会直接开放 Player 探索页；运行房仍需 room_content_unlocks 记录。");
  }
  if (scenes.some((scene) => sceneVisibleRoles(scene).length)) {
    warnings.push("场景 visibleRoleSlotIds 目前不是 Player 探索查询的访问门槛；角色限制应落实到调查点或运行时规则。");
  }
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
    tasks: taskItems,
    warnings
  };
}
