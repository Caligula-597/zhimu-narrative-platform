import {
  MECHANISM_PACKAGE_SCHEMA_VERSION,
  assertMechanismPackage,
} from "./mechanism-package.js";
import { simulateMechanismPackage, summarizeMechanismSimulation } from "./mechanism-simulator.js";
import { compilePipelineMechanismPackage } from "./pipeline-mechanism-package.js";

export async function storeWorldMechanismPackage(client, worldId, packageValue, metadata = {}) {
  const normalized = assertMechanismPackage(packageValue);
  await client.query(
    `INSERT INTO world_mechanism_packages
       (world_id, schema_version, source, package, metadata)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
     ON CONFLICT (world_id) DO UPDATE SET
       schema_version = EXCLUDED.schema_version,
       source = EXCLUDED.source,
       package = EXCLUDED.package,
       metadata = EXCLUDED.metadata,
       updated_at = now()`,
    [
      worldId,
      MECHANISM_PACKAGE_SCHEMA_VERSION,
      normalized.source || "outline_import",
      JSON.stringify(normalized),
      JSON.stringify(metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {})
    ]
  );
  return normalized;
}

export async function compileAndStorePipelineMechanismPackage(client, worldId, pipeline) {
  const worldResult = await client.query(
    `SELECT settings FROM worlds WHERE id = $1 FOR UPDATE`,
    [worldId],
  );
  const mechanismDesign = worldResult.rows[0]?.settings?.mechanismDesign;
  const compilation = compilePipelineMechanismPackage(pipeline, mechanismDesign);
  const packageValue = compilation.packageValue;
  if (!packageValue) {
    await client.query(
      `DELETE FROM world_mechanism_packages WHERE world_id = $1`,
      [worldId],
    );
    return {
      packageValue: null,
      simulationSummary: null,
      reason: compilation.reason,
      designStatus: compilation.design.status,
    };
  }
  const simulationSummary = summarizeMechanismSimulation(simulateMechanismPackage(packageValue));
  await storeWorldMechanismPackage(client, worldId, packageValue, {
    outlineSchemaVersion: pipeline.outline?.schemaVersion ?? null,
    chapterCount: packageValue.rounds.length,
    simulationSummary,
    compilationReason: compilation.reason,
    designStatus: compilation.design.status,
  });
  return {
    packageValue,
    simulationSummary,
    reason: compilation.reason,
    designStatus: compilation.design.status,
  };
}

export async function loadWorldMechanismPackage(client, worldId) {
  const result = await client.query(
    `SELECT package FROM world_mechanism_packages WHERE world_id = $1`,
    [worldId]
  );
  return result.rowCount ? assertMechanismPackage(result.rows[0].package) : null;
}
