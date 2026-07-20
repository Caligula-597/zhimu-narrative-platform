const PUBLIC_COMMERCIAL_PROFILE_FIELDS = Object.freeze([
  "authorName",
  "registrationNumber",
  "theme",
  "category",
  "versionLabel",
  "ageRating"
]);

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== ""));
}

export function publicWorldSettings(settings) {
  const source = settings && typeof settings === "object" && !Array.isArray(settings) ? settings : {};
  const commercialSource = source.commercialProfile && typeof source.commercialProfile === "object"
    && !Array.isArray(source.commercialProfile)
    ? source.commercialProfile
    : {};
  const commercialProfile = compactObject(Object.fromEntries(
    PUBLIC_COMMERCIAL_PROFILE_FIELDS.map((key) => [key, commercialSource[key]])
  ));
  return compactObject({
    creationType: source.creationType,
    coverAssetId: source.coverAssetId,
    commercialProfile: Object.keys(commercialProfile).length ? commercialProfile : undefined
  });
}

export function projectWorldForMembership(world) {
  if (!world || world.membership_role !== "viewer") return world;
  return {
    id: world.id,
    name: world.name,
    summary: world.summary,
    status: world.status,
    catalog_public: world.catalog_public,
    settings: publicWorldSettings(world.settings),
    membership_role: world.membership_role,
    content_revision: world.content_revision,
    created_at: world.created_at,
    updated_at: world.updated_at
  };
}
