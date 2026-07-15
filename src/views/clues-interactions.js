import * as zhimuApi from "../api/index.js";
import { render } from "../runtime/runtime-facade.js";
import { studioStore, uiStore } from "../state/index.js";
import * as S from "../components/ui-semantics.js";
import { captureClueFlowViewport, restoreClueFlowViewport } from "./clue-flow-view.js";

const showError = S.showError;

export function toggleCluesSelection(clueId, checked) {
    const ui = uiStore.get();
    const set = new Set(ui.cluesBulkSelection || []);
    if (checked) set.add(clueId);
    else set.delete(clueId);
    uiStore.set({ cluesBulkSelection: [...set] });
    render();
  }

  export function syncCluesSelectAll(checked, visibleIds) {
    uiStore.set({ cluesBulkSelection: checked ? [...visibleIds] : [] });
    render();
  }

  export function selectClue(clueId) {
    if (!clueId) return;
    const scroll = captureClueFlowViewport();
    uiStore.set({ cluesSelectedId: clueId });
    render();
    restoreClueFlowViewport(scroll);
  }

  export function closeClueDetail() {
    const scroll = captureClueFlowViewport();
    uiStore.set({ cluesSelectedId: "" });
    uiStore.set({ clueDetailTab: "detail" });
    render();
    restoreClueFlowViewport(scroll);
  }

  export function setClueFlowFilter(filter = "all") {
    captureClueFlowViewport();
    uiStore.set({ clueFlowFilter: ["all", "linked", "incomplete"].includes(filter) ? filter : "all" });
    render();
  }

  export function setClueDetailTab(tab = "detail") {
    captureClueFlowViewport();
    uiStore.set({ clueDetailTab: tab === "triggers" ? "triggers" : "detail" });
    render();
  }

  export function adjustClueFlowZoom(mode = "reset") {
    const scroll = captureClueFlowViewport();
    const current = Number(uiStore.get().clueFlowZoom || 1);
    if (mode === "in") uiStore.set({ clueFlowZoom: Math.min(1.45, Math.round((current + 0.1) * 10) / 10) });
    else if (mode === "out") uiStore.set({ clueFlowZoom: Math.max(0.5, Math.round((current - 0.1) * 10) / 10) });
    else uiStore.set({ clueFlowZoom: 1 });
    render();
    restoreClueFlowViewport(scroll);
  }

  export function fitClueFlow() {
    const viewport = document.querySelector("[data-clue-flow-viewport]");
    const canvas = viewport?.querySelector(".clue-flow-canvas");
    if (!viewport || !canvas) return;
    const width = Number(canvas.dataset.canvasWidth) || canvas.offsetWidth || 1;
    const height = Number(canvas.dataset.canvasHeight) || canvas.offsetHeight || 1;
    const availableWidth = Math.max(1, viewport.clientWidth - 24);
    const availableHeight = Math.max(1, viewport.clientHeight - 24);
    const zoom = Math.max(0.5, Math.min(1, Math.floor(Math.min(availableWidth / width, availableHeight / height) * 10) / 10));
    const scroll = { left: 0, top: 0 };
    uiStore.set({ clueFlowZoom: zoom, clueFlowScroll: scroll });
    render();
    restoreClueFlowViewport(scroll);
  }

  export function focusSelectedClue() {
    const clueId = uiStore.get().cluesSelectedId;
    const viewport = document.querySelector("[data-clue-flow-viewport]");
    if (!clueId || !viewport) return;
    const node = [...viewport.querySelectorAll(".clue-flow-node")].find((item) => item.dataset.clue === clueId);
    if (!node) return;
    const zoom = Number(uiStore.get().clueFlowZoom || 1) || 1;
    const left = Math.max(0, (Number(node.dataset.x) || node.offsetLeft) * zoom - viewport.clientWidth / 2);
    const top = Math.max(0, (Number(node.dataset.y) || node.offsetTop) * zoom - viewport.clientHeight / 2);
    viewport.scrollTo({ left, top, behavior: "smooth" });
    uiStore.set({ clueFlowScroll: { left, top } });
    node.focus({ preventScroll: true });
  }

  async function saveClueGraphPosition(clueId, position) {
    const data = studioStore.get().cloudStudio;
    const clue = data?.clues?.find((item) => item.id === clueId);
    if (!clue || !position) return;
    const metadata = {
      ...(clue.metadata || {}),
      clueGraphPosition: {
        x: Math.max(80, Math.round(Number(position.x) || 80)),
        y: Math.max(70, Math.round(Number(position.y) || 70))
      }
    };
    clue.metadata = metadata;
    try {
      await zhimuApi.updateClue(clue.id, {
        name: clue.name,
        publicText: clue.public_text || "",
        hostText: clue.host_text || "",
        visibility: clue.visibility || "role",
        metadata
      });
    } catch (error) {
      showError(error, "线索位置保存失败，请稍后重试");
    }
  }

  function refreshClueFlowLines(canvas) {
    if (!canvas) return;
    const nodes = new Map(
      [...canvas.querySelectorAll(".clue-flow-node")].map((node) => [node.dataset.clue, node])
    );
    canvas.querySelectorAll(".clue-flow-line[data-from][data-to]").forEach((line) => {
      const from = nodes.get(line.dataset.from);
      const to = nodes.get(line.dataset.to);
      if (!from || !to) return;
      const fromX = Number(from.dataset.x) || from.offsetLeft;
      const fromY = Number(from.dataset.y) || from.offsetTop;
      const toX = Number(to.dataset.x) || to.offsetLeft;
      const toY = Number(to.dataset.y) || to.offsetTop;
      const dx = toX - fromX;
      const dy = toY - fromY;
      line.style.left = `${fromX}px`;
      line.style.top = `${fromY}px`;
      line.style.width = `${Math.sqrt(dx * dx + dy * dy)}px`;
      line.style.transform = `rotate(${Math.atan2(dy, dx) * 180 / Math.PI}deg)`;
    });
  }

export function bindCluesSearch() {
    bindClueFlowPan();
    const input = document.getElementById("clues-search-input");
    if (!input || input.dataset.bound) return;
    input.dataset.bound = "1";
    let timer = null;
    input.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        uiStore.set({ cluesSearchQuery: input.value.trim() });
        render();
        bindCluesSearch();
      }, 280);
    });
  }

  function bindClueFlowPan() {
    const viewport = document.querySelector("[data-clue-flow-viewport]");
    if (!viewport || viewport.dataset.panBound) return;
    viewport.dataset.panBound = "1";
    const savedScroll = uiStore.get().clueFlowScroll;
    if (savedScroll) {
      viewport.scrollLeft = savedScroll.left || 0;
      viewport.scrollTop = savedScroll.top || 0;
    } else if (!viewport.scrollLeft && !viewport.scrollTop) {
      viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2);
      viewport.scrollTop = Math.max(0, (viewport.scrollHeight - viewport.clientHeight) / 2);
    }
    viewport.addEventListener("scroll", () => {
      uiStore.set({ clueFlowScroll: { left: viewport.scrollLeft, top: viewport.scrollTop } });
    }, { passive: true });
    viewport.addEventListener("click", (event) => {
      if (uiStore.get().clueFlowSuppressClick) {
        event.preventDefault();
        event.stopPropagation();
        uiStore.set({ clueFlowSuppressClick: false });
        return;
      }
      const node = event.target.closest(".clue-flow-node");
      if (!node) {
        if (event.target.closest(".clue-flow-canvas") && uiStore.get().cluesSelectedId) closeClueDetail();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      selectClue(node.dataset.clue);
    }, true);
    viewport.addEventListener("pointerdown", (event) => {
      const dragHandle = event.target.closest(".clue-node-drag-handle");
      const node = dragHandle?.closest(".clue-flow-node");
      if (node && dragHandle) {
        event.preventDefault();
        event.stopPropagation();
        const zoom = Number(uiStore.get().clueFlowZoom || 1) || 1;
        const canvas = node.closest(".clue-flow-canvas");
        const canvasWidth = Number(canvas?.dataset.canvasWidth) || 3600;
        const canvasHeight = Number(canvas?.dataset.canvasHeight) || 5000;
        const start = {
          x: event.clientX,
          y: event.clientY,
          left: Number.parseFloat(node.dataset.x || node.style.left) || 0,
          top: Number.parseFloat(node.dataset.y || node.style.top) || 0,
          moved: false
        };
        node.classList.add("dragging");
        node.setPointerCapture?.(event.pointerId);
        const move = (moveEvent) => {
          const dx = (moveEvent.clientX - start.x) / zoom;
          const dy = (moveEvent.clientY - start.y) / zoom;
          if (Math.abs(dx) + Math.abs(dy) > 4) start.moved = true;
          const x = Math.min(canvasWidth - 90, Math.max(90, start.left + dx));
          const y = Math.min(canvasHeight - 46, Math.max(46, start.top + dy));
          node.style.left = `${x}px`;
          node.style.top = `${y}px`;
          node.dataset.x = String(Math.round(x));
          node.dataset.y = String(Math.round(y));
          refreshClueFlowLines(canvas);
        };
        const finish = async () => {
          node.classList.remove("dragging");
          node.releasePointerCapture?.(event.pointerId);
          document.removeEventListener("pointermove", move);
          document.removeEventListener("pointerup", finish);
          document.removeEventListener("pointercancel", finish);
          if (!start.moved) {
            selectClue(node.dataset.clue);
            return;
          }
          uiStore.set({ clueFlowSuppressClick: true });
          const scroll = captureClueFlowViewport();
          await saveClueGraphPosition(node.dataset.clue, {
            x: Number.parseFloat(node.dataset.x || node.style.left),
            y: Number.parseFloat(node.dataset.y || node.style.top)
          });
          render();
          restoreClueFlowViewport(scroll);
          setTimeout(() => {
            uiStore.set({ clueFlowSuppressClick: false });
          }, 180);
        };
        document.addEventListener("pointermove", move);
        document.addEventListener("pointerup", finish, { once: true });
        document.addEventListener("pointercancel", finish, { once: true });
        return;
      }
      if (event.target.closest(".clue-flow-node")) return;
      if (event.target.closest("button")) return;
      event.preventDefault();
      viewport.classList.add("panning");
      const start = {
        x: event.clientX,
        y: event.clientY,
        left: viewport.scrollLeft,
        top: viewport.scrollTop,
        moved: false
      };
      const move = (moveEvent) => {
        if (Math.abs(moveEvent.clientX - start.x) + Math.abs(moveEvent.clientY - start.y) > 4) start.moved = true;
        viewport.scrollLeft = start.left - (moveEvent.clientX - start.x);
        viewport.scrollTop = start.top - (moveEvent.clientY - start.y);
      };
      const finish = () => {
        viewport.classList.remove("panning");
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", finish);
        document.removeEventListener("pointercancel", finish);
        if (start.moved) {
          uiStore.set({ clueFlowSuppressClick: true });
          setTimeout(() => uiStore.set({ clueFlowSuppressClick: false }), 180);
        }
      };
      document.addEventListener("pointermove", move);
      document.addEventListener("pointerup", finish, { once: true });
      document.addEventListener("pointercancel", finish, { once: true });
    });
  }
