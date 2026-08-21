import { commitEvent } from "./engine.js";
import { createLedgerFromSeed } from "./seed.js";
import { enumerateCollisions, buildPlayIr } from "./collision.js";
import { projectRuntimeLog } from "./runtime-log.js";

function mustCommit(ledger, draft) {
  const result = commitEvent(ledger, draft);
  if (!result.ok) throw new Error(result.issues?.join("; ") || result.message || "commit failed");
  return result.ledger;
}

export function buildFactionAct1World() {
  let ledger = createLedgerFromSeed({
    venueKey: "freight_wharf",
    title: "临河泊位",
    era: "1990s",
    playerCount: 8,
    dramaLevel: 3,
    genres: ["faction", "profession"],
    allowed: ["debt", "theft", "power_struggle"]
  });
  ledger.authorNotes.push({
    note: "作者希望旧码头班底与华通货主在今晚卸货顺序上较劲。不进入知识图。"
  });

  ledger = mustCommit(ledger, {
    phase: "before_act",
    locationId: "LOC_dispatch",
    actions: [{ type: "move", actor: "CHAR_006", locationId: "LOC_dispatch" }]
  });
  ledger = mustCommit(ledger, {
    phase: "before_act",
    locationId: "LOC_dispatch",
    actions: [
      { type: "borrow", actor: "CHAR_001", counterparty: "CHAR_006", amount: 12000, currency: "CNY" }
    ]
  });
  ledger = mustCommit(ledger, {
    phase: "before_act",
    locationId: "LOC_office",
    actions: [{ type: "move", actor: "CHAR_006", locationId: "LOC_office" }]
  });
  ledger = mustCommit(ledger, {
    phase: "before_act",
    locationId: "LOC_berth",
    actions: [{
      type: "create_object",
      actor: "CHAR_005",
      objectType: "document",
      locationId: "LOC_berth",
      fields: { kind: "delivery_bill", tons: 46, ship: "华通3号" }
    }]
  });

  ledger = mustCommit(ledger, {
    phase: "during_act",
    locationId: "LOC_dispatch",
    actions: [{ type: "move", actor: "CHAR_005", locationId: "LOC_dispatch" }]
  });
  ledger = mustCommit(ledger, {
    phase: "during_act",
    locationId: "LOC_dispatch",
    actions: [{
      type: "assert",
      actor: "CHAR_005",
      audience: ["CHAR_001"],
      proposition: { token: "delivery_due", objectId: "OBJ_005", tons: 46 }
    }]
  });
  ledger = mustCommit(ledger, {
    phase: "during_act",
    locationId: "LOC_dispatch",
    actions: [{ type: "move", actor: "CHAR_006", locationId: "LOC_dispatch" }]
  });
  ledger = mustCommit(ledger, {
    phase: "during_act",
    locationId: "LOC_dispatch",
    actions: [{
      type: "assert",
      actor: "CHAR_006",
      audience: ["CHAR_001", "CHAR_005"],
      proposition: { token: "unpaid_obligation", amount: 12000 }
    }]
  });
  ledger = mustCommit(ledger, {
    phase: "during_act",
    locationId: "LOC_dispatch",
    actions: [{ type: "move", actor: "CHAR_007", locationId: "LOC_dispatch" }]
  });
  ledger = mustCommit(ledger, {
    phase: "during_act",
    locationId: "LOC_dispatch",
    actions: [{
      type: "delay",
      actor: "CHAR_007"
    }, {
      type: "assert",
      actor: "CHAR_007",
      audience: ["CHAR_001", "CHAR_005", "CHAR_006"],
      proposition: { token: "approval_required", reason: "clearance" }
    }]
  });
  ledger = mustCommit(ledger, {
    phase: "during_act",
    locationId: "LOC_crane",
    actions: [{ type: "move", actor: "CHAR_004", locationId: "LOC_crane" }]
  });
  ledger = mustCommit(ledger, {
    phase: "during_act",
    locationId: "LOC_crane",
    actions: [{
      type: "assert",
      actor: "CHAR_004",
      audience: ["CHAR_002"],
      proposition: { token: "shared_capacity_blocked", objectId: "OBJ_003" }
    }]
  });
  ledger = mustCommit(ledger, {
    phase: "during_act",
    locationId: "LOC_warehouse",
    actions: [{ type: "move", actor: "CHAR_005", locationId: "LOC_warehouse" }]
  });
  ledger = mustCommit(ledger, {
    phase: "during_act",
    locationId: "LOC_warehouse",
    actions: [
      { type: "search", actor: "CHAR_003", locationId: "LOC_warehouse", objectId: "OBJ_004" },
      { type: "search", actor: "CHAR_003", locationId: "LOC_warehouse", objectId: "OBJ_005" }
    ]
  });

  const collisions = enumerateCollisions(ledger);
  const selected = collisions.map((row) => row.collisionId);
  const activations = Object.fromEntries(collisions.map((row) => [row.collisionId, "during_act"]));
  const playIr = buildPlayIr(collisions, selected, activations);
  const runtimeLog = projectRuntimeLog(ledger);
  const interactions = [
    {
      interactionId: "INT_001",
      channel: "counter",
      initiator: "CHAR_005",
      audience: ["CHAR_001"],
      purpose: "request_berth",
      acquisition_mode: "voluntary_telling",
      render_mode: "reported",
      disclosed_refs: ["OBJ_005"],
      acts: [{ act: "request_unload", result: "answered", answer: "46吨提货单" }]
    },
    {
      interactionId: "INT_002",
      channel: "counter",
      initiator: "CHAR_006",
      audience: ["CHAR_001", "CHAR_005"],
      purpose: "request_payment",
      acquisition_mode: "voluntary_telling",
      render_mode: "direct",
      disclosed_refs: ["DEBT_CHAR_001_CHAR_006"],
      acts: [{ act: "say", text: "不结清今晚这票货别想走。", flags: ["threat_or_offer", "keep_verbatim"] }]
    },
    {
      interactionId: "INT_003",
      channel: "counter",
      initiator: "CHAR_007",
      audience: ["CHAR_001", "CHAR_005", "CHAR_006"],
      purpose: "require_clearance",
      acquisition_mode: "voluntary_telling",
      render_mode: "reported",
      disclosed_refs: ["OBJ_001"],
      acts: [{ act: "require_papers", result: "answered", answer: "离港手续今晚要齐" }]
    },
    {
      interactionId: "INT_004",
      channel: "work",
      initiator: "CHAR_004",
      audience: ["CHAR_002"],
      purpose: "ask_job_order",
      acquisition_mode: "voluntary_telling",
      render_mode: "reported",
      disclosed_refs: ["OBJ_003"],
      acts: [
        { act: "ask_first_job", result: "unknown" },
        { act: "ask_second_job", result: "unavailable" },
        { act: "ask_capacity", answer: "今晚只能开一钩" }
      ]
    }
  ];
  return { ledger, collisions, playIr, runtimeLog, interactions };
}
