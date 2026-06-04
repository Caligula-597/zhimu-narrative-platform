/** AI 生成草稿仅存作者浏览器 localStorage，确认「写入云端」前不上传 PostgreSQL。 */
(function (window) {
  const PREFIX = "zhimuAiDraft";
  const VERSION = 1;
  const MAX_BYTES = 3_500_000;

  function key(worldId, kind) {
    return `${PREFIX}:${worldId || "__none__"}:${kind}`;
  }

  function byteSize(text) {
    return new Blob([text]).size;
  }

  function load(worldId, kind) {
    try {
      const raw = localStorage.getItem(key(worldId, kind));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== VERSION) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function save(worldId, kind, payload) {
    const envelope = {
      version: VERSION,
      kind,
      worldId: worldId || "",
      savedAt: new Date().toISOString(),
      payload
    };
    const text = JSON.stringify(envelope);
    if (byteSize(text) > MAX_BYTES) {
      return { ok: false, error: "DRAFT_TOO_LARGE", bytes: byteSize(text) };
    }
    try {
      localStorage.setItem(key(worldId, kind), text);
      return { ok: true, savedAt: envelope.savedAt, bytes: byteSize(text) };
    } catch (error) {
      return { ok: false, error: error.name || "QUOTA_EXCEEDED" };
    }
  }

  function clear(worldId, kind) {
    localStorage.removeItem(key(worldId, kind));
  }

  function has(worldId, kind) {
    return Boolean(localStorage.getItem(key(worldId, kind)));
  }

  window.zhimuAiDraft = {
    KIND: {
      STRUCTURE: "structure-proposal",
      FULL_MYSTERY: "full-mystery",
      PIPELINE: "pipeline"
    },
    load,
    save,
    clear,
    has
  };
})(window);
