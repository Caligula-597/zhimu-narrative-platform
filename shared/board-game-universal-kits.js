// 桌游通用套件目录。这里放跨作品复用的规则骨架，不放任何商业作品的专属内容。

export const BOARD_GAME_UNIVERSAL_KITS = Object.freeze([
  { id: "grid-geometry", label: "六角/方格几何套件", reusableFor: ["Carcassonne", "Azul", "Cascadia", "Patchwork"], status: "runtime" },
  { id: "sealed-auction", label: "并发密封竞价套件", reusableFor: ["Power Grid", "Modern Art", "For Sale"], status: "runtime" },
  { id: "nested-response", label: "多层响应窗口套件", reusableFor: ["Root", "Magic-like card timing", "cooperative crisis games"], status: "runtime" },
  { id: "faction-plugin", label: "派系插件套件", reusableFor: ["Root", "Scythe", "Eclipse"], status: "runtime" }
]);

const GRID_DIRECTIONS = Object.freeze({
  square: [
    { side: "north", oppositeSide: "south", dx: 0, dy: -1 },
    { side: "east", oppositeSide: "west", dx: 1, dy: 0 },
    { side: "south", oppositeSide: "north", dx: 0, dy: 1 },
    { side: "west", oppositeSide: "east", dx: -1, dy: 0 }
  ],
  hex: [
    { side: "north-east", oppositeSide: "south-west", dx: 1, dy: -1 },
    { side: "east", oppositeSide: "west", dx: 1, dy: 0 },
    { side: "south-east", oppositeSide: "north-west", dx: 0, dy: 1 },
    { side: "south-west", oppositeSide: "north-east", dx: -1, dy: 1 },
    { side: "west", oppositeSide: "east", dx: -1, dy: 0 },
    { side: "north-west", oppositeSide: "south-east", dx: 0, dy: -1 }
  ]
});

export function gridDirections(kind = "square") {
  return GRID_DIRECTIONS[kind === "hex" ? "hex" : "square"].map((direction) => ({ ...direction }));
}

export function deriveBoardGameGridNeighbors(nodes = [], placements = {}, targetId = "", kind = "square") {
  const target = (Array.isArray(nodes) ? nodes : []).find((node) => node.id === targetId);
  if (!target || !Number.isInteger(target.gridX) || !Number.isInteger(target.gridY)) return [];
  const byCoordinate = new Map((Array.isArray(nodes) ? nodes : []).filter((node) => Number.isInteger(node.gridX) && Number.isInteger(node.gridY)).map((node) => [`${node.gridX}:${node.gridY}`, node]));
  return gridDirections(kind).flatMap((direction) => {
    const neighbor = byCoordinate.get(`${target.gridX + direction.dx}:${target.gridY + direction.dy}`);
    if (!neighbor || !placements[neighbor.id]) return [];
    return [{ id: neighbor.id, side: direction.side, oppositeSide: direction.oppositeSide }];
  });
}

export function universalKitStatus() {
  return BOARD_GAME_UNIVERSAL_KITS.map((kit) => ({ ...kit }));
}
