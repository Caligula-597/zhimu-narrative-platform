import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const targetUrl = process.argv[2] || "http://127.0.0.1:4173/";
const screenshotPath = path.resolve(process.argv[3] || path.join(root, "artifacts", "writer-focus-edge.png"));
const windowSize = process.argv[4] || "1600,1000";
const edgePath = process.env.EDGE_PATH || "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const debugPort = 9333;
const profileDir = path.join(os.tmpdir(), `zhimu-edge-qa-${Date.now()}`);

await mkdir(path.dirname(screenshotPath), { recursive: true });

const edge = spawn(edgePath, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--disable-default-apps",
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profileDir}`,
  `--window-size=${windowSize}`,
  targetUrl
], { stdio: "ignore", windowsHide: true });

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function devtoolsTarget() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/list`);
      const targets = await response.json();
      const page = targets.find((item) => item.type === "page" && item.url.startsWith(targetUrl))
        || targets.find((item) => item.type === "page");
      if (page?.webSocketDebuggerUrl) return page;
    } catch {}
    await delay(100);
  }
  throw new Error("Edge DevTools endpoint did not become ready");
}

class CdpSession {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.sequence = 0;
    this.pending = new Map();
    this.events = [];
  }

  async connect() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id) {
        const request = this.pending.get(message.id);
        if (!request) return;
        this.pending.delete(message.id);
        if (message.error) request.reject(new Error(message.error.message));
        else request.resolve(message.result);
        return;
      }
      this.events.push(message);
    });
  }

  send(method, params = {}) {
    const id = ++this.sequence;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  close() {
    this.socket.close();
  }
}

function runtimeValue(result) {
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Runtime evaluation failed");
  return result.result?.value;
}

const fixture = {
  world: {
    id: "qa-world",
    name: "雾港回声",
    membership_role: "owner",
    settings: { creationType: "murder_mystery" }
  },
  roles: [
    { id: "role-1", name: "钟离", public_profile: "商队书记，负责记录边城会盟。", private_profile: "暗中追查失踪的密函。", sequence: 1 },
    { id: "role-2", name: "云璇", public_profile: "北地使团护卫。", private_profile: "", sequence: 2 }
  ],
  sections: [
    { id: "section-1", role_slot_id: "role-1", title: "边城暮色", body: "七位使臣陆续抵达边城，各自代表着不同的立场与利益。\n\n钟离作为商队书记，静静站在城楼之上，俯瞰远处风沙与岁月磨砺的城市。\n\n他知道，每一句寒暄背后都藏着尚未公开的交换。", sequence: 1, chapter_id: "chapter-1", publication_status: "draft", metadata: {} },
    { id: "section-2", role_slot_id: "role-1", title: "暗流涌动", body: "夜色降临后，旧驿站送来一封没有落款的信。", sequence: 2, chapter_id: "chapter-1", publication_status: "testing", metadata: {} },
    { id: "section-3", role_slot_id: "role-1", title: "夜枭现身", body: "黑夜中的异常动静让边城陷入不安。", sequence: 3, chapter_id: "chapter-2", publication_status: "published", metadata: {} }
  ],
  chapters: [
    { id: "chapter-1", title: "序章 · 归来", summary: "使团抵达边城。", sequence: 1, publication_status: "testing" },
    { id: "chapter-2", title: "第二幕 · 密函", summary: "失踪密函重新出现。", sequence: 2, publication_status: "draft" }
  ],
  versions: [],
  clues: []
};

let session;
try {
  const target = await devtoolsTarget();
  session = new CdpSession(target.webSocketDebuggerUrl);
  await session.connect();
  await session.send("Page.enable");
  await session.send("Runtime.enable");
  await session.send("Log.enable");
  await session.send("Page.navigate", { url: targetUrl });

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const ready = runtimeValue(await session.send("Runtime.evaluate", { expression: "document.readyState === 'complete' && Boolean(window.zhimuViewLoader)", returnByValue: true }));
    if (ready) break;
    await delay(100);
  }

  const seedExpression = `(async()=>{
    await window.zhimuViewLoader.ensureViewModules("writer");
    const state=await import("/src/state/index.js");
    const runtime=await import("/src/runtime/runtime-facade.js");
    const writer=await import("/src/views/writer.js");
    state.userStore.set({apiError:""});
    state.studioStore.set({cloudStudio:${JSON.stringify(fixture)},cloudLoading:false,studioLoading:false,studioError:""});
    state.uiStore.set({view:"writer",writerSelectedRoleId:"role-1",writerEditorOpen:false,writerEditorRoleId:null,writerEditorSectionId:null});
    runtime.render();
    writer.openCreatorSection("role-1","section-1");
    await new Promise(resolve=>setTimeout(resolve,120));
    document.querySelector("#auth-banner").hidden=true;
    return Boolean(document.querySelector("[data-writer-section-editor]"));
  })()`;
  const seeded = runtimeValue(await session.send("Runtime.evaluate", { expression: seedExpression, awaitPromise: true, returnByValue: true }));
  if (!seeded) throw new Error("Writer focus editor did not render");

  const initial = runtimeValue(await session.send("Runtime.evaluate", {
    expression: `({
      modalVisible:document.querySelector("#modal-backdrop")?.classList.contains("show"),
      focusVisible:Boolean(document.querySelector("[data-writer-section-editor]")),
      outlineCount:document.querySelectorAll(".writer-focus-outline-item").length,
      viewport:[innerWidth,innerHeight],
      contentWidth:Math.round(document.querySelector(".writer-focus-shell").getBoundingClientRect().width),
      pageScrollHeight:document.documentElement.scrollHeight,
      dockBottom:Math.round(document.querySelector(".writer-focus-dock").getBoundingClientRect().bottom),
      title:document.querySelector("[data-studio-field=title]").value
    })`,
    returnByValue: true
  }));

  const screenshot = await session.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
  await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));

  const interaction = runtimeValue(await session.send("Runtime.evaluate", {
    expression: `(async()=>{
      const writer=await import("/src/views/writer.js");
      const initialDock=document.querySelector(".writer-focus-dock");
      initialDock.scrollIntoView({block:"end"});
      await new Promise(resolve=>setTimeout(resolve,40));
      const dockRect=initialDock.getBoundingClientRect();
      const dockReachable=dockRect.top<innerHeight&&dockRect.bottom>0;
      scrollTo(0,0);
      writer.openCreatorSection("role-1","");
      await new Promise(resolve=>setTimeout(resolve,80));
      const body=document.querySelector('[data-studio-field="body"]');
      const title=document.querySelector('[data-studio-field="title"]');
      title.value="临时序章";title.dispatchEvent(new Event("input",{bubbles:true}));
      body.value="雾从港口升起，钟声穿过长街。";body.dispatchEvent(new Event("input",{bubbles:true}));
      document.querySelector('[data-editor-search]').value="钟声";
      document.querySelector('[data-editor-replace]').value="汽笛";
      document.querySelector('[data-action="writer-editor-replace"]').click();
      await new Promise(resolve=>setTimeout(resolve,40));
      const replaced=body.value.includes("汽笛")&&!body.value.includes("钟声");
      body.setSelectionRange(0,1);
      document.querySelector('[data-action="writer-editor-format"][data-format="bold"]').click();
      await new Promise(resolve=>setTimeout(resolve,40));
      const formatted=body.value.startsWith("**雾**");
      document.querySelector('[data-action="writer-editor-close"]').click();
      await new Promise(resolve=>setTimeout(resolve,80));
      const returned=Boolean(document.querySelector(".writer-role-workbench"));
      document.querySelector('[data-action="creator-add-section"][data-role="role-1"]')?.click();
      await new Promise(resolve=>setTimeout(resolve,80));
      const draftRestored=document.querySelector('[data-studio-field="body"]')?.value==="**雾**从港口升起，汽笛穿过长街。";
      document.querySelector('[data-action="writer-editor-discard"]')?.click();
      await new Promise(resolve=>setTimeout(resolve,80));
      const discarded=Boolean(document.querySelector(".writer-role-workbench"));
      document.querySelector('[data-action="creator-add-section"][data-role="role-1"]')?.click();
      await new Promise(resolve=>setTimeout(resolve,80));
      const discardCleared=document.querySelector('[data-studio-field="body"]')?.value==="";
      return {dockReachable,replaced,formatted,returned,draftRestored,discarded,discardCleared};
    })()`,
    awaitPromise: true,
    returnByValue: true
  }));

  const seriousErrors = session.events
    .filter((event) => event.method === "Runtime.exceptionThrown")
    .map((event) => event.params?.exceptionDetails?.text || "Runtime exception");

  process.stdout.write(`${JSON.stringify({ screenshotPath, initial, interaction, seriousErrors }, null, 2)}\n`);
  if (
    initial.modalVisible || !initial.focusVisible || initial.outlineCount !== 3 ||
    !interaction.dockReachable || !interaction.replaced || !interaction.formatted || !interaction.returned || !interaction.draftRestored || !interaction.discarded || !interaction.discardCleared || seriousErrors.length
  ) process.exitCode = 1;
} finally {
  session?.close();
  edge.kill();
  await delay(150);
  await rm(profileDir, { recursive: true, force: true }).catch(() => {});
}
