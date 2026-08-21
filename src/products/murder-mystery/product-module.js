import { MURDER_MYSTERY_DOMAIN } from "../../../shared/product-domains/murder-mystery.js";
import { MURDER_MYSTERY_VIEW_MODULES } from "./view-manifest.js";

function summarizeWorld({ workspace }) {
  const chapterCount = workspace?.chapters?.length;
  return typeof chapterCount === "number"
    ? `${MURDER_MYSTERY_DOMAIN.label}创作 · ${chapterCount} 个${MURDER_MYSTERY_DOMAIN.terminology.act}`
    : `${MURDER_MYSTERY_DOMAIN.label}创作 · 正在同步内容`;
}

function libraryHint({ count, canManage }) {
  if (canManage) return typeof count === "number" ? `${count} 个运行空间` : "运行空间暂时无法读取";
  return count ? `我的运行空间 · ${count}` : "尚未建立运行空间";
}

export const MURDER_MYSTERY_PRODUCT_MODULE = Object.freeze({
  domain: MURDER_MYSTERY_DOMAIN,
  viewModules: MURDER_MYSTERY_VIEW_MODULES,
  shell: Object.freeze({
    brandSubtitle: "MURDER MYSTERY CREATOR",
    authDescription: "登录后可保存剧本杀项目、邀请协作并记录场次数据。",
    showCreatorRuntimeControls: true,
    advancedNavigation: true,
    advancedSharedScopeLabel: "剧本杀运行工具",
    summarizeWorld
  }),
  library: Object.freeze({
    catalogAvailable: true,
    catalogLabel: "公开剧本杀作品库",
    loadRoomCounts: true,
    hint: libraryHint
  }),
  runtime: Object.freeze({
    label: "▶ 打开剧本杀主持端",
    activate({ browserWindow }) {
      browserWindow.open(browserWindow.zhimuInviteLinks?.hostConsoleUrl?.(), "_blank", "noopener,noreferrer");
    }
  })
});
