import { ACTIVE_PRODUCT_MODULES } from "../products/product-registry.js";
import { worldStore } from "../state/index.js";
import { registerView } from "../runtime/view-registry.js";
import { escapeHtml } from "../utils/format.js";

const PRODUCT_FEATURES = Object.freeze({
  murder_mystery: ["角色本与私人信息", "谜底、关系与线索", "AI 试跑、房间与复盘"],
  tabletop_rpg: ["地图、地点与路线", "角色卡、判定与遭遇", "战役状态与主持模拟"],
  board_game: ["棋盘、卡牌与组件", "阶段、资源与响应规则", "可执行 Demo 与 AI 对局测试"]
});

function productWorldCount(key) {
  return (worldStore.get().cloudWorlds || []).filter((world) => world.creation_type === key
    || world.creationType === key
    || world.settings?.narrativeProfile?.creationType === key
    || world.settings?.creationType === key).length;
}

function productCard(product) {
  const domain = product.domain;
  const features = PRODUCT_FEATURES[domain.key] || [];
  const count = productWorldCount(domain.key);
  return `<article class="product-hub-card product-hub-card-${escapeHtml(domain.key)}">
    <div class="product-hub-card-top"><span class="product-hub-icon">${escapeHtml(domain.icon)}</span><span class="product-hub-count">${count ? `${count} 个项目` : "尚无项目"}</span></div>
    <p class="section-kicker">${escapeHtml(domain.label.toUpperCase())}</p>
    <h2>${escapeHtml(domain.label)}</h2>
    <p class="product-hub-description">${escapeHtml(domain.description)}</p>
    <ul>${features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join("")}</ul>
    <div class="product-hub-card-actions"><button type="button" class="primary-btn" data-action="product-create" data-product-type="${escapeHtml(domain.key)}">创建${escapeHtml(domain.label)}项目</button><button type="button" class="text-btn" data-action="world-library" data-product-type="${escapeHtml(domain.key)}">选择已有项目</button></div>
  </article>`;
}

export function productHub() {
  return `<section class="product-hub">
    <header class="product-hub-hero">
      <div><p class="eyebrow">ZHIMU CREATOR PLATFORM</p><h2>选择你的创作模块</h2><p>剧本杀、跑团、桌游是三个并列产品。每个模块拥有独立的内容结构、规则引擎、AI 角色和运行方式；项目之间不会混用工具或数据。</p></div>
      <div class="product-hub-hero-actions"><button type="button" class="secondary-btn" data-action="world-library">打开已有项目</button><button type="button" class="primary-btn" data-action="open-wizard">创建新项目</button></div>
    </header>
    <div class="product-hub-grid" aria-label="三个创作模块">${ACTIVE_PRODUCT_MODULES.map(productCard).join("")}</div>
    <section class="product-hub-contract card"><div><p class="section-kicker">PRODUCT CONTRACT</p><h3>三个模块，共享平台底座</h3><p>账号、项目、素材、权限、协作、运行房和数据同步由平台统一提供；具体的角色、牌堆、判定、线索、地图与胜负规则由对应模块独立负责。</p></div><div class="product-hub-contract-grid"><span><strong>01</strong>产品独立</span><span><strong>02</strong>机制独立</span><span><strong>03</strong>运行互通</span></div></section>
  </section>`;
}

registerView("productHub", { productHub });
