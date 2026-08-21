const MAP_BOARD_URL = new URL("../assets/tabletop-map-board.webp", import.meta.url).href;
const boundCanvases = new WeakMap();
let activeCanvasBinding = null;

const boardImages = new Map();

function boardSource(design) {
  if (design?.canvas?.mode === "blank") return "";
  if (design?.canvas?.mode === "custom" && design.canvas.dataUrl) return design.canvas.dataUrl;
  return MAP_BOARD_URL;
}

function ensureBoardImage(design, onReady) {
  const source = boardSource(design);
  if (!source) return null;
  let image = boardImages.get(source);
  if (!image) {
    image = new Image();
    image.decoding = "async";
    image.src = source;
    boardImages.set(source, image);
  }
  if (!image.complete || !image.naturalWidth) image.addEventListener("load", onReady, { once: true });
  return image;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function rotatePoint(x, y, quarterTurns) {
  const rotation = ((quarterTurns % 4) + 4) % 4;
  if (rotation === 1) return { x: -y, y: x };
  if (rotation === 2) return { x: -x, y: -y };
  if (rotation === 3) return { x: y, y: -x };
  return { x, y };
}

function inverseRotatePoint(x, y, quarterTurns) {
  return rotatePoint(x, y, 4 - (((quarterTurns % 4) + 4) % 4));
}

function boardGeometry(canvas, image, view, design) {
  const width = canvas.width;
  const height = canvas.height;
  const rotation = ((view.rotation % 4) + 4) % 4;
  const imageWidth = image?.naturalWidth || design?.canvas?.width || 1600;
  const imageHeight = image?.naturalHeight || design?.canvas?.height || 1067;
  const rotatedWidth = rotation % 2 ? imageHeight : imageWidth;
  const rotatedHeight = rotation % 2 ? imageWidth : imageHeight;
  const paddingX = Math.max(28, width * 0.035);
  const paddingY = Math.max(40, height * 0.06);
  const scale = Math.min(
    (width - paddingX * 2) / rotatedWidth,
    (height - paddingY * 2) / rotatedHeight
  ) * clamp(view.zoom, 0.6, 2);
  return {
    centerX: width / 2 + clamp(view.panX, -0.25, 0.25) * width,
    centerY: height / 2 + height * 0.025 + clamp(view.panY, -0.25, 0.25) * height,
    imageWidth,
    imageHeight,
    rotation,
    scale
  };
}

function panLimit(zoom) {
  return Math.min(0.25, Math.max(0, (clamp(zoom, 1, 2) - 1) / clamp(zoom, 1, 2) / 2));
}

function projectLocation(location, geometry, view) {
  const localX = (clamp(location.x, 0, 1) - 0.5) * geometry.imageWidth * geometry.scale;
  const localY = (clamp(location.y, 0, 1) - 0.5) * geometry.imageHeight * geometry.scale;
  const rotated = rotatePoint(localX, localY, geometry.rotation);
  const lift = clamp(location.z, 0, 5) * 5.5 * clamp(view.height, 0.7, 1.35);
  return {
    x: geometry.centerX + rotated.x,
    y: geometry.centerY + rotated.y - lift
  };
}

function unprojectPointer(x, y, geometry, location, view) {
  const lift = clamp(location?.z, 0, 5) * 5.5 * clamp(view.height, 0.7, 1.35);
  const local = inverseRotatePoint(
    x - geometry.centerX,
    y + lift - geometry.centerY,
    geometry.rotation
  );
  return {
    x: clamp(local.x / (geometry.imageWidth * geometry.scale) + 0.5, 0.04, 0.96),
    y: clamp(local.y / (geometry.imageHeight * geometry.scale) + 0.5, 0.05, 0.95)
  };
}

function drawGrid(context, geometry, gridType = "square", density = 8) {
  if (gridType === "none") return;
  const boardWidth = geometry.imageWidth * geometry.scale;
  const boardHeight = geometry.imageHeight * geometry.scale;
  context.save();
  context.translate(geometry.centerX, geometry.centerY);
  context.rotate(geometry.rotation * Math.PI / 2);
  roundedRect(context, -boardWidth / 2, -boardHeight / 2, boardWidth, boardHeight, 12);
  context.clip();
  context.strokeStyle = "rgba(24, 63, 58, .1)";
  context.lineWidth = Math.max(1, geometry.scale * 1.4);
  if (gridType === "hex") {
    const radius = boardWidth / Math.max(4, density) / 1.75;
    const cellWidth = Math.sqrt(3) * radius;
    const rowHeight = radius * 1.5;
    for (let row = -1; row <= Math.ceil(boardHeight / rowHeight) + 1; row += 1) {
      for (let column = -1; column <= Math.ceil(boardWidth / cellWidth) + 1; column += 1) {
        const centerX = -boardWidth / 2 + column * cellWidth + (row % 2 ? cellWidth / 2 : 0);
        const centerY = -boardHeight / 2 + row * rowHeight;
        context.beginPath();
        for (let side = 0; side < 6; side += 1) {
          const angle = (Math.PI / 180) * (60 * side - 30);
          const x = centerX + radius * Math.cos(angle);
          const y = centerY + radius * Math.sin(angle);
          if (side === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.closePath();
        context.stroke();
      }
    }
  } else {
    const columns = Math.max(4, density);
    const rows = Math.max(3, Math.round(columns * boardHeight / boardWidth));
    const stepX = boardWidth / columns;
    const stepY = boardHeight / rows;
    for (let index = 0; index <= columns; index += 1) {
      context.beginPath();
      context.moveTo(-boardWidth / 2 + index * stepX, -boardHeight / 2);
      context.lineTo(-boardWidth / 2 + index * stepX, boardHeight / 2);
      context.stroke();
    }
    for (let index = 0; index <= rows; index += 1) {
      context.beginPath();
      context.moveTo(-boardWidth / 2, -boardHeight / 2 + index * stepY);
      context.lineTo(boardWidth / 2, -boardHeight / 2 + index * stepY);
      context.stroke();
    }
  }
  context.restore();
}

function drawBoard(context, image, geometry, view, design) {
  const scaledWidth = geometry.imageWidth * geometry.scale;
  const scaledHeight = geometry.imageHeight * geometry.scale;
  context.save();
  context.translate(geometry.centerX, geometry.centerY);
  context.rotate(geometry.rotation * Math.PI / 2);
  context.shadowColor = "rgba(20, 35, 33, .18)";
  context.shadowBlur = Math.max(18, 34 * geometry.scale);
  context.shadowOffsetY = Math.max(8, 14 * geometry.scale);
  if (image?.complete && image.naturalWidth) {
    context.drawImage(image, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
  } else {
    context.fillStyle = design?.canvas?.mode === "blank" ? "#f5efe2" : "#eee7d8";
    roundedRect(context, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight, 20);
    context.fill();
    context.strokeStyle = "rgba(24, 63, 58, .12)";
    context.lineWidth = 1;
    context.stroke();
  }
  context.restore();
  if (view.grid || design?.canvas?.mode === "blank") {
    drawGrid(context, geometry, design?.canvas?.gridType, design?.canvas?.gridDensity);
  }
}

function drawRoute(context, from, to, routeMode) {
  const middleX = (from.x + to.x) / 2;
  const middleY = Math.min(from.y, to.y) - 16;
  context.save();
  context.beginPath();
  context.moveTo(from.x, from.y);
  context.quadraticCurveTo(middleX, middleY, to.x, to.y);
  context.lineCap = "round";
  context.strokeStyle = routeMode ? "rgba(214, 156, 61, .25)" : "rgba(255, 249, 221, .82)";
  context.lineWidth = 10;
  context.shadowColor = "rgba(215, 157, 55, .75)";
  context.shadowBlur = 16;
  context.stroke();
  context.shadowBlur = 0;
  context.strokeStyle = routeMode ? "#d59b3c" : "#fff7cf";
  context.lineWidth = 3;
  context.stroke();
  context.restore();
}

function drawNode(context, point, location, index, selected, routeStart, view) {
  const radius = selected ? 15 : 12;
  const lift = clamp(location.z, 0, 5) * 5.5 * clamp(view.height, 0.7, 1.35);
  context.save();
  if (lift > 0) {
    context.beginPath();
    context.moveTo(point.x, point.y + radius);
    context.lineTo(point.x, point.y + radius + Math.min(22, lift * 0.7));
    context.strokeStyle = "rgba(18, 63, 57, .55)";
    context.lineWidth = 3;
    context.stroke();
  }
  context.beginPath();
  context.arc(point.x, point.y, radius + 5, 0, Math.PI * 2);
  context.fillStyle = selected ? "rgba(227, 183, 102, .25)" : "rgba(255,255,255,.8)";
  context.fill();
  context.beginPath();
  context.arc(point.x, point.y, radius, 0, Math.PI * 2);
  context.fillStyle = routeStart ? "#d59b3c" : selected ? "#173f39" : "#226259";
  context.shadowColor = "rgba(15, 48, 45, .32)";
  context.shadowBlur = 8;
  context.fill();
  context.shadowBlur = 0;
  context.strokeStyle = "#fffdf8";
  context.lineWidth = 2;
  context.stroke();
  context.fillStyle = "#fff";
  context.font = `700 ${selected ? 12 : 10}px Inter, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(index + 1), point.x, point.y + 0.5);

  const label = String(location.name || `地点 ${index + 1}`);
  context.font = `${selected ? 700 : 650} ${selected ? 13 : 11}px Inter, sans-serif`;
  const labelWidth = Math.min(146, context.measureText(label).width + 20);
  const labelX = point.x + radius + 8;
  const labelY = point.y - 15;
  roundedRect(context, labelX, labelY, labelWidth, 29, 7);
  context.fillStyle = selected ? "rgba(23, 63, 57, .96)" : "rgba(255, 253, 248, .94)";
  context.shadowColor = "rgba(20, 35, 33, .15)";
  context.shadowBlur = 8;
  context.fill();
  context.shadowBlur = 0;
  context.strokeStyle = selected ? "rgba(23, 63, 57, .9)" : "rgba(20, 35, 33, .16)";
  context.lineWidth = 1;
  context.stroke();
  context.fillStyle = selected ? "#fffdf8" : "#173f39";
  context.textAlign = "left";
  context.fillText(label, labelX + 10, labelY + 15);
  context.restore();
}

function renderCanvas(canvas, state) {
  const bounds = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(480, Math.round(bounds.width));
  const height = Math.max(420, Math.round(bounds.height));
  const pixelWidth = Math.round(width * dpr);
  const pixelHeight = Math.round(height * dpr);
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth;
    canvas.height = pixelHeight;
  }
  const context = canvas.getContext("2d");
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#f8f4ea";
  context.fillRect(0, 0, width, height);
  const image = ensureBoardImage(state.design, () => renderCanvas(canvas, state));
  const geometry = boardGeometry({ width, height }, image, state.view, state.design);
  state.geometry = geometry;
  drawBoard(context, image, geometry, state.view, state.design);

  const points = new Map();
  state.design.locations.forEach((location) => {
    points.set(location.id, projectLocation(location, geometry, state.view));
  });
  state.design.routes.forEach(([fromId, toId]) => {
    const from = points.get(fromId);
    const to = points.get(toId);
    if (from && to) drawRoute(context, from, to, state.routeMode);
  });
  state.design.locations.forEach((location, index) => {
    const point = points.get(location.id);
    if (!point) return;
    drawNode(
      context,
      point,
      location,
      index,
      location.id === state.selectedId,
      location.id === state.routeStartId,
      state.view
    );
  });
  state.points = points;
}

function localPointer(event, canvas) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: event.clientX - bounds.left,
    y: event.clientY - bounds.top
  };
}

function hitLocation(state, point) {
  let match = null;
  let distance = Infinity;
  state.points?.forEach((candidate, id) => {
    const current = Math.hypot(candidate.x - point.x, candidate.y - point.y);
    if (current < distance && current <= 34) {
      match = id;
      distance = current;
    }
  });
  return match;
}

export function bindTabletopMapCanvas(canvas, options) {
  if (!canvas) return;
  activeCanvasBinding?.disconnect?.();
  boundCanvases.get(canvas)?.disconnect?.();
  const state = {
    design: options.design,
    selectedId: options.selectedId,
    routeMode: Boolean(options.routeMode),
    routeStartId: options.routeStartId || "",
    view: options.view,
    points: new Map(),
    geometry: null,
    draggingId: "",
    dragStart: null,
    panStart: null,
    didDrag: false
  };
  renderCanvas(canvas, state);
  const observer = new ResizeObserver(() => renderCanvas(canvas, state));
  observer.observe(canvas);

  const onPointerDown = (event) => {
    const pointer = localPointer(event, canvas);
    const id = hitLocation(state, pointer);
    if (!id) {
      if (state.routeMode || Number(state.view.zoom) <= 1) return;
      state.panStart = {
        pointer,
        x: Number(state.view.panX) || 0,
        y: Number(state.view.panY) || 0
      };
      state.didDrag = false;
      canvas.setPointerCapture?.(event.pointerId);
      return;
    }
    state.draggingId = id;
    state.dragStart = pointer;
    state.didDrag = false;
    canvas.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event) => {
    if (state.panStart) {
      const pointer = localPointer(event, canvas);
      const bounds = canvas.getBoundingClientRect();
      const distance = Math.hypot(pointer.x - state.panStart.pointer.x, pointer.y - state.panStart.pointer.y);
      if (!state.didDrag && distance < 6) return;
      state.didDrag = true;
      const limit = panLimit(state.view.zoom);
      state.view.panX = clamp(state.panStart.x + (pointer.x - state.panStart.pointer.x) / Math.max(1, bounds.width), -limit, limit);
      state.view.panY = clamp(state.panStart.y + (pointer.y - state.panStart.pointer.y) / Math.max(1, bounds.height), -limit, limit);
      renderCanvas(canvas, state);
      return;
    }
    if (!state.draggingId || !state.geometry) return;
    const pointer = localPointer(event, canvas);
    if (!state.didDrag && state.dragStart && Math.hypot(pointer.x - state.dragStart.x, pointer.y - state.dragStart.y) < 6) return;
    state.didDrag = true;
    const location = state.design.locations.find((item) => item.id === state.draggingId);
    if (!location) return;
    const next = unprojectPointer(
      pointer.x,
      pointer.y,
      state.geometry,
      location,
      state.view
    );
    location.x = next.x;
    location.y = next.y;
    options.onMove?.(state.draggingId, next, { preview: true });
    renderCanvas(canvas, state);
  };
  const onPointerUp = (event) => {
    if (state.panStart) {
      state.panStart = null;
      canvas.releasePointerCapture?.(event.pointerId);
      if (state.didDrag) options.onPan?.({ x: state.view.panX, y: state.view.panY });
      state.didDrag = false;
      return;
    }
    if (!state.draggingId) return;
    const movedId = state.draggingId;
    state.draggingId = "";
    state.dragStart = null;
    canvas.releasePointerCapture?.(event.pointerId);
    const location = state.design.locations.find((item) => item.id === movedId);
    if (location && state.didDrag) options.onMove?.(movedId, { x: location.x, y: location.y }, { preview: false });
    if (!state.didDrag) options.onSelect?.(movedId);
    state.didDrag = false;
  };
  const onWheel = (event) => {
    if (!options.onZoom || !Number.isFinite(event.deltaY) || event.deltaY === 0) return;
    event.preventDefault();
    options.onZoom(event.deltaY < 0 ? "zoom-in" : "zoom-out");
  };
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });

  const binding = {
    disconnect() {
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
    }
  };
  boundCanvases.set(canvas, binding);
  activeCanvasBinding = binding;
}

export { MAP_BOARD_URL };
