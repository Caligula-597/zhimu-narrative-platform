/** Starter automation rules created from the world wizard template selections. */
(function (window) {
  function buildWizardAutomationRules({ roles = [], templates = {} }) {
    if (!roles.length) return [];
    const primary = roles[0];
    const sectionId = primary.sectionId;
    const roleId = primary.id;
    const roleName = primary.name || "角色";
    if (!sectionId || !roleId) return [];

    const rules = [];

    if (templates.reading) {
      rules.push({
        name: "序章读完 · 自动记录（可改为解锁下一段）",
        mode: "automatic",
        enabled: true,
        priority: 10,
        conditions: {
          all: [{ type: "reading_completed", roleSlotId: roleId, scriptSectionId: sectionId }]
        },
        actions: [
          {
            type: "timeline_log",
            message: `${roleName} 读完当前序章。在创作台为角色添加第二段分幕后，可将本规则动作改为「解锁分幕」并指向目标分幕。`
          }
        ]
      });
    }

    if (templates.clue) {
      rules.push({
        name: "【待配置】核心线索满足后开放场景",
        mode: "automatic",
        enabled: false,
        priority: 20,
        conditions: {
          all: [{ type: "reading_completed", roleSlotId: roleId, scriptSectionId: sectionId }]
        },
        actions: [
          {
            type: "timeline_log",
            message: "模板占位：请在「自动化规则」中将条件改为「拥有线索」，动作为「开放场景」，并关联编排台中的线索与场景。"
          }
        ]
      });
    }

    if (templates.chapter) {
      rules.push({
        name: "关键节点 · 需主持确认后推进",
        mode: "host_confirm",
        enabled: true,
        priority: 30,
        conditions: {
          all: [{ type: "reading_completed", roleSlotId: roleId, scriptSectionId: sectionId }]
        },
        actions: [
          {
            type: "timeline_log",
            message: "阶段关键节点达成，主持人已在监控台确认。可在规则页调整触发条件与确认后动作。"
          }
        ]
      });
    }

    if (templates.hint) {
      rules.push({
        name: "【待配置】卡关弱提示",
        mode: "automatic",
        enabled: false,
        priority: 40,
        conditions: {
          all: [
            {
              type: "variable_compare",
              roleSlotId: roleId,
              key: "stuck_hint",
              operator: "gte",
              value: 1
            }
          ]
        },
        actions: [
          {
            type: "timeline_log",
            message: "弱提示模板：正式开跑前请改为合适的变量条件，或通过主持台手动发送提示。"
          }
        ]
      });
    }

    return rules;
  }

  function countEnabledTemplates(templates = {}) {
    return Object.values(templates).filter(Boolean).length;
  }

  window.zhimuWizardAutomation = {
    buildWizardAutomationRules,
    countEnabledTemplates
  };
})(window);
export {};
