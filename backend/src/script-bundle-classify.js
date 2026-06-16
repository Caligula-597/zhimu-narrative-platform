import path from "node:path";

const ROLE_FOLDER = /(?:^|\/)(?:人物剧本|玩家剧本|角色剧本|角色本|私人剧本)(?:\/|$)/i;
const CLUE_FOLDER = /(?:^|\/)(?:调查线索|线索卡|线索|证据)(?:\/|$)/i;
const ASSET_FOLDER = /(?:^|\/)(?:游戏及人物封面|人物行动卡|封面|素材|附件|道具)(?:\/|$)/i;
const HOST_FOLDER = /(?:^|\/)(?:组织者|主持人|dm|复盘)(?:\/|$)/i;

const HOST_FILE = /(?:组织者|主持人|手册|复盘|真相|dm|主持流程)/i;
const PUBLIC_FILE = /(?:公共|先导|收官|序章|背景|序幕)/i;
const PROFILE_FILE = /(?:人物简介|角色简介|简介|角色介绍)/i;
const PLAYER_COUNT = /(\d+)\s*人/;

export function normalizeBundlePath(entryPath) {
  return String(entryPath ?? "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .trim();
}

export function isSkippedBundlePath(relativePath) {
  const norm = normalizeBundlePath(relativePath).toLowerCase();
  if (!norm || norm.endsWith("/")) return true;
  const parts = norm.split("/");
  if (parts.some((part) => part === "__macosx")) return true;
  if (parts.some((part) => part === ".ds_store" || part.startsWith("._"))) return true;
  return false;
}

export function parseBundleTitleHints(rootFolderName) {
  const raw = String(rootFolderName ?? "").trim();
  if (!raw) return { worldName: null, playerCount: null };
  const playerMatch = raw.match(PLAYER_COUNT);
  const playerCount = playerMatch ? Number(playerMatch[1]) : null;
  let worldName = raw
    .replace(/^\d+\s*[-_—]\s*/, "")
    .replace(/\(\s*\d+\s*人[^)]*\)/gi, "")
    .replace(/\[\s*\d+\s*人[^\]]*\]/gi, "")
    .trim();
  if (!worldName) worldName = raw;
  return { worldName, playerCount };
}

export function classifyBundleEntry(relativePath) {
  const norm = normalizeBundlePath(relativePath);
  if (isSkippedBundlePath(norm)) {
    return { category: "skip", relativePath: norm, label: path.basename(norm) };
  }

  const parts = norm.split("/");
  const filename = parts[parts.length - 1];
  const stem = filename.replace(/\.[^.]+$/i, "");
  const ext = path.extname(filename).toLowerCase();
  const parentPath = parts.slice(0, -1).join("/");
  const fullLower = norm.toLowerCase();

  const base = {
    relativePath: norm,
    filename,
    extension: ext,
    label: stem,
    confidence: "high"
  };

  if (ROLE_FOLDER.test(`/${parentPath}/`) || ROLE_FOLDER.test(`/${fullLower}/`)) {
    const roleName = stem.replace(/(剧本|角色本|私人本)$/i, "").trim() || stem;
    return { ...base, category: "role_script", roleName };
  }

  if (CLUE_FOLDER.test(`/${parentPath}/`) || CLUE_FOLDER.test(`/${fullLower}/`)) {
    return { ...base, category: "clue", clueName: stem };
  }

  if (ASSET_FOLDER.test(`/${parentPath}/`) || ASSET_FOLDER.test(`/${fullLower}/`)) {
    return { ...base, category: "asset", assetName: stem };
  }

  if (HOST_FOLDER.test(`/${parentPath}/`) || HOST_FILE.test(stem)) {
    return { ...base, category: "host_manual", title: stem };
  }

  if (PUBLIC_FILE.test(stem)) {
    return { ...base, category: "public_script", title: stem };
  }

  if (PROFILE_FILE.test(stem)) {
    return { ...base, category: "role_profile", title: stem };
  }

  if ([".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)) {
    if (/线索|证据|卡/.test(stem) || CLUE_FOLDER.test(`/${parentPath}/`)) {
      return { ...base, category: "clue", clueName: stem, confidence: "medium" };
    }
    return { ...base, category: "asset", assetName: stem, confidence: "medium" };
  }

  if ([".pdf", ".docx", ".txt", ".md", ".markdown"].includes(ext)) {
    if (parts.length <= 2 && /^[\u4e00-\u9fa5A-Za-z0-9·]{2,16}$/.test(stem)) {
      return { ...base, category: "role_script", roleName: stem, confidence: "low" };
    }
    return { ...base, category: "unknown", title: stem, confidence: "low" };
  }

  return { ...base, category: "skip" };
}

export function summarizeBundleInventory(items) {
  const counts = {
    role_script: 0,
    clue: 0,
    host_manual: 0,
    public_script: 0,
    role_profile: 0,
    asset: 0,
    unknown: 0,
    skip: 0
  };
  for (const item of items) counts[item.category] = (counts[item.category] ?? 0) + 1;
  const roleNames = [...new Set(items.filter((i) => i.category === "role_script").map((i) => i.roleName))];
  return { counts, roleNames, totalFiles: items.filter((i) => i.category !== "skip").length };
}

export function matchRoleSlotByName(roleSlots, roleName) {
  const target = normalizeRoleLabel(roleName);
  if (!target) return null;
  const exact = roleSlots.find((role) => normalizeRoleLabel(role.name) === target);
  if (exact) return exact;
  return (
    roleSlots.find((role) => normalizeRoleLabel(role.name).includes(target) || target.includes(normalizeRoleLabel(role.name))) ??
    null
  );
}

export function normalizeRoleLabel(value) {
  return String(value ?? "")
    .replace(/\.[^.]+$/i, "")
    .replace(/(剧本|角色本|私人本|的角色本)$/i, "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}
