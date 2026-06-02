import "dotenv/config";

const api = "http://localhost:4180/api";
const hostUserId = "154aa8a9-9cd2-4098-90f4-c75e56c0cc53";
const playerUserId = "1d5e8155-a80f-4e7f-99f0-0ae317a35f35";

async function request(path, { userId, method = "GET", body } = {}) {
  const headers = { "x-user-id": userId };
  if (body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${api}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
  return response.json();
}

const world = await request("/worlds", {
  userId: hostUserId,
  method: "POST",
  body: { name: "午夜列车", summary: "末班车驶入不存在的月台，乘客必须找出遗失的车票。" }
});
const chapter = await request(`/worlds/${world.id}/chapters`, {
  userId: hostUserId,
  method: "POST",
  body: { title: "不存在的第七码头", summary: "列车停靠后，所有时钟停在零点十三分。", sequence: 1 }
});
const role = await request(`/worlds/${world.id}/roles`, {
  userId: hostUserId,
  method: "POST",
  body: { name: "苏晚 · 摄影师", publicProfile: "为旧车站拍摄纪录片。", privateProfile: "相机中多出一张从未拍摄过的车票照片。", sequence: 1 }
});
const first = await request(`/worlds/${world.id}/roles/${role.id}/sections`, {
  userId: hostUserId,
  method: "POST",
  body: { chapterId: chapter.id, title: "末班车", body: "零点十三分，列车驶入没有站名的月台。你低头查看相机，发现最后一张照片里站着另一个自己。", sequence: 1 }
});
const second = await request(`/worlds/${world.id}/roles/${role.id}/sections`, {
  userId: hostUserId,
  method: "POST",
  body: { chapterId: chapter.id, title: "遗失的车票", body: "车门没有再次打开。座位下压着一张旧车票，终点一栏写着你的名字。", sequence: 2 }
});
const room = await request(`/worlds/${world.id}/rooms`, {
  userId: hostUserId,
  method: "POST",
  body: { name: "午夜列车 · 云端验证房", inviteCode: `MIDNIGHT-${Date.now()}` }
});
await request(`/worlds/${world.id}/rules`, {
  userId: hostUserId,
  method: "POST",
  body: {
    roomId: room.id,
    name: "读完末班车后解锁遗失的车票",
    conditions: { all: [{ type: "reading_completed", roleSlotId: role.id, scriptSectionId: first.id }] },
    actions: [
      { type: "unlock_script_section", scriptSectionId: second.id },
      { type: "timeline_log", message: "摄影师的第二段私人剧情已解锁" }
    ]
  }
});
await request("/rooms/join", {
  userId: playerUserId,
  method: "POST",
  body: { inviteCode: room.invite_code, roleSlotId: role.id }
});
let home = await request(`/rooms/${room.id}/player-home`, { userId: playerUserId });
await request(`/rooms/${room.id}/notebook`, {
  userId: playerUserId,
  method: "POST",
  body: { sourceType: "script_section", sourceId: first.id, title: "重点：照片里的另一个自己", body: home.sections[0].body }
});
const complete = await request(`/rooms/${room.id}/sections/${first.id}/complete`, {
  userId: playerUserId,
  method: "POST"
});
home = await request(`/rooms/${room.id}/player-home`, { userId: playerUserId });
console.log(JSON.stringify({
  world: world.name,
  room: room.name,
  role: home.role.name,
  unlockedSections: home.sections.map((section) => section.title),
  cloudNotes: home.notes.map((note) => note.title),
  executedRules: complete.executedRules.length
}, null, 2));
