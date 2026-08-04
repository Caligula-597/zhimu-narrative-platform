const PATCH_OPERATIONS = new Set(["add", "replace", "remove"]);
const UNSAFE_POINTER_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);
const ARRAY_INDEX = /^(?:0|[1-9]\d*)$/u;
const INVALID_POINTER_ESCAPE = /~(?:[^01]|$)/u;
const MAX_PATCHES = 30;

function decodePointerSegment(segment, pathValue) {
  if (INVALID_POINTER_ESCAPE.test(segment)) {
    throw new Error(`Invalid outline patch pointer escape: ${pathValue}`);
  }
  return segment.replace(/~1/gu, "/").replace(/~0/gu, "~");
}

function parseArrayIndex(segment, pathValue, { allowAppend = false } = {}) {
  if (allowAppend && segment === "-") return "append";
  if (!ARRAY_INDEX.test(segment)) {
    throw new Error(`Invalid outline patch array index: ${pathValue}`);
  }
  const index = Number(segment);
  if (!Number.isSafeInteger(index)) {
    throw new Error(`Invalid outline patch array index: ${pathValue}`);
  }
  return index;
}

export function applyJsonPointerPatches(source, rawPatches) {
  const patches = Array.isArray(rawPatches) ? rawPatches : [];
  if (!patches.length) throw new Error("Outline patch response did not include patches");
  if (patches.length > MAX_PATCHES) {
    throw new Error(`Outline patch response exceeded ${MAX_PATCHES} operations`);
  }

  const target = structuredClone(source);
  for (const patch of patches) {
    const operation = String(patch?.op || "");
    const pathValue = String(patch?.path || "");
    if (!PATCH_OPERATIONS.has(operation) || !pathValue.startsWith("/")) {
      throw new Error(`Invalid outline patch operation: ${operation} ${pathValue}`);
    }
    const segments = pathValue
      .slice(1)
      .split("/")
      .map((segment) => decodePointerSegment(segment, pathValue));
    if (segments.some((segment) => UNSAFE_POINTER_SEGMENTS.has(segment))) {
      throw new Error(`Unsafe outline patch path: ${pathValue}`);
    }

    let parent = target;
    for (const segment of segments.slice(0, -1)) {
      const key = Array.isArray(parent)
        ? parseArrayIndex(segment, pathValue)
        : segment;
      if (parent?.[key] === undefined || parent?.[key] === null || typeof parent[key] !== "object") {
        throw new Error(`Outline patch path does not exist: ${pathValue}`);
      }
      parent = parent[key];
    }

    const finalSegment = segments.at(-1);
    if (Array.isArray(parent)) {
      const parsedIndex = parseArrayIndex(finalSegment, pathValue, { allowAppend: operation === "add" });
      const index = parsedIndex === "append" ? parent.length : parsedIndex;
      if (operation === "add") {
        if (index > parent.length) throw new Error(`Invalid outline patch array index: ${pathValue}`);
        parent.splice(index, 0, structuredClone(patch.value));
      } else if (operation === "replace") {
        if (index >= parent.length) throw new Error(`Outline patch replace target does not exist: ${pathValue}`);
        parent[index] = structuredClone(patch.value);
      } else {
        if (index >= parent.length) throw new Error(`Outline patch remove target does not exist: ${pathValue}`);
        parent.splice(index, 1);
      }
      continue;
    }

    if (!parent || typeof parent !== "object") {
      throw new Error(`Outline patch parent is not an object: ${pathValue}`);
    }
    if (operation === "remove") {
      if (!Object.prototype.hasOwnProperty.call(parent, finalSegment)) {
        throw new Error(`Outline patch remove target does not exist: ${pathValue}`);
      }
      delete parent[finalSegment];
    } else {
      if (operation === "replace" && !Object.prototype.hasOwnProperty.call(parent, finalSegment)) {
        throw new Error(`Outline patch replace target does not exist: ${pathValue}`);
      }
      parent[finalSegment] = structuredClone(patch.value);
    }
  }
  return target;
}
