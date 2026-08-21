import { COLLISION_TYPES } from "./generation-architecture.js";
import { list, record } from "./catalog.js";

function add(collisions, type, resourceIds, extra = {}) {
  if (!COLLISION_TYPES.includes(type)) return;
  collisions.push({
    collisionId: `COL_${String(collisions.length + 1).padStart(3, "0")}`,
    type,
    resourceIds,
    ...extra
  });
}

export function enumerateCollisions(ledger) {
  const collisions = [];
  for (const debt of list(ledger.debts)) {
    if (debt.amount > 0) {
      add(collisions, "unpaid_obligation", [`DEBT_${debt.debtor}_${debt.creditor}`], {
        debtor: debt.debtor,
        creditor: debt.creditor,
        amount: debt.amount
      });
    }
  }
  for (const object of list(ledger.objects)) {
    const fields = record(object.fields);
    if (Number(fields.sharedCapacity) > 0) {
      add(collisions, "shared_capacity", [object.id], { capacity: fields.sharedCapacity });
    }
    if (fields.deadline) {
      add(collisions, "deadline_collision", [object.id], { deadline: fields.deadline });
    }
    if (fields.kind === "warehouse_key" || object.type === "key") {
      add(collisions, "access_bottleneck", [object.id], { holder: object.holder });
    }
  }
  const docs = list(ledger.objects).filter((row) => row.type === "document" && record(row.fields).tons != null);
  for (let i = 0; i < docs.length; i += 1) {
    for (let j = i + 1; j < docs.length; j += 1) {
      if (Number(docs[i].fields.tons) !== Number(docs[j].fields.tons)) {
        add(collisions, "contested_object", [docs[i].id, docs[j].id], {
          leftTons: docs[i].fields.tons,
          rightTons: docs[j].fields.tons
        });
      }
    }
  }
  const stampRoles = list(ledger.schema?.roles).filter((row) => list(row.permissions).some((item) => item.startsWith("stamp_") || item.startsWith("assign_")));
  if (stampRoles.length >= 2) {
    add(collisions, "permission_dependency", stampRoles.map((row) => row.key));
  }
  return collisions;
}

export function buildPlayIr(collisions, selectedIds, activations = {}) {
  const selected = list(collisions).filter((row) => selectedIds.includes(row.collisionId));
  return {
    playId: "PLAY_01",
    collisionRefs: selected.map((row) => ({
      collisionId: row.collisionId,
      type: row.type,
      resourceIds: row.resourceIds,
      activation: activations[row.collisionId] || "during_act"
    })),
    activeResources: [...new Set(selected.flatMap((row) => row.resourceIds))],
    openingSaturation: selected.every((row) => (activations[row.collisionId] || "during_act") === "before_act")
  };
}
