window.zhimuRuleVisual = {
  CONDITION_TYPES: [
    { id: "reading_completed", name: "玩家读完某分幕" },
    { id: "clue_owned", name: "玩家拥有某线索" },
    { id: "investigation_completed", name: "玩家完成某调查点" },
    { id: "item_owned", name: "玩家拥有某物品" }
  ],
  ACTION_TYPES: [
    { id: "unlock_script_section", name: "解锁分幕" },
    { id: "unlock_scene", name: "解锁场景" },
    { id: "grant_clue", name: "发放线索" },
    { id: "timeline_log", name: "写入时间线日志" }
  ],

  defaultVisual() {
    return {
      conditions: [{ type: "reading_completed", roleSlotId: "", scriptSectionId: "" }],
      actions: [{ type: "unlock_script_section", scriptSectionId: "" }]
    };
  },

  emptyCondition(type = "reading_completed") {
    if (type === "reading_completed") return { type, roleSlotId: "", scriptSectionId: "" };
    if (type === "clue_owned") return { type, roleSlotId: "", clueId: "" };
    if (type === "investigation_completed") return { type, investigationPointId: "" };
    if (type === "item_owned") return { type, roleSlotId: "", itemId: "" };
    return { type: "reading_completed", roleSlotId: "", scriptSectionId: "" };
  },

  emptyAction(type = "unlock_script_section") {
    if (type === "unlock_script_section") return { type, scriptSectionId: "" };
    if (type === "unlock_scene") return { type, sceneId: "" };
    if (type === "grant_clue") return { type, roleSlotId: "", clueId: "" };
    if (type === "timeline_log") return { type, message: "" };
    return { type: "timeline_log", message: "" };
  },

  visualToRuleJson(visual) {
    const conditions = {
      all: (visual.conditions ?? []).map((row) => {
        if (row.type === "reading_completed") {
          return { type: row.type, roleSlotId: row.roleSlotId, scriptSectionId: row.scriptSectionId };
        }
        if (row.type === "clue_owned") {
          return { type: row.type, roleSlotId: row.roleSlotId, clueId: row.clueId };
        }
        if (row.type === "investigation_completed") {
          return { type: row.type, investigationPointId: row.investigationPointId };
        }
        if (row.type === "item_owned") {
          return { type: row.type, roleSlotId: row.roleSlotId, itemId: row.itemId };
        }
        return row;
      })
    };
    const actions = (visual.actions ?? []).map((row) => {
      if (row.type === "unlock_script_section") return { type: row.type, scriptSectionId: row.scriptSectionId };
      if (row.type === "unlock_scene") return { type: row.type, sceneId: row.sceneId };
      if (row.type === "grant_clue") return { type: row.type, roleSlotId: row.roleSlotId, clueId: row.clueId };
      if (row.type === "timeline_log") return { type: row.type, message: row.message };
      return row;
    });
    return { conditions, actions };
  },

  ruleJsonToVisual(conditions, actions) {
    if (!conditions || !Array.isArray(conditions.all)) {
      return { compatible: false, reason: "此规则使用了可视化编辑器暂不支持的条件结构（需要 conditions.all）。" };
    }
    const supportedConditions = new Set(this.CONDITION_TYPES.map((item) => item.id));
    const supportedActions = new Set(this.ACTION_TYPES.map((item) => item.id));
    for (const row of conditions.all) {
      if (!supportedConditions.has(row.type)) {
        return { compatible: false, reason: `条件类型「${row.type}」暂不支持可视化编辑，请使用 JSON 模式。` };
      }
    }
    for (const row of actions ?? []) {
      if (!supportedActions.has(row.type)) {
        return { compatible: false, reason: `动作类型「${row.type}」暂不支持可视化编辑，请使用 JSON 模式。` };
      }
    }
    return {
      compatible: true,
      visual: {
        conditions: conditions.all.map((row) => ({ ...row })),
        actions: (actions ?? []).map((row) => ({ ...row }))
      }
    };
  },

  sectionOptions(studio, roleSlotId = "") {
    const roles = studio?.roles ?? [];
    const sections = studio?.sections ?? [];
    const filtered = roleSlotId ? sections.filter((item) => item.role_slot_id === roleSlotId) : sections;
    return filtered.map((section) => {
      const role = roles.find((item) => item.id === section.role_slot_id);
      return { id: section.id, name: `${role?.name || "角色"} · ${section.sequence}. ${section.title}` };
    });
  },

  renderConditionRow(index, row, studio, escapeHtml) {
    const typeOptions = this.CONDITION_TYPES.map((item) =>
      `<option value="${item.id}" ${row.type === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`
    ).join("");
    const roles = (studio?.roles ?? []).map((item) =>
      `<option value="${item.id}" ${row.roleSlotId === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`
    ).join("");
    const sections = this.sectionOptions(studio, row.roleSlotId).map((item) =>
      `<option value="${item.id}" ${row.scriptSectionId === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`
    ).join("");
    const clues = (studio?.clues ?? []).map((item) =>
      `<option value="${item.id}" ${row.clueId === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`
    ).join("");
    const points = (studio?.investigation_points ?? studio?.investigationPoints ?? []).map((item) =>
      `<option value="${item.id}" ${row.investigationPointId === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`
    ).join("");
    const items = (studio?.items ?? []).map((item) =>
      `<option value="${item.id}" ${row.itemId === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`
    ).join("");

    let fields = "";
    if (row.type === "reading_completed") {
      fields = `<label>角色</label><select class="field" data-rule-condition-field="roleSlotId" data-rule-condition-index="${index}"><option value="">选择角色</option>${roles}</select><label>分幕</label><select class="field" data-rule-condition-field="scriptSectionId" data-rule-condition-index="${index}"><option value="">选择分幕</option>${sections}</select>`;
    } else if (row.type === "clue_owned") {
      fields = `<label>角色</label><select class="field" data-rule-condition-field="roleSlotId" data-rule-condition-index="${index}"><option value="">选择角色</option>${roles}</select><label>线索</label><select class="field" data-rule-condition-field="clueId" data-rule-condition-index="${index}"><option value="">选择线索</option>${clues}</select>`;
    } else if (row.type === "investigation_completed") {
      fields = `<label>调查点</label><select class="field" data-rule-condition-field="investigationPointId" data-rule-condition-index="${index}"><option value="">选择调查点</option>${points}</select>`;
    } else if (row.type === "item_owned") {
      const itemHint = items ? "" : `<p class="wizard-intro">当前世界尚无物品；物品条件仅在有物品数据时可用。</p>`;
      fields = `${itemHint}<label>角色</label><select class="field" data-rule-condition-field="roleSlotId" data-rule-condition-index="${index}"><option value="">选择角色</option>${roles}</select><label>物品</label><select class="field" data-rule-condition-field="itemId" data-rule-condition-index="${index}"><option value="">选择物品</option>${items}</select>`;
    }

    return `<article class="rule-visual-row" data-rule-condition-row="${index}"><div class="rule-visual-row-head"><strong>条件 ${index + 1}</strong><button type="button" class="text-btn danger-text" data-rule-remove-condition="${index}">删除</button></div><label>类型</label><select class="field" data-rule-condition-type="${index}">${typeOptions}</select>${fields}</article>`;
  },

  renderActionRow(index, row, studio, escapeHtml) {
    const typeOptions = this.ACTION_TYPES.map((item) =>
      `<option value="${item.id}" ${row.type === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`
    ).join("");
    const roles = (studio?.roles ?? []).map((item) =>
      `<option value="${item.id}" ${row.roleSlotId === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`
    ).join("");
    const sections = this.sectionOptions(studio).map((item) =>
      `<option value="${item.id}" ${row.scriptSectionId === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`
    ).join("");
    const scenes = (studio?.scenes ?? []).map((item) =>
      `<option value="${item.id}" ${row.sceneId === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`
    ).join("");
    const clues = (studio?.clues ?? []).map((item) =>
      `<option value="${item.id}" ${row.clueId === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`
    ).join("");

    let fields = "";
    if (row.type === "unlock_script_section") {
      fields = `<label>分幕</label><select class="field" data-rule-action-field="scriptSectionId" data-rule-action-index="${index}"><option value="">选择要解锁的分幕</option>${sections}</select>`;
    } else if (row.type === "unlock_scene") {
      fields = `<label>场景</label><select class="field" data-rule-action-field="sceneId" data-rule-action-index="${index}"><option value="">选择场景</option>${scenes}</select>`;
    } else if (row.type === "grant_clue") {
      fields = `<label>角色</label><select class="field" data-rule-action-field="roleSlotId" data-rule-action-index="${index}"><option value="">选择角色</option>${roles}</select><label>线索</label><select class="field" data-rule-action-field="clueId" data-rule-action-index="${index}"><option value="">选择线索</option>${clues}</select>`;
    } else if (row.type === "timeline_log") {
      fields = `<label>日志内容</label><input class="field" data-rule-action-field="message" data-rule-action-index="${index}" value="${escapeHtml(row.message || "")}" placeholder="例如：玩家完成了关键调查">`;
    }

    return `<article class="rule-visual-row" data-rule-action-row="${index}"><div class="rule-visual-row-head"><strong>动作 ${index + 1}</strong><button type="button" class="text-btn danger-text" data-rule-remove-action="${index}">删除</button></div><label>类型</label><select class="field" data-rule-action-type="${index}">${typeOptions}</select>${fields}</article>`;
  },

  renderVisualPanel(visual, studio, escapeHtml) {
    const conditions = (visual.conditions ?? []).map((row, index) => this.renderConditionRow(index, row, studio, escapeHtml)).join("");
    const actions = (visual.actions ?? []).map((row, index) => this.renderActionRow(index, row, studio, escapeHtml)).join("");
    return `<section class="rule-visual-panel"><div class="rule-visual-block"><div class="rule-visual-block-head"><strong>当（全部满足）</strong><button type="button" class="text-btn" data-rule-add-condition>＋ 添加条件</button></div>${conditions || `<div class="empty-state">暂无条件，请添加至少一条。</div>`}</div><div class="rule-visual-block"><div class="rule-visual-block-head"><strong>则（按顺序执行）</strong><button type="button" class="text-btn" data-rule-add-action>＋ 添加动作</button></div>${actions || `<div class="empty-state">暂无动作，请添加至少一条。</div>`}</div></section>`;
  },

  summarizeRule(conditions, actions) {
    const condName = Object.fromEntries(this.CONDITION_TYPES.map((item) => [item.id, item.name]));
    const actName = Object.fromEntries(this.ACTION_TYPES.map((item) => [item.id, item.name]));
    const when = (conditions?.all ?? []).map((item) => condName[item.type] || item.type).join(" 且 ") || "（无条件）";
    const then = (actions ?? []).map((item) => actName[item.type] || item.type).join(" → ") || "（无动作）";
    return { when, then };
  }
};
