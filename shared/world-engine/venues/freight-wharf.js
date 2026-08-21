import { VENUE_LABELS } from "../catalog.js";

function loc(id, name, access, adjacent = []) {
  return { id, name, access, adjacent };
}

function role(key, title, permissions, infoChannels) {
  return { key, title, permissions, infoChannels };
}

function slot(roleKey, defaultName, startLocationId) {
  return { roleKey, defaultName, startLocationId };
}

export const FREIGHT_WHARF_TEMPLATE = {
  label: VENUE_LABELS.freight_wharf,
  summary: "泊位、吊机、仓库和离港手续按当班潮水运转。",
  startingCash: 15000,
  dailyProcess: "在潮水窗口内完成当班装卸并备齐离港手续",
  schema: {
    locations: [
      loc("LOC_dispatch", "调度室", ["dispatcher", "inspector", "shipper", "old_agent"], ["LOC_berth", "LOC_office", "LOC_canteen"]),
      loc("LOC_berth", "泊位", ["dispatcher", "captain", "shipper", "stevedore", "crane_op", "public"], ["LOC_dispatch", "LOC_crane"]),
      loc("LOC_crane", "吊机位", ["crane_op", "stevedore", "dispatcher"], ["LOC_berth", "LOC_warehouse"]),
      loc("LOC_warehouse", "仓库", ["keeper", "stevedore", "dispatcher", "shipper"], ["LOC_crane"]),
      loc("LOC_office", "港务点", ["inspector", "dispatcher", "old_agent"], ["LOC_dispatch"]),
      loc("LOC_canteen", "工棚", ["stevedore", "crane_op", "keeper", "dispatcher"], ["LOC_dispatch", "LOC_crane"])
    ],
    roles: [
      role("dispatcher", "调度", ["stamp_berth", "assign_crane"], ["run_sheet", "radio"]),
      role("crane_op", "吊机司机", [], ["crane"]),
      role("keeper", "仓库保管", ["open_warehouse"], ["ledger", "keys"]),
      role("stevedore", "装卸队长", [], ["crew", "canteen"]),
      role("shipper", "货主业务", [], ["bill", "ship"]),
      role("old_agent", "旧船运代理", [], ["accounts"]),
      role("inspector", "港务驻点", ["stamp_clearance", "hold_berth"], ["clearance"]),
      role("captain", "船长", [], ["ship", "tide"])
    ],
    objectTypes: {
      document: { transferable: true, concealable: true, inspectable: true },
      key: { transferable: true, concealable: true, inspectable: true },
      crane: { transferable: false, concealable: false, inspectable: true },
      bag: { transferable: true, concealable: true, inspectable: true }
    }
  },
  roleSlots: [
    slot("dispatcher", "沈广泰", "LOC_dispatch"),
    slot("crane_op", "吴小军", "LOC_crane"),
    slot("keeper", "闵成仓", "LOC_warehouse"),
    slot("stevedore", "赵石", "LOC_canteen"),
    slot("shipper", "周宁", "LOC_berth"),
    slot("old_agent", "钱厚德", "LOC_office"),
    slot("inspector", "郝立", "LOC_office"),
    slot("captain", "刘大海", "LOC_berth")
  ],
  initialObjects: [
    { id: "OBJ_001", type: "document", holder: "CHAR_001", locationId: "LOC_dispatch", fields: { kind: "berth_sheet", deadline: "22:00" } },
    { id: "OBJ_002", type: "key", holder: "CHAR_003", locationId: "LOC_warehouse", fields: { shape: "key", kind: "warehouse_key" } },
    { id: "OBJ_003", type: "crane", holder: null, locationId: "LOC_crane", fields: { sharedCapacity: 1, jobs: 0 } },
    { id: "OBJ_004", type: "document", holder: null, locationId: "LOC_warehouse", fields: { kind: "warehouse_ledger", tons: 48 } }
  ]
};
