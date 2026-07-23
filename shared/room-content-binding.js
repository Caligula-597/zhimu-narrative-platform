export const ROOM_CONTENT_BINDING_MODE = Object.freeze({
  LIVE_DRAFT: "live_draft",
  RELEASE: "release"
});

export const ROOM_RUNTIME_SOURCE = Object.freeze({
  LIVE_DRAFT: "live_draft",
  RELEASE_SNAPSHOT: "release_snapshot"
});

export const ROOM_BINDING_COMPATIBILITY = Object.freeze({
  LEGACY_LIVE_DRAFT: "legacy_live_draft",
  AWAITING_RELEASE_READER: "awaiting_release_reader",
  FROZEN_RELEASE: "frozen_release"
});

function optionalInteger(value, { minimum = 0 } = {}) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) && number >= minimum ? number : null;
}

/**
 * Build the public, snapshot-free room content binding projection.
 * Raw database rows and already-projected API values are both accepted so all
 * three clients can consume one stable contract during the M01 migration.
 */
export function projectRoomContentBinding(value = {}, {
  runtimeSource = ROOM_RUNTIME_SOURCE.LIVE_DRAFT
} = {}) {
  const existing = value?.contentBinding && typeof value.contentBinding === "object"
    ? value.contentBinding
    : value;
  const nestedRelease = existing.release && typeof existing.release === "object"
    ? existing.release
    : {};
  const releaseId = existing.releaseId ?? existing.release_id ?? nestedRelease.id ?? null;
  const releaseNumber = optionalInteger(
    existing.releaseNumber ?? existing.release_number ?? nestedRelease.releaseNumber,
    { minimum: 1 }
  );
  const sourceRevision = optionalInteger(
    existing.sourceRevision
      ?? existing.source_content_revision
      ?? existing.release_source_revision
      ?? nestedRelease.sourceRevision
  );
  const currentDraftRevision = optionalInteger(
    existing.currentDraftRevision
      ?? existing.current_content_revision
      ?? existing.content_revision
  );
  const resolvedRuntimeSource = existing.runtimeSource
    ?? existing.runtime_source
    ?? runtimeSource;
  const hasRelease = Boolean(releaseId);
  const frozen = hasRelease && resolvedRuntimeSource === ROOM_RUNTIME_SOURCE.RELEASE_SNAPSHOT;

  return {
    mode: hasRelease ? ROOM_CONTENT_BINDING_MODE.RELEASE : ROOM_CONTENT_BINDING_MODE.LIVE_DRAFT,
    runtimeSource: resolvedRuntimeSource,
    isFrozen: frozen,
    compatibilityStatus: frozen
      ? ROOM_BINDING_COMPATIBILITY.FROZEN_RELEASE
      : hasRelease
        ? ROOM_BINDING_COMPATIBILITY.AWAITING_RELEASE_READER
        : ROOM_BINDING_COMPATIBILITY.LEGACY_LIVE_DRAFT,
    release: hasRelease
      ? {
          id: releaseId,
          releaseNumber,
          label: existing.releaseLabel ?? existing.release_label ?? nestedRelease.label ?? "",
          sourceRevision,
          createdAt: existing.releaseCreatedAt ?? existing.release_created_at ?? nestedRelease.createdAt ?? null
        }
      : null,
    currentDraftRevision,
    hasNewerDraft: Boolean(
      hasRelease
      && sourceRevision !== null
      && currentDraftRevision !== null
      && currentDraftRevision > sourceRevision
    )
  };
}

export function roomContentBindingPresentation(value) {
  const binding = projectRoomContentBinding(value);
  const releaseNumber = binding.release?.releaseNumber;
  const releaseName = releaseNumber ? `R${releaseNumber}` : "已选版本";

  if (binding.isFrozen) {
    return {
      tone: binding.hasNewerDraft ? "testing" : "published",
      label: `${releaseName} · 冻结运行`,
      detail: binding.hasNewerDraft
        ? "本房间继续使用已发布内容；作者草稿已有更新，不会影响当前对局。"
        : "主持端与玩家端均从同一不可变发布快照读取内容。"
    };
  }

  if (binding.release) {
    return {
      tone: "testing",
      label: `${releaseName} · 版本预绑定`,
      detail: "房间已记录目标版本，但当前兼容层仍读取实时草稿；正式开局前请等待冻结读取启用。"
    };
  }

  return {
    tone: "draft",
    label: "实时草稿 · 测试",
    detail: "作者修改会同步到本房间，适合试跑，不适合作为已冻结的正式场次。"
  };
}
