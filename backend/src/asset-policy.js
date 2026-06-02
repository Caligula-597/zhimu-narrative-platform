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
