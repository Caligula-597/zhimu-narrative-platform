export const SHARED_INFRASTRUCTURE_VIEW_MODULES = Object.freeze({
  rooms: [() => import("../../views/rooms.js")],
  account: [
    () => import("../../views/account.css"),
    () => import("../../views/assets.js"),
    () => import("../../views/account.js"),
    () => import("../../views/account-hub.js"),
    () => import("../../runtime/actions-assets.js")
  ],
  ops: [
    () => import("../../views/ops.css"),
    () => import("../../views/ops.js"),
    () => import("../../runtime/actions-ops.js")
  ]
});
