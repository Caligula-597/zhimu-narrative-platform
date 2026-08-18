import {
  ACTION_TYPES,
  characterById,
  list,
  locationById,
  objectById,
  objectTypeByKey,
  padId,
  record,
  roleByKey
} from "./catalog.js";

function cloneLedger(ledger) {
  return structuredClone(ledger);
}

function cashOf(state, characterId) {
  return Number(state.accounts?.[characterId]?.cash) || 0;
}

function setCash(state, characterId, value) {
  if (!state.accounts[characterId]) state.accounts[characterId] = { cash: 0 };
  state.accounts[characterId].cash = value;
}

function roleKeyOf(state, characterId) {
  return characterById(state, characterId)?.roleKey || "";
}

function canAccess(state, characterId, locationId) {
  const location = locationById(state, locationId);
  if (!location) return false;
  const access = list(location.access);
  if (access.includes("public")) return true;
  return access.includes(roleKeyOf(state, characterId));
}

function hasPermission(state, characterId, permission) {
  const role = roleByKey(state, roleKeyOf(state, characterId));
  return list(role?.permissions).includes(permission);
}

function objectCaps(state, object) {
  return objectTypeByKey(state, object?.type) || {
    transferable: false,
    concealable: false,
    inspectable: false
  };
}

function samePlace(state, characterId, locationId) {
  return characterById(state, characterId)?.locationId === locationId;
}

function findDebt(state, debtor, creditor) {
  return list(state.debts).find((row) => row.debtor === debtor && row.creditor === creditor) || null;
}

function reject(message) {
  return { ok: false, message };
}

function applyOneAction(state, action) {
  const type = String(action?.type || "");
  if (!ACTION_TYPES.includes(type)) return reject(`未知动作 ${type}`);

  if (type === "medical_procedure") {
    const patient = characterById(state, action.patient);
    const cost = Number(action.cost);
    if (!patient) return reject("医疗对象不存在");
    if (!(cost > 0)) return reject("医疗支出必须为正数");
    setCash(state, patient.id, cashOf(state, patient.id) - cost);
    return { ok: true };
  }

  const actor = characterById(state, action.actor);
  if (type !== "medical_procedure" && !actor) return reject("动作缺少合法 actor");

  if (type === "move" || type === "enter") {
    if (!canAccess(state, actor.id, action.locationId)) return reject("无权进入该场所");
    actor.locationId = action.locationId;
    return { ok: true };
  }

  if (type === "give") {
    const object = objectById(state, action.objectId);
    const to = characterById(state, action.to);
    if (!object || !to) return reject("交付对象不存在");
    if (object.holder !== actor.id) return reject("交付人并不持有该物件");
    if (!objectCaps(state, object).transferable) return reject("该物件不可转交");
    if (to.locationId !== actor.locationId) return reject("双方不在同一场所");
    object.holder = to.id;
    object.locationId = to.locationId;
    return { ok: true };
  }

  if (type === "take") {
    const object = objectById(state, action.objectId);
    if (!object) return reject("物件不存在");
    if (!samePlace(state, actor.id, object.locationId)) return reject("物件不在当前场所");
    if (object.holder && object.holder !== actor.id) return reject("物件在他人手上");
    object.holder = actor.id;
    object.locationId = actor.locationId;
    return { ok: true };
  }

  if (type === "hide") {
    const object = objectById(state, action.objectId);
    const location = locationById(state, action.locationId || actor.locationId);
    if (!object || !location) return reject("藏匿对象或场所不存在");
    if (object.holder !== actor.id && !samePlace(state, actor.id, object.locationId)) {
      return reject("无法藏起不在身边的物件");
    }
    if (!objectCaps(state, object).concealable) return reject("该物件无法藏匿");
    if (!canAccess(state, actor.id, location.id)) return reject("无权进入藏匿场所");
    object.holder = null;
    object.locationId = location.id;
    object.fields = { ...record(object.fields), hidden: true };
    return { ok: true };
  }

  if (type === "borrow") {
    const other = characterById(state, action.counterparty);
    const amount = Number(action.amount);
    if (!other) return reject("借款对象不存在");
    if (!(amount > 0)) return reject("借款金额必须为正数");
    if (cashOf(state, other.id) < amount) return reject("对方现金不足");
    if (actor.locationId !== other.locationId) return reject("双方不在同一场所");
    setCash(state, other.id, cashOf(state, other.id) - amount);
    setCash(state, actor.id, cashOf(state, actor.id) + amount);
    const existing = findDebt(state, actor.id, other.id);
    if (existing) existing.amount += amount;
    else state.debts.push({ debtor: actor.id, creditor: other.id, amount, currency: action.currency || "CNY" });
    return { ok: true };
  }

  if (type === "repay") {
    const other = characterById(state, action.counterparty);
    const amount = Number(action.amount);
    const debt = other ? findDebt(state, actor.id, other.id) : null;
    if (!debt) return reject("没有对应债务");
    if (!(amount > 0) || amount > debt.amount) return reject("还款金额不成立");
    if (cashOf(state, actor.id) < amount) return reject("现金不足");
    setCash(state, actor.id, cashOf(state, actor.id) - amount);
    setCash(state, other.id, cashOf(state, other.id) + amount);
    debt.amount -= amount;
    if (debt.amount === 0) {
      state.debts = state.debts.filter((row) => row !== debt);
    }
    return { ok: true };
  }

  if (type === "spend") {
    const amount = Number(action.amount);
    if (!(amount > 0)) return reject("支出必须为正数");
    if (cashOf(state, actor.id) < amount) return reject("现金不足");
    setCash(state, actor.id, cashOf(state, actor.id) - amount);
    if (action.payee && characterById(state, action.payee)) {
      setCash(state, action.payee, cashOf(state, action.payee) + amount);
    }
    return { ok: true };
  }

  if (type === "create_object") {
    const caps = objectTypeByKey(state, action.objectType);
    if (!caps) return reject("未知物件类型");
    if (!canAccess(state, actor.id, action.locationId || actor.locationId)) return reject("无权在该场所生成物件");
    const seq = list(state.objects).length + 1;
    state.objects.push({
      id: padId("OBJ", seq),
      type: action.objectType,
      holder: action.holder || actor.id,
      locationId: action.locationId || actor.locationId,
      fields: record(action.fields)
    });
    return { ok: true };
  }

  if (type === "approve" || type === "deny" || type === "delay") {
    const permission = type === "delay" ? "hold_departure" : (type === "approve" ? "approve_delivery" : "kill_story");
    const fallback = type === "delay"
      ? ["hold_departure", "stamp_departure"]
      : type === "approve"
        ? ["approve_delivery", "approve_comp", "stamp_departure", "release_vehicle"]
        : ["kill_story", "hold_departure"];
    if (!fallback.some((item) => hasPermission(state, actor.id, item) || permission === item && hasPermission(state, actor.id, permission))) {
      if (!fallback.some((item) => hasPermission(state, actor.id, item))) {
        return reject("没有对应批准权限");
      }
    }
    return { ok: true };
  }

  if (type === "assign") {
    if (!characterById(state, action.to)) return reject("指派对象不存在");
    return { ok: true };
  }

  if (type === "search") {
    if (!canAccess(state, actor.id, action.locationId || actor.locationId)) return reject("无权搜索该场所");
    return { ok: true };
  }

  if (type === "assert") {
    if (!action.proposition || typeof action.proposition !== "object") return reject("声称缺少命题结构");
    return { ok: true };
  }

  if (type === "employ") {
    const employee = characterById(state, action.employee);
    if (!employee) return reject("雇佣对象不存在");
    if (!roleByKey(state, action.roleKey)) return reject("岗位不存在");
    employee.roleKey = action.roleKey;
    return { ok: true };
  }

  if (type === "resign") {
    return { ok: true };
  }

  return reject(`未实现的动作 ${type}`);
}

function validateEdges(actions, edges) {
  const issues = [];
  for (const edge of list(edges)) {
    if (edge.type !== "caused_by") {
      issues.push("只允许 caused_by 边");
      continue;
    }
    const from = Number(edge.from);
    const to = Number(edge.to);
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= actions.length || to >= actions.length) {
      issues.push("因果边索引越界");
      continue;
    }
    if (from >= to) issues.push("因果边必须从先发生的动作指向后发生的动作");
  }
  return issues;
}

export function previewEvent(ledger, draft = {}) {
  const actions = list(draft.actions);
  if (!actions.length) return { ok: false, issues: ["事件至少需要一个动作"] };
  const edgeIssues = validateEdges(actions, draft.edges);
  if (edgeIssues.length) return { ok: false, issues: edgeIssues };
  const next = cloneLedger(ledger);
  const issues = [];
  for (const action of actions) {
    const result = applyOneAction(next, action);
    if (!result.ok) issues.push(result.message);
  }
  if (issues.length) return { ok: false, issues };
  return { ok: true, ledger: next };
}

export function commitEvent(ledger, draft = {}) {
  const preview = previewEvent(ledger, draft);
  if (!preview.ok) return preview;
  const occupancy = Object.fromEntries(list(ledger.characters).map((row) => [row.id, row.locationId]));
  const event = {
    eventId: padId("EVT", Number(ledger.nextEventSeq) || list(ledger.eventLog).length + 1),
    version: 1,
    status: "canonical",
    t: list(ledger.eventLog).length + 1,
    locationId: draft.locationId || characterById(ledger, draft.actions?.[0]?.actor)?.locationId || null,
    actions: list(draft.actions),
    edges: list(draft.edges),
    occupancy
  };
  const next = preview.ledger;
  next.eventLog = [...list(ledger.eventLog), event];
  next.nextEventSeq = (Number(ledger.nextEventSeq) || next.eventLog.length) + 1;
  next.candidates = null;
  return { ok: true, ledger: next, event };
}

export function replayState(ledger) {
  return {
    schema: ledger.schema,
    characters: structuredClone(list(ledger.characters)),
    objects: structuredClone(list(ledger.objects)),
    accounts: structuredClone(record(ledger.accounts)),
    debts: structuredClone(list(ledger.debts))
  };
}
