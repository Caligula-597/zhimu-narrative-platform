window.zhimuRuleVisual = {
  CONDITION_TYPES: [
    { id: "reading_completed", name: "玩家读完某分幕" },
    { id: "clue_owned", name: "玩家拥有某线索" },
    { id: "investigation_completed", name: "玩家完成某调查点" },
    { id: "item_owned", name: "玩家拥有某物品" },
    { id: "variable_compare", name: "玩家变量达到条件" }
  ],
  ACTION_TYPES: [
    { id: "unlock_script_section", name: "解锁分幕" },
    { id: "unlock_scene", name: "解锁场景" },
    { id: "grant_clue", name: "发放线索" },
    { id: "grant_item", name: "发放物品" },
    { id: "timeline_log", name: "写入时间线日志" }
  ],
  VARIABLE_OPERATORS: [
    { id: "gte", name: "≥" },
    { id: "gt", name: ">" },
    { id: "lte", name: "≤" },
    { id: "lt", name: "<" },
    { id: "eq", name: "等于" },
    { id: "neq", name: "不等于" }
  ],

  defaultVisual() {
    return {
      conditionLogic: "all",
      conditions: [{ type: "reading_completed", roleSlotId: "", scriptSectionId: "" }],
      actions: [{ type: "unlock_script_section", scriptSectionId: "" }]
    };
  },

  emptyCondition(type = "reading_completed") {
    if (type === "reading_completed") return { type, roleSlotId: "", scriptSectionId: "" };
    if (type === "clue_owned") return { type, roleSlotId: "", clueId: "" };
    if (type === "investigation_completed") return { type, investigationPointId: "" };
    if (type === "item_owned") return { type, roleSlotId: "", itemId: "" };
    if (type === "variable_compare") return { type, roleSlotId: "", key: "trust", operator: "gte", value: 1 };
    return { type: "reading_completed", roleSlotId: "", scriptSectionId: "" };
  },

  emptyAction(type = "unlock_script_section") {
    if (type === "unlock_script_section") return { type, scriptSectionId: "" };
    if (type === "unlock_scene") return { type, sceneId: "" };
    if (type === "grant_clue") return { type, roleSlotId: "", clueId: "" };
    if (type === "grant_item") return { type, roleSlotId: "", itemId: "", quantity: 1 };
    if (type === "timeline_log") return { type, message: "" };
    return { type: "timeline_log", message: "" };
  },

  visualToRuleJson(visual) {
    const list = (visual.conditions ?? []).map((row) => {
      if (row.type === "reading_completed") return { type: row.type, roleSlotId: row.roleSlotId, scriptSectionId: row.scriptSectionId };
      if (row.type === "clue_owned") return { type: row.type, roleSlotId: row.roleSlotId, clueId: row.clueId };
      if (row.type === "investigation_completed") return { type: row.type, investigationPointId: row.investigationPointId };
      if (row.type === "item_owned") return { type: row.type, roleSlotId: row.roleSlotId, itemId: row.itemId };
      if (row.type === "variable_compare") return { type: row.type, roleSlotId: row.roleSlotId, key: row.key, operator: row.operator, value: Number(row.value) };
      return row;
    });
    const logic = visual.conditionLogic === "any" ? "any" : "all";
    const conditions = { [logic]: list };
    const actions = (visual.actions ?? []).map((row) => {
      if (row.type === "unlock_script_section") return { type: row.type, scriptSectionId: row.scriptSectionId };
      if (row.type === "unlock_scene") return { type: row.type, sceneId: row.sceneId };
      if (row.type === "grant_clue") return { type: row.type, roleSlotId: row.roleSlotId, clueId: row.clueId };
      if (row.type === "grant_item") return { type: row.type, roleSlotId: row.roleSlotId, itemId: row.itemId, quantity: Number(row.quantity) || 1 };
      if (row.type === "timeline_log") return { type: row.type, message: row.message };
      return row;
    });
    return { conditions, actions };
  },

  ruleJsonToVisual(conditions, actions) {
    if (!conditions || typeof conditions !== "object") {
      return { compatible: false, reason: "规则条件结构无效，请使用 JSON 模式编辑。" };
    }
    if (conditions.not) {
      return { compatible: false, reason: "此规则包含「取反」条件，请使用 JSON 模式编辑。" };
    }
    let logic = "all";
    let list = conditions.all;
    if (Array.isArray(conditions.any)) {
      logic = "any";
      list = conditions.any;
    }
    if (!Array.isArray(list)) {
      return { compatible: false, reason: "可视化编辑器支持「全部满足」或「任一满足」条件组，复杂结构请用 JSON 模式。" };
    }
    const supportedConditions = new Set(this.CONDITION_TYPES.map((item) => item.id));
    const supportedActions = new Set(this.ACTION_TYPES.map((item) => item.id));
    for (const row of list) {
      if (!supportedConditions.has(row.type)) {
        return { compatible: false, reason: `条件类型「${row.type}」请使用 JSON 模式编辑。` };
      }
    }
    for (const row of actions ?? []) {
      if (!supportedActions.has(row.type)) {
        return { compatible: false, reason: `动作类型「${row.type}」请使用 JSON 模式编辑。` };
      }
    }
    return {
      compatible: true,
      visual: {
        conditionLogic: logic,
        conditions: list.map((row) => ({ ...row })),
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
    } else if (row.type === "variable_compare") {
      const ops = this.VARIABLE_OPERATORS.map((item) =>
        `<option value="${item.id}" ${row.operator === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`
      ).join("");
      fields = `<label>角色</label><select class="field" data-rule-condition-field="roleSlotId" data-rule-condition-index="${index}"><option value="">选择角色</option>${roles}</select><label>变量名</label><input class="field" data-rule-condition-field="key" data-rule-condition-index="${index}" value="${escapeHtml(row.key || "")}" placeholder="如 trust"><label>比较</label><select class="field" data-rule-condition-field="operator" data-rule-condition-index="${index}">${ops}</select><label>数值</label><input class="field" data-rule-condition-field="value" data-rule-condition-index="${index}" type="number" value="${escapeHtml(String(row.value ?? ""))}">`;
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
    const items = (studio?.items ?? []).map((item) =>
      `<option value="${item.id}" ${row.itemId === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`
    ).join("");

    let fields = "";
    if (row.type === "unlock_script_section") {
      fields = `<label>分幕</label><select class="field" data-rule-action-field="scriptSectionId" data-rule-action-index="${index}"><option value="">选择要解锁的分幕</option>${sections}</select>`;
    } else if (row.type === "unlock_scene") {
      fields = `<label>场景</label><select class="field" data-rule-action-field="sceneId" data-rule-action-index="${index}"><option value="">选择场景</option>${scenes}</select>`;
    } else if (row.type === "grant_clue") {
      fields = `<label>角色</label><select class="field" data-rule-action-field="roleSlotId" data-rule-action-index="${index}"><option value="">选择角色</option>${roles}</select><label>线索</label><select class="field" data-rule-action-field="clueId" data-rule-action-index="${index}"><option value="">选择线索</option>${clues}</select>`;
    } else if (row.type === "grant_item") {
      fields = `<label>角色</label><select class="field" data-rule-action-field="roleSlotId" data-rule-action-index="${index}"><option value="">选择角色</option>${roles}</select><label>物品</label><select class="field" data-rule-action-field="itemId" data-rule-action-index="${index}"><option value="">选择物品</option>${items}</select><label>数量</label><input class="field" data-rule-action-field="quantity" data-rule-action-index="${index}" type="number" min="1" value="${escapeHtml(String(row.quantity ?? 1))}">`;
    } else if (row.type === "timeline_log") {
      fields = `<label>日志内容</label><input class="field" data-rule-action-field="message" data-rule-action-index="${index}" value="${escapeHtml(row.message || "")}" placeholder="例如：玩家完成了关键调查">`;
    }

    return `<article class="rule-visual-row" data-rule-action-row="${index}"><div class="rule-visual-row-head"><strong>动作 ${index + 1}</strong><button type="button" class="text-btn danger-text" data-rule-remove-action="${index}">删除</button></div><label>类型</label><select class="field" data-rule-action-type="${index}">${typeOptions}</select>${fields}</article>`;
  },

  renderVisualPanel(visual, studio, escapeHtml) {
    const logic = visual.conditionLogic === "any" ? "any" : "all";
    const logicLabel = logic === "any" ? "任一满足" : "全部满足";
    const conditions = (visual.conditions ?? []).map((row, index) => this.renderConditionRow(index, row, studio, escapeHtml)).join("");
    const actions = (visual.actions ?? []).map((row, index) => this.renderActionRow(index, row, studio, escapeHtml)).join("");
    return `<section class="rule-visual-panel"><div class="rule-visual-block"><div class="rule-visual-block-head"><strong>条件组合</strong></div><label>触发要求</label><select class="field" data-rule-condition-logic><option value="all" ${logic === "all" ? "selected" : ""}>全部满足（AND）</option><option value="any" ${logic === "any" ? "selected" : ""}>任一满足（OR）</option></select><div class="rule-visual-block-head" style="margin-top:12px"><strong>当（${logicLabel}）</strong><button type="button" class="text-btn" data-rule-add-condition>＋ 添加条件</button></div>${conditions || `<div class="empty-state">暂无条件，请添加至少一条。</div>`}</div><div class="rule-visual-block"><div class="rule-visual-block-head"><strong>则（按顺序执行）</strong><button type="button" class="text-btn" data-rule-add-action>＋ 添加动作</button></div>${actions || `<div class="empty-state">暂无动作，请添加至少一条。</div>`}</div></section>`;
  },

  summarizeRule(conditions, actions) {
    const condName = Object.fromEntries(this.CONDITION_TYPES.map((item) => [item.id, item.name]));
    const actName = Object.fromEntries(this.ACTION_TYPES.map((item) => [item.id, item.name]));
    const list = conditions?.all ?? conditions?.any ?? [];
    const joiner = conditions?.any ? " 或 " : " 且 ";
    const when = list.map((item) => {
      if (item.type === "variable_compare") return `${condName[item.type] || item.type}（${item.key || "?"}）`;
      return condName[item.type] || item.type;
    }).join(joiner) || "（无条件）";
    const then = (actions ?? []).map((item) => actName[item.type] || item.type).join(" → ") || "（无动作）";
    return { when, then };
  }
};
export {};
