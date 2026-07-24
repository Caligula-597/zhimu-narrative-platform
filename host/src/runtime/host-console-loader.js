let consoleModule = null;
let consolePromise = null;
let consoleRuntime = null;

function loadingConsole() {
  return `<section class="host-console host-console-loading" aria-busy="true">
    <div class="empty-state host-empty-state">
      <span class="empty-state-mark" aria-hidden="true">⌘</span>
      <p><strong>正在载入主持监控台</strong></p>
      <p>房间工具、实时事件与运行数据会在进入运行房后按需加载。</p>
    </div>
  </section>`;
}

export function renderHostConsoleBoundary() {
  return consoleModule?.renderConsole?.() || loadingConsole();
}

export async function loadHostConsole(context) {
  if (!consolePromise) {
    consolePromise = Promise.all([
      import("../views/console.js"),
      import("./host-console-runtime.js")
    ])
      .then(([loadedConsole, loadedRuntime]) => {
        consoleModule = loadedConsole;
        consoleRuntime = loadedRuntime.createHostConsoleRuntime(context);
        return loadedConsole;
      })
      .catch((error) => {
        consolePromise = null;
        consoleModule = null;
        consoleRuntime = null;
        throw error;
      });
  }
  const loaded = await consolePromise;
  loaded.bindConsoleContext(context);
  return loaded;
}

export async function handleHostConsoleAction(action, element) {
  return consoleRuntime ? consoleRuntime.handleAction(action, element) : false;
}

export function handleHostConsoleField(element) {
  consoleRuntime?.handleField(element);
}

export function getHostConsoleNavigationBlockReason() {
  return consoleRuntime?.navigationBlockReason?.() || "";
}
