import path from "node:path";

export const allowedContentTypes = new Map([
  ["image/jpeg", { kind: "image", maxBytes: 10 * 1024 * 1024 }],
  ["image/png", { kind: "image", maxBytes: 10 * 1024 * 1024 }],
  ["image/webp", { kind: "image", maxBytes: 10 * 1024 * 1024 }],
  ["audio/mpeg", { kind: "audio", maxBytes: 30 * 1024 * 1024 }],
  ["audio/ogg", { kind: "audio", maxBytes: 30 * 1024 * 1024 }],
  ["audio/wav", { kind: "audio", maxBytes: 30 * 1024 * 1024 }],
  ["application/pdf", { kind: "document", maxBytes: 20 * 1024 * 1024 }],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", { kind: "document", maxBytes: 20 * 1024 * 1024 }]
]);

/** Executable, script, archive, and markup extensions blocked regardless of Content-Type. */
export const blockedExtensions = new Set([
  ".exe", ".bat", ".cmd", ".com", ".msi", ".scr", ".ps1", ".vbs", ".js", ".mjs", ".cjs",
  ".html", ".htm", ".svg", ".php", ".jsp", ".asp", ".aspx", ".jar", ".zip", ".rar", ".7z",
  ".dll", ".so", ".dylib", ".app", ".deb", ".rpm"
]);

export function validateFilename(filename) {
  const name = String(filename ?? "").trim();
  if (!name || name.length > 255) {
    const error = new Error("Invalid filename");
    error.statusCode = 400;
    throw error;
  }
  if (name.includes("\0") || /[/\\]/.test(name) || name.includes("..")) {
    const error = new Error("Invalid filename");
    error.statusCode = 400;
    throw error;
  }
  const ext = path.extname(name).toLowerCase();
  if (blockedExtensions.has(ext)) {
    const error = new Error("File extension not allowed");
    error.statusCode = 415;
    throw error;
  }
  return name;
}

export function validateUpload({ contentType, byteSize }) {
  const policy = allowedContentTypes.get(contentType);
  if (!policy) {
    const error = new Error("Unsupported file type");
    error.statusCode = 415;
    throw error;
  }
  if (!Number.isInteger(byteSize) || byteSize <= 0 || byteSize > policy.maxBytes) {
    const error = new Error(`File size exceeds ${policy.maxBytes} byte limit for ${contentType}`);
    error.statusCode = 413;
    throw error;
  }
  return policy;
}
