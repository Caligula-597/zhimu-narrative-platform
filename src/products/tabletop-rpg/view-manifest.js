export const TABLETOP_RPG_VIEW_MODULES = Object.freeze({
  tabletopMap: [
    () => import("../../views/tabletop-map.js"),
    () => import("../../runtime/actions-tabletop-map.js")
  ]
});
