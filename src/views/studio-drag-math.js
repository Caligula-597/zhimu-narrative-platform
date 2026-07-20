/** Pure pointer math shared by the Studio graph drag and pan interactions. */
export function studioDragPosition(start, clientX, clientY, scale = 1) {
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  return {
    x: start.left + (clientX - start.x) / safeScale,
    y: start.top + (clientY - start.y) / safeScale
  };
}

export function studioDragMoved(start, clientX, clientY, threshold = 4) {
  return Math.abs(clientX - start.x) + Math.abs(clientY - start.y) > threshold;
}
