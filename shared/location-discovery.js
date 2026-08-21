export const DEFAULT_LOCATION_DISCOVERY_COPY = Object.freeze({
  scanLabel: "正在侦测现场痕迹",
  scanHint: "环形侦测将在片刻后完成",
  unlockLabel: "地点已解锁",
  collectionLabel: "现场线索",
  countTemplate: "{count} 条可发现线索",
  archiveLabel: "LOCATION EVIDENCE",
});

function cleanText(value, fallback, max) {
  const text = String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
  return text || fallback;
}

export function normalizeLocationDiscoveryCopy(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const countTemplate = cleanText(
    source.countTemplate,
    DEFAULT_LOCATION_DISCOVERY_COPY.countTemplate,
    80,
  );
  return {
    scanLabel: cleanText(source.scanLabel, DEFAULT_LOCATION_DISCOVERY_COPY.scanLabel, 48),
    scanHint: cleanText(source.scanHint, DEFAULT_LOCATION_DISCOVERY_COPY.scanHint, 80),
    unlockLabel: cleanText(source.unlockLabel, DEFAULT_LOCATION_DISCOVERY_COPY.unlockLabel, 48),
    collectionLabel: cleanText(source.collectionLabel, DEFAULT_LOCATION_DISCOVERY_COPY.collectionLabel, 48),
    countTemplate: countTemplate.includes("{count}")
      ? countTemplate
      : DEFAULT_LOCATION_DISCOVERY_COPY.countTemplate,
    archiveLabel: cleanText(source.archiveLabel, DEFAULT_LOCATION_DISCOVERY_COPY.archiveLabel, 48),
  };
}

export function formatLocationDiscoveryCount(value, count) {
  const copy = normalizeLocationDiscoveryCopy(value);
  const safeCount = Math.max(0, Math.round(Number(count) || 0));
  return copy.countTemplate.replaceAll("{count}", String(safeCount));
}
