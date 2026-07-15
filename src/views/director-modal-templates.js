import { escapeHtml } from "../../shared/security.js";
import { unwrapHtmlFragment } from "../../shared/safe-dom.js";

export function hostClueNoteModalHtml({ playerName, clueName, existing }) {
  return `<h2>线索主持备注</h2><p class="wizard-intro">${escapeHtml(playerName)} · ${escapeHtml(clueName)}</p><textarea class="field" rows="4" data-host-clue-note>${escapeHtml(existing)}</textarea><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-save-host-clue-note>保存备注</button></div>`;
}

export function delayHostEventModalHtml(eventTitle) {
  return `<h2>延迟待确认事件</h2><p class="wizard-intro">「${escapeHtml(eventTitle)}」将从待办列表移出，到期后自动回到待确认队列。</p><div class="form-group"><label>延迟时长</label><select class="field" data-delay-minutes><option value="5">5 分钟</option><option value="15" selected>15 分钟</option><option value="30">30 分钟</option><option value="60">1 小时</option><option value="120">2 小时</option></select></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-delay-submit>确认延迟</button></div>`;
}

export function hostMiniGameModalHtml() {
  return `<h2>启动数字锁小游戏</h2><p class="wizard-intro">玩家端会实时看到机关卡片；答对后自动广播完成事件。</p><div class="form-group"><label>标题</label><input class="field" data-mini-title value="数字密码锁"><label>提示语</label><textarea class="field" rows="2" data-mini-prompt>输入线索中得到的密码。</textarea><label>答案</label><input class="field" data-mini-answer inputmode="numeric" placeholder="例如：2468"><label>尝试次数</label><input class="field" data-mini-attempts type="number" min="1" max="12" value="3"></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-mini-start>启动机关</button></div>`;
}

export function hostGrantClueModalHtml({ clueSelectHtml, memberRowsHtml, messageFieldHtml }) {
  clueSelectHtml = unwrapHtmlFragment(clueSelectHtml, "grant clue select");
  memberRowsHtml = unwrapHtmlFragment(memberRowsHtml, "grant clue members");
  messageFieldHtml = unwrapHtmlFragment(messageFieldHtml, "grant clue message");
  return `<h2>手动发放线索</h2><p class="wizard-intro">可一次发给多名玩家；每人独立获得 clue_ownership，不会默认公开给全房间。</p><div class="form-group">${clueSelectHtml}<label>目标角色（可多选）</label><div class="member-picker">${memberRowsHtml}</div>${messageFieldHtml}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-host-grant-submit>确认发放</button></div>`;
}

export function hostGrantItemModalHtml({ roleSelectHtml, itemSelectHtml, quantityFieldHtml, messageFieldHtml }) {
  roleSelectHtml = unwrapHtmlFragment(roleSelectHtml, "grant item role");
  itemSelectHtml = unwrapHtmlFragment(itemSelectHtml, "grant item select");
  quantityFieldHtml = unwrapHtmlFragment(quantityFieldHtml, "grant item quantity");
  messageFieldHtml = unwrapHtmlFragment(messageFieldHtml, "grant item message");
  return `<h2>手动发放物品</h2><p class="wizard-intro">物品会写入指定角色的背包（inventory），并可能触发 item_owned 规则。</p><div class="form-group">${roleSelectHtml}${itemSelectHtml}${quantityFieldHtml}${messageFieldHtml}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-host-grant-item-submit>确认发放</button></div>`;
}

export function hostUnlockSectionModalHtml({ roleSelectHtml, sectionSelectHtml, messageFieldHtml }) {
  roleSelectHtml = unwrapHtmlFragment(roleSelectHtml, "unlock role");
  sectionSelectHtml = unwrapHtmlFragment(sectionSelectHtml, "unlock section");
  messageFieldHtml = unwrapHtmlFragment(messageFieldHtml, "unlock message");
  return `<h2>手动解锁分幕</h2><p class="wizard-intro">解锁后，对应玩家即可阅读该私人分幕。</p><div class="form-group">${roleSelectHtml}${sectionSelectHtml}${messageFieldHtml}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-host-unlock-submit>确认解锁</button></div>`;
}

export function hostUnlockSceneModalHtml(sceneSelectHtml) {
  sceneSelectHtml = unwrapHtmlFragment(sceneSelectHtml, "unlock scene");
  return `<h2>手动开放场景</h2><p class="wizard-intro">开放后所有已入房玩家可在探索页看到该场景。</p><div class="form-group">${sceneSelectHtml}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-host-scene-submit>确认开放</button></div>`;
}

export function hostLogModalHtml({ roleSelectHtml, messageFieldHtml }) {
  roleSelectHtml = unwrapHtmlFragment(roleSelectHtml, "host log role");
  messageFieldHtml = unwrapHtmlFragment(messageFieldHtml, "host log message");
  return `<h2>添加主持日志</h2><p class="wizard-intro">记录会写入本房间的时间线，可在世界运行日志中查看。</p><div class="form-group">${roleSelectHtml}${messageFieldHtml}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-host-log-submit>写入日志</button></div>`;
}

export function hostNudgeModalHtml({ title, intro, messageHtml, memberRowsHtml }) {
  messageHtml = unwrapHtmlFragment(messageHtml, "host nudge message");
  memberRowsHtml = unwrapHtmlFragment(memberRowsHtml, "host nudge members");
  return `<h2>${escapeHtml(title)}</h2><p class="wizard-intro">${escapeHtml(intro)}</p><div class="form-group"><label>提醒内容</label><textarea class="field" rows="3" data-nudge-message>${messageHtml}</textarea><label>通知对象</label><div class="member-picker">${memberRowsHtml}</div></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-nudge-submit>发送提醒</button></div>`;
}
