import { list, record } from "./catalog.js";

export const PUBLIC_KNOWLEDGE_THRESHOLD = 0.5;

function pushPublic(items, row) {
  if (!row?.surface) return;
  if (items.some((item) => item.publicId === row.publicId || item.token === row.token)) return;
  items.push(row);
}

export function extractPublicContext(ledger, { playIr } = {}) {
  const playerCount = Math.max(1, list(ledger.characters).length);
  const items = [];
  const collisions = list(playIr?.collisionRefs);
  const deadline = collisions.find((row) => row.type === "deadline_collision")
    || list(ledger.objects).find((row) => record(row.fields).deadline);
  const crane = collisions.find((row) => row.type === "shared_capacity")
    || list(ledger.objects).find((row) => Number(record(row.fields).sharedCapacity) > 0);

  if (deadline) {
    pushPublic(items, {
      publicId: "PUBLIC_01",
      token: "deadline_approaching",
      world_refs: deadline.resourceIds || [deadline.id],
      knowledge_count: playerCount,
      not_private: true,
      required_for_play: true,
      surface: "今晚作业必须赶在本轮潮水窗口结束前完成。"
    });
  }
  if (crane) {
    pushPublic(items, {
      publicId: "PUBLIC_02",
      token: "shared_capacity_blocked",
      world_refs: crane.resourceIds || [crane.id],
      knowledge_count: playerCount,
      not_private: true,
      required_for_play: true,
      surface: "码头现在只有一台主吊机可用。"
    });
  }
  if (ledger.dailyProcess) {
    pushPublic(items, {
      publicId: "PUBLIC_03",
      token: "delivery_due",
      world_refs: ["PROCESS"],
      knowledge_count: playerCount,
      not_private: true,
      required_for_play: true,
      surface: "当班要完成装卸并备齐离港手续。"
    });
  }

  return items.filter((row) => (
    row.knowledge_count / playerCount >= PUBLIC_KNOWLEDGE_THRESHOLD
    && row.not_private
    && row.required_for_play
  ));
}

export function publicSurfaces(publicContext) {
  return list(publicContext).map((row) => row.surface);
}

export function compilePublicBriefing(publicContext) {
  return publicSurfaces(publicContext).join("\n");
}

export function isPublicSlogan(text) {
  return /潮水.{0,6}不等人|潮汐.{0,6}不等人|海水涨落不等人|潮水窗口不等人/u.test(String(text || ""));
}
