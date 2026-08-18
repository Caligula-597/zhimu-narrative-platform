import { VENUE_LABELS } from "./catalog.js";

function loc(id, name, access, adjacent = []) {
  return { id, name, access, adjacent };
}

function role(key, title, permissions, infoChannels) {
  return { key, title, permissions, infoChannels };
}

function slot(roleKey, defaultName, startLocationId) {
  return { roleKey, defaultName, startLocationId };
}

const OBJECT_DEFAULTS = {
  photo: { transferable: true, concealable: true, inspectable: true },
  order: { transferable: true, concealable: false, inspectable: true },
  bag: { transferable: true, concealable: true, inspectable: true },
  dress: { transferable: true, concealable: false, inspectable: true },
  key: { transferable: true, concealable: true, inspectable: true },
  ticket: { transferable: true, concealable: true, inspectable: true },
  tape: { transferable: true, concealable: true, inspectable: true },
  camera: { transferable: true, concealable: false, inspectable: true },
  document: { transferable: true, concealable: true, inspectable: true },
  wine: { transferable: true, concealable: false, inspectable: true },
  room_key: { transferable: true, concealable: true, inspectable: true }
};

function schema({ locations, roles, objectTypes = OBJECT_DEFAULTS }) {
  return { locations, roles, objectTypes };
}

const TEMPLATES = {
  photo_studio: {
    label: VENUE_LABELS.photo_studio,
    summary: "化妆、礼服、摄影棚、修片室和订单交付按营业流程运转。",
    startingCash: 3000,
    dailyProcess: "完成当天已排期的拍摄并处理取件",
    schema: schema({
      locations: [
        loc("LOC_lobby", "前台", ["public"], ["LOC_makeup", "LOC_studio"]),
        loc("LOC_makeup", "化妆间", ["makeup_artist", "assistant", "owner", "client"], ["LOC_lobby", "LOC_fitting"]),
        loc("LOC_fitting", "礼服间", ["makeup_artist", "assistant", "owner", "client"], ["LOC_makeup", "LOC_dressing"]),
        loc("LOC_dressing", "更衣室", ["makeup_artist", "assistant", "owner", "client"], ["LOC_fitting"]),
        loc("LOC_studio", "摄影棚", ["photographer", "assistant", "makeup_artist", "owner", "client"], ["LOC_lobby", "LOC_darkroom"]),
        loc("LOC_darkroom", "修片室", ["photographer", "owner"], ["LOC_studio"])
      ],
      roles: [
        role("makeup_artist", "化妆师", ["inspect_photo"], ["makeup", "client_talk", "costume", "backstage"]),
        role("photographer", "摄影师", ["enter_darkroom", "inspect_photo"], ["lens", "waiting", "review_footage"]),
        role("assistant", "助理", [], ["errand", "overhear"]),
        role("owner", "老板", ["approve_delivery", "enter_darkroom", "inspect_photo"], ["accounts", "schedule"]),
        role("receptionist", "前台", ["approve_delivery"], ["orders", "front_desk"]),
        role("client", "客人", [], ["own_session"]),
        role("second_client", "第二组客人", [], ["own_session"]),
        role("technician", "后期", ["enter_darkroom", "inspect_photo"], ["darkroom"])
      ]
    }),
    roleSlots: [
      slot("makeup_artist", "唐珊", "LOC_makeup"),
      slot("photographer", "彭海", "LOC_studio"),
      slot("assistant", "小娟", "LOC_lobby"),
      slot("owner", "梁秀华", "LOC_lobby"),
      slot("receptionist", "前台", "LOC_lobby"),
      slot("client", "姚婷婷", "LOC_makeup"),
      slot("second_client", "何小姐", "LOC_makeup"),
      slot("technician", "阿强", "LOC_studio")
    ],
    initialObjects: [
      { id: "OBJ_001", type: "order", holder: null, locationId: "LOC_lobby", fields: { client: "邹先生" } },
      { id: "OBJ_002", type: "photo", holder: null, locationId: "LOC_darkroom", fields: { color: "brown", client: "邹先生" } },
      { id: "OBJ_003", type: "bag", holder: "CHAR_002", locationId: "LOC_studio", fields: { color: "black", shape: "bag" } },
      { id: "OBJ_004", type: "dress", holder: null, locationId: "LOC_fitting", fields: { color: "white" } }
    ]
  },
  bus_station: {
    label: VENUE_LABELS.bus_station,
    summary: "检票、发车单、机务放行和加班车按班次运转。",
    startingCash: 2000,
    dailyProcess: "保证后续班次准点发车并处理异常车辆",
    schema: schema({
      locations: [
        loc("LOC_dispatch", "调度室", ["dispatcher", "director"], ["LOC_platform", "LOC_ticket"]),
        loc("LOC_platform", "站台", ["dispatcher", "driver", "mechanic", "porter", "public"], ["LOC_dispatch", "LOC_repair"]),
        loc("LOC_ticket", "售票厅", ["ticket_agent", "dispatcher", "public"], ["LOC_dispatch"]),
        loc("LOC_repair", "维修院", ["mechanic", "driver", "dispatcher"], ["LOC_platform"]),
        loc("LOC_rest", "司机休息室", ["driver", "dispatcher"], ["LOC_platform"]),
        loc("LOC_luggage", "行包房", ["porter", "dispatcher"], ["LOC_platform"])
      ],
      roles: [
        role("dispatcher", "调度员", ["stamp_departure", "hold_departure"], ["run_sheet", "radio", "platform"]),
        role("driver", "司机", [], ["vehicle", "rest_room"]),
        role("mechanic", "机务", ["release_vehicle"], ["inspection"]),
        role("ticket_agent", "售票", ["issue_ticket"], ["tickets"]),
        role("porter", "行包", [], ["luggage"]),
        role("director", "主任", ["stamp_departure"], ["office_phone"]),
        role("mechanic_kin", "修理厂熟人", [], ["rest_room"]),
        role("inspector", "运管", ["hold_departure"], ["checkpoint"])
      ]
    }),
    roleSlots: [
      slot("dispatcher", "梁敏", "LOC_dispatch"),
      slot("driver", "马会民", "LOC_rest"),
      slot("mechanic", "老顾", "LOC_repair"),
      slot("ticket_agent", "小孟", "LOC_ticket"),
      slot("porter", "老郑", "LOC_luggage"),
      slot("director", "主任", "LOC_dispatch"),
      slot("mechanic_kin", "梁东", "LOC_rest"),
      slot("inspector", "运管", "LOC_platform")
    ],
    initialObjects: [
      { id: "OBJ_001", type: "document", holder: null, locationId: "LOC_dispatch", fields: { kind: "run_sheet" } },
      { id: "OBJ_002", type: "key", holder: "CHAR_002", locationId: "LOC_rest", fields: { shape: "key" } },
      { id: "OBJ_003", type: "ticket", holder: null, locationId: "LOC_ticket", fields: { route: "石桥" } },
      { id: "OBJ_004", type: "document", holder: null, locationId: "LOC_repair", fields: { kind: "inspection" } }
    ]
  },
  tv_station: {
    label: VENUE_LABELS.tv_station,
    summary: "采访、剪辑、交带和播出按节目截止时间运转。",
    startingCash: 2500,
    dailyProcess: "完成当天新闻播出并处理临时交带",
    schema: schema({
      locations: [
        loc("LOC_newsroom", "新闻部", ["camera", "reporter", "director", "anchor"], ["LOC_edit", "LOC_gear"]),
        loc("LOC_edit", "机房", ["camera", "tech", "director"], ["LOC_newsroom", "LOC_playout"]),
        loc("LOC_gear", "器材间", ["camera", "tech"], ["LOC_newsroom"]),
        loc("LOC_playout", "播出部", ["tech", "director"], ["LOC_edit"]),
        loc("LOC_canteen", "食堂", ["public"], ["LOC_newsroom"]),
        loc("LOC_field", "外场", ["camera", "reporter", "ad_rep"], [])
      ],
      roles: [
        role("camera", "摄像", [], ["lens", "waiting", "review_footage"]),
        role("reporter", "记者", [], ["interview", "notes"]),
        role("director", "主任", ["kill_story"], ["assignment"]),
        role("anchor", "主持人", [], ["studio"]),
        role("tech", "技术", ["hold_file"], ["playout"]),
        role("ad_rep", "广告", [], ["clients"]),
        role("guard", "门卫", [], ["gate"]),
        role("factory_pr", "厂方宣传", [], ["field"])
      ]
    }),
    roleSlots: [
      slot("camera", "许川", "LOC_newsroom"),
      slot("reporter", "小陶", "LOC_newsroom"),
      slot("director", "赵志刚", "LOC_newsroom"),
      slot("anchor", "陈茜", "LOC_newsroom"),
      slot("tech", "小邓", "LOC_edit"),
      slot("ad_rep", "马振东", "LOC_canteen"),
      slot("guard", "老刘", "LOC_field"),
      slot("factory_pr", "刘庆华", "LOC_field")
    ],
    initialObjects: [
      { id: "OBJ_001", type: "camera", holder: "CHAR_001", locationId: "LOC_gear", fields: { shape: "camera" } },
      { id: "OBJ_002", type: "tape", holder: null, locationId: "LOC_edit", fields: { color: "black" } },
      { id: "OBJ_003", type: "document", holder: "CHAR_002", locationId: "LOC_newsroom", fields: { kind: "interview" } },
      { id: "OBJ_004", type: "tape", holder: null, locationId: "LOC_playout", fields: { kind: "broadcast" } }
    ]
  },
  hotel: {
    label: VENUE_LABELS.hotel,
    summary: "宴会、客房、库存和账目按当天席面运转。",
    startingCash: 4000,
    dailyProcess: "把当天宴席开席并处理客房与库存",
    schema: schema({
      locations: [
        loc("LOC_banquet", "宴会厅", ["manager", "captain", "chef", "guest"], ["LOC_kitchen", "LOC_lobby"]),
        loc("LOC_kitchen", "后厨", ["chef", "manager"], ["LOC_banquet", "LOC_cellar"]),
        loc("LOC_cellar", "酒窖", ["manager", "captain"], ["LOC_kitchen"]),
        loc("LOC_lobby", "大堂", ["manager", "front_desk", "public"], ["LOC_banquet", "LOC_room"]),
        loc("LOC_room", "客房走廊", ["manager", "housekeeping", "guest"], ["LOC_lobby"]),
        loc("LOC_office", "经理室", ["manager", "owner"], ["LOC_lobby"])
      ],
      roles: [
        role("manager", "经理", ["approve_comp", "open_cellar"], ["accounts", "floor"]),
        role("captain", "领班", ["open_cellar"], ["floor"]),
        role("chef", "厨师", [], ["kitchen"]),
        role("front_desk", "前台", ["issue_room_key"], ["reservations"]),
        role("housekeeping", "客房", [], ["rooms"]),
        role("owner", "老板", ["approve_comp"], ["accounts"]),
        role("guest", "客人", [], ["own_room"]),
        role("second_guest", "第二桌客人", [], ["own_room"])
      ]
    }),
    roleSlots: [
      slot("manager", "周启明", "LOC_banquet"),
      slot("captain", "领班", "LOC_banquet"),
      slot("chef", "后厨", "LOC_kitchen"),
      slot("front_desk", "前台", "LOC_lobby"),
      slot("housekeeping", "客房", "LOC_room"),
      slot("owner", "老板", "LOC_office"),
      slot("guest", "新人", "LOC_banquet"),
      slot("second_guest", "亲家", "LOC_banquet")
    ],
    initialObjects: [
      { id: "OBJ_001", type: "wine", holder: null, locationId: "LOC_cellar", fields: { color: "red" } },
      { id: "OBJ_002", type: "room_key", holder: "CHAR_004", locationId: "LOC_lobby", fields: { shape: "key" } },
      { id: "OBJ_003", type: "document", holder: "CHAR_001", locationId: "LOC_office", fields: { kind: "banquet_order" } },
      { id: "OBJ_004", type: "wine", holder: null, locationId: "LOC_banquet", fields: { color: "white" } }
    ]
  }
};

export function getVenueTemplate(venueKey) {
  return TEMPLATES[venueKey] || TEMPLATES.photo_studio;
}

export function listVenueTemplates() {
  return Object.keys(TEMPLATES);
}
