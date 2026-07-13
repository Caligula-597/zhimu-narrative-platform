import * as zhimuApi from "../api/index.js";
import { showToast } from "../components/toast.js";
import { render } from "../runtime/runtime-facade.js";
import { worldStore } from "../state/index.js";
import * as F from "../utils/format.js";
import * as S from "../components/ui-semantics.js";

const escapeHtml = F.escapeHtml || ((value = "") => String(value));
const showError = S.showError;

/** 加载线索命中率聚合数据（A3）— 镜像 runCreatorChecks 的加载模式 */
  export async function loadClueHitRate() {
    const roomId = zhimuApi.context.roomId || null;
    try {
      const data = await zhimuApi.getClueHitRate(roomId ? { roomId } : {});
      worldStore.set({ cloudClueHitRate: data });
      render();
      showToast("线索命中率已刷新");
    } catch (error) {
      showError(error);
    }
  }

  export function renderClueHitRatePanel() {
    const { cloudClueHitRate: data } = worldStore.get();
    if (!data) {
      return `<section class="clue-hit-rate-panel">
        <div class="section-head">
          <div><p class="section-kicker">CLUE HIT RATE</p><h3>线索命中率</h3><p>统计每条线索在运行房中的获得、已读与分享情况，定位未触发的线索。</p></div>
          <button class="secondary-btn" data-action="load-clue-hit-rate">加载命中率</button>
        </div>
        <div class="empty-state">点击「加载命中率」从云端拉取当前世界/运行房的线索命中统计。</div>
      </section>`;
    }
    const scopeLabel = data.scope === "room" ? "当前运行房" : `全世界 · ${data.totalRooms} 个运行房`;
    const insights = data.insights || {};
    const neverHit = insights.neverHit || [];
    const lowRead = insights.lowRead || [];
    const highShare = insights.highShare || [];
    const insightBlock = (items, label, tone) => items.length
      ? `<div class="hit-rate-insight ${tone}">
          <p class="section-kicker">${escapeHtml(label)} · ${items.length} 条</p>
          <ul>${items.map((item) => `<li><b>${escapeHtml(item.name)}</b><span>${escapeHtml(item.detail || "")}</span></li>`).join("")}</ul>
        </div>`
      : "";
    const insightsHtml = neverHit.length || lowRead.length || highShare.length
      ? `<div class="hit-rate-insights">${insightBlock(neverHit, "未被获得", "risk-error")}${insightBlock(lowRead, "已读率低", "risk-warning")}${insightBlock(highShare, "过度公开", "risk-warning")}</div>`
      : "";
    const clueRows = (data.clues || []).length
      ? data.clues
          .slice()
          .sort((a, b) => (b.hitRate || 0) - (a.hitRate || 0))
          .map((clue) => {
            const pct = clue.hitRate || 0;
            const tone = pct >= 80 ? "published" : pct >= 40 ? "testing" : "draft";
            return `<div class="hit-rate-row">
              <div class="hit-rate-row-head"><strong>${escapeHtml(clue.name)}</strong><span class="status-chip ${tone}">${pct}%</span></div>
              <div class="hit-rate-row-meta"><span>${escapeHtml(clue.label || "")}</span>${clue.detail ? `<span class="muted-note">${escapeHtml(clue.detail)}</span>` : ""}</div>
              <div class="progress"><i style="width:${pct}%"></i></div>
            </div>`;
          })
          .join("")
      : `<div class="empty-state">暂无线索数据。先在编排台创建线索并让玩家进入运行房调查。</div>`;
    return `<section class="clue-hit-rate-panel">
      <div class="section-head">
        <div><p class="section-kicker">CLUE HIT RATE</p><h3>线索命中率</h3><p>统计每条线索在运行房中的获得、已读与分享情况，定位未触发的线索。</p></div>
        <div class="row">
          <span class="status-chip ${data.averageHitRate >= 80 ? "published" : data.averageHitRate >= 40 ? "testing" : "draft"}">${scopeLabel} · 平均 ${data.averageHitRate}%</span>
          <button class="secondary-btn" data-action="load-clue-hit-rate">刷新</button>
        </div>
      </div>
      <div class="hit-rate-summary">${escapeHtml(data.summary?.label || "")}</div>
      ${insightsHtml}
      <details class="hit-rate-clue-list" open>
        <summary>线索明细 · ${data.totalClues || 0} 条</summary>
        <div class="hit-rate-clue-rows">${clueRows}</div>
      </details>
    </section>`;
  }
