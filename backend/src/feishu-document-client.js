import { httpError, throwErr } from "./api-errors.js";
import { parseCreatorTextDocument } from "./document-parser.js";
import { fetchUpstream } from "./upstream-fetch.js";

const FEISHU_API_BASE = "https://open.feishu.cn/open-apis";
const LARK_API_BASE = "https://open.larksuite.com/open-apis";
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;
const MAX_BLOCKS = 5_000;
const MAX_BLOCK_PAYLOAD_BYTES = 20 * 1024 * 1024;
const MAX_TEXT_CHARACTERS = 2_000_000;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,80}$/;
const ALLOWED_HOSTS = ["feishu.cn", "larksuite.com"];

const cachedTenantTokens = new Map();

function isAllowedHost(hostname) {
  const host = String(hostname ?? "").toLowerCase();
  return ALLOWED_HOSTS.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

export function parseFeishuDocumentReference(value) {
  let url;
  try {
    url = new URL(String(value ?? "").trim());
  } catch {
    throwErr("FEISHU_DOCUMENT_URL_INVALID");
  }
  if (url.protocol !== "https:" || !isAllowedHost(url.hostname) || url.username || url.password) {
    throwErr("FEISHU_DOCUMENT_URL_INVALID");
  }
  const segments = url.pathname.split("/").filter(Boolean);
  const typeIndex = segments.findIndex((segment) => ["docx", "docs", "wiki"].includes(segment.toLowerCase()));
  const type = typeIndex >= 0 ? segments[typeIndex].toLowerCase() : "";
  const token = typeIndex >= 0 ? segments[typeIndex + 1] : "";
  if (!type || !TOKEN_PATTERN.test(token ?? "")) throwErr("FEISHU_DOCUMENT_URL_INVALID");
  return {
    type: type === "wiki" ? "wiki" : type === "docs" ? "legacy_doc" : "docx",
    token,
    apiBase: url.hostname.toLowerCase().endsWith("larksuite.com") ? LARK_API_BASE : FEISHU_API_BASE
  };
}

async function responseJson(response) {
  const declaredLength = Number(response.headers?.get?.("content-length") ?? 0);
  if (declaredLength > MAX_RESPONSE_BYTES) {
    await response.body?.cancel?.();
    throwErr("FEISHU_DOCUMENT_TOO_LARGE");
  }
  let body;
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = Buffer.from(value);
        total += chunk.byteLength;
        if (total > MAX_RESPONSE_BYTES) {
          await reader.cancel();
          throwErr("FEISHU_DOCUMENT_TOO_LARGE");
        }
        chunks.push(chunk);
      }
    } finally {
      reader.releaseLock?.();
    }
    body = Buffer.concat(chunks, total).toString("utf8");
  } else {
    body = await response.text();
    if (Buffer.byteLength(body, "utf8") > MAX_RESPONSE_BYTES) throwErr("FEISHU_DOCUMENT_TOO_LARGE");
  }
  try {
    return JSON.parse(body);
  } catch {
    throw httpError(502, "Feishu returned an invalid response", "FEISHU_IMPORT_FAILED");
  }
}

function feishuError(response, payload) {
  const upstreamCode = payload?.code;
  const details = { upstreamCode, upstreamStatus: response.status };
  if (response.status === 401 || response.status === 403 || upstreamCode === 1770032) {
    return httpError(403, "The Feishu app cannot read this document", "FEISHU_DOCUMENT_FORBIDDEN", details);
  }
  if (response.status === 404 || upstreamCode === 1770002 || upstreamCode === 1770003) {
    return httpError(404, "Feishu document was not found", "FEISHU_DOCUMENT_NOT_FOUND", details);
  }
  if (upstreamCode === 1770004 || upstreamCode === 1770033) {
    return httpError(413, "Feishu document exceeds the import limit", "FEISHU_DOCUMENT_TOO_LARGE", details);
  }
  return httpError(502, "Unable to read the Feishu document", "FEISHU_IMPORT_FAILED", details);
}

async function requestJson(path, { apiBase = FEISHU_API_BASE, token, method = "GET", body, fetchImpl = fetchUpstream } = {}) {
  const response = await fetchImpl(`${apiBase}${path}`, {
    method,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  }, { timeoutMs: 12_000 });
  const payload = await responseJson(response);
  if (!response.ok || (payload?.code != null && payload.code !== 0)) throw feishuError(response, payload);
  return payload;
}

async function getFeishuAccessToken({ apiBase = FEISHU_API_BASE, env = process.env, fetchImpl = fetchUpstream } = {}) {
  const configuredUserToken = String(env.FEISHU_USER_ACCESS_TOKEN ?? "").trim();
  if (configuredUserToken) return configuredUserToken;

  const appId = String(env.FEISHU_APP_ID ?? "").trim();
  const appSecret = String(env.FEISHU_APP_SECRET ?? "").trim();
  if (!appId || !appSecret) throwErr("FEISHU_IMPORT_NOT_CONFIGURED");
  const cachedTenantToken = cachedTenantTokens.get(apiBase);
  if (fetchImpl === fetchUpstream && cachedTenantToken?.expiresAt > Date.now()) return cachedTenantToken.value;

  const payload = await requestJson("/auth/v3/tenant_access_token/internal", {
    method: "POST",
    body: { app_id: appId, app_secret: appSecret },
    apiBase,
    fetchImpl
  });
  const value = String(payload?.tenant_access_token ?? "").trim();
  if (!value) throw httpError(502, "Feishu did not issue an access token", "FEISHU_IMPORT_FAILED");
  if (fetchImpl === fetchUpstream) {
    const expiresInSeconds = Math.max(60, Number(payload?.expire) || 7_200);
    cachedTenantTokens.set(apiBase, {
      value,
      expiresAt: Date.now() + Math.max(30, expiresInSeconds - 60) * 1_000
    });
  }
  return value;
}

async function resolveLegacyDocumentId(legacyToken, token, fetchImpl, apiBase) {
  const payload = await requestJson(`/doc/v2/meta/${encodeURIComponent(legacyToken)}`, {
    token,
    apiBase,
    fetchImpl
  });
  const upgradedToken = String(payload?.data?.upgraded_token ?? "").trim();
  if (payload?.data?.is_upgraded && TOKEN_PATTERN.test(upgradedToken)) return upgradedToken;
  throwErr(
    "FEISHU_LEGACY_DOCUMENT_UNSUPPORTED",
    "Legacy Feishu Docs must be upgraded or copied into a new Docx document before import"
  );
}

async function resolveDocumentId(reference, token, fetchImpl) {
  if (reference.type === "docx") return reference.token;
  if (reference.type === "legacy_doc") {
    return resolveLegacyDocumentId(reference.token, token, fetchImpl, reference.apiBase);
  }
  const payload = await requestJson(`/wiki/v2/spaces/get_node?token=${encodeURIComponent(reference.token)}`, {
    token,
    apiBase: reference.apiBase,
    fetchImpl
  });
  const node = payload?.data?.node;
  const objectToken = String(node?.obj_token ?? "");
  if (node?.obj_type === "doc" && TOKEN_PATTERN.test(objectToken)) {
    return resolveLegacyDocumentId(objectToken, token, fetchImpl, reference.apiBase);
  }
  if (node?.obj_type !== "docx" || !TOKEN_PATTERN.test(objectToken)) {
    throwErr("FEISHU_DOCUMENT_URL_INVALID", "The Feishu wiki node is not a document");
  }
  return objectToken;
}

function textElements(value) {
  const elements = Array.isArray(value?.elements) ? value.elements : [];
  return elements.map((element) => (
    element?.text_run?.content
    ?? element?.equation?.content
    ?? element?.mention_user?.user_id
    ?? element?.mention_doc?.url
    ?? ""
  )).join("").trim();
}

const TEXT_KEYS = [
  "page", "text", "heading1", "heading2", "heading3", "heading4", "heading5",
  "heading6", "heading7", "heading8", "heading9", "bullet", "ordered", "code",
  "quote", "todo"
];

export function feishuBlocksToText(blocks) {
  const lines = [];
  for (const block of blocks ?? []) {
    const key = TEXT_KEYS.find((candidate) => block?.[candidate]);
    if (!key || key === "page") continue;
    const content = textElements(block[key]);
    if (!content) continue;
    if (key.startsWith("heading")) {
      const level = Math.min(6, Math.max(1, Number(key.slice("heading".length)) || 1));
      lines.push(`${"#".repeat(level)} ${content}`);
    } else if (key === "bullet") {
      lines.push(`- ${content}`);
    } else if (key === "ordered") {
      lines.push(`1. ${content}`);
    } else if (key === "quote") {
      lines.push(`> ${content}`);
    } else {
      lines.push(content);
    }
  }
  return lines.join("\n\n").trim();
}

async function listDocumentBlocks(documentId, token, fetchImpl, apiBase) {
  const blocks = [];
  let blockPayloadBytes = 0;
  let pageToken = "";
  for (let page = 0; page < 10; page += 1) {
    const query = new URLSearchParams({ page_size: "500", document_revision_id: "-1" });
    if (pageToken) query.set("page_token", pageToken);
    const payload = await requestJson(`/docx/v1/documents/${encodeURIComponent(documentId)}/blocks?${query}`, {
      token,
      apiBase,
      fetchImpl
    });
    const items = payload?.data?.items ?? [];
    if (!Array.isArray(items)) throw httpError(502, "Feishu returned invalid document blocks", "FEISHU_IMPORT_FAILED");
    blockPayloadBytes += Buffer.byteLength(JSON.stringify(items), "utf8");
    if (blockPayloadBytes > MAX_BLOCK_PAYLOAD_BYTES) throwErr("FEISHU_DOCUMENT_TOO_LARGE");
    blocks.push(...items);
    if (blocks.length > MAX_BLOCKS) throwErr("FEISHU_DOCUMENT_TOO_LARGE");
    if (!payload?.data?.has_more) return blocks;
    pageToken = String(payload?.data?.page_token ?? "");
    if (!pageToken) throw httpError(502, "Feishu pagination stopped unexpectedly", "FEISHU_IMPORT_FAILED");
  }
  throwErr("FEISHU_DOCUMENT_TOO_LARGE");
}

export async function loadFeishuDocumentText({ url, creationType, env = process.env, fetchImpl = fetchUpstream }) {
  const reference = parseFeishuDocumentReference(url);
  const token = await getFeishuAccessToken({ apiBase: reference.apiBase, env, fetchImpl });
  const documentId = await resolveDocumentId(reference, token, fetchImpl);
  const [metadata, blocks] = await Promise.all([
    requestJson(`/docx/v1/documents/${encodeURIComponent(documentId)}`, {
      apiBase: reference.apiBase,
      token,
      fetchImpl
    }),
    listDocumentBlocks(documentId, token, fetchImpl, reference.apiBase)
  ]);
  const title = String(metadata?.data?.document?.title ?? "飞书稿件").trim().slice(0, 240) || "飞书稿件";
  const text = feishuBlocksToText(blocks);
  if (!text) throwErr("DOCUMENT_EMPTY");
  if (text.length > MAX_TEXT_CHARACTERS) throwErr("FEISHU_DOCUMENT_TOO_LARGE");
  return parseCreatorTextDocument({
    filename: `${title}.feishu.md`,
    text,
    creationType,
    extraction: {
      method: "feishu_docx",
      documentId,
      revisionId: metadata?.data?.document?.revision_id ?? null,
      blockCount: blocks.length
    },
    warnings: [
      "内容来自飞书云文档快照；再次导入前请确认飞书中的最新版本与当前预览一致。",
      "当前结构识别读取标题、正文、列表和引用；飞书表格、图片、附件与复杂嵌套块不会自动转成正文，请在导入后人工核对。"
    ]
  });
}
