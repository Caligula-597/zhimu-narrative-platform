function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function clean(value, maximum = 400) {
  return String(value ?? "").trim().slice(0, maximum);
}

function recordForPath(records, path) {
  if (records[path]) return records[path];
  const ancestors = Object.keys(records)
    .filter((candidate) => path === candidate || path.startsWith(`${candidate}.`))
    .sort((left, right) => right.length - left.length);
  return records[ancestors[0]] || records[path.split(".")[0]] || null;
}

export function buildPipelineGenerationAudit(pipeline = {}, {
  manifest = pipeline.artifactDependencyManifest || pipeline.evaluation?.artifactDependencyManifest,
  strategyPlaytest = pipeline.strategyPlaytest || pipeline.evaluation?.strategyPlaytest,
  importedAt = new Date().toISOString()
} = {}) {
  const provenance = object(pipeline.generationProvenance);
  const records = object(provenance.records);
  const artifacts = Object.fromEntries(Object.entries(manifest?.nodes || {}).map(([path, node]) => {
    const record = recordForPath(records, path);
    const humanEdited = record?.originKind === "human_edited" || Boolean(record?.humanEditedAt);
    return [path, {
      fingerprint: clean(node?.fingerprint, 80),
      dependsOn: Array.isArray(node?.dependsOn) ? node.dependsOn : [],
      originKind: humanEdited ? "human_edited" : clean(record?.originKind, 40) || (record ? "ai_generated" : "unknown_import"),
      provider: humanEdited ? "human" : clean(record?.provider, 80),
      model: humanEdited ? "" : clean(record?.model, 120),
      generatedAt: clean(record?.generatedAt, 80) || null,
      humanEditedAt: clean(record?.humanEditedAt, 80) || null
    }];
  }));
  return {
    version: "1.0",
    source: "matrix_creation_pipeline",
    importedAt,
    manifestVersion: manifest?.version || null,
    artifacts,
    quality: {
      readyForSync: pipeline.evaluation?.readyForSync === true,
      overallScore: Number.isFinite(Number(pipeline.evaluation?.overallScore)) ? Number(pipeline.evaluation.overallScore) : null,
      scriptFingerprint: clean(pipeline.evaluation?.scriptFingerprint, 120) || null,
      strategyPlaytest: strategyPlaytest ? {
        method: strategyPlaytest.method,
        claimBoundary: strategyPlaytest.claimBoundary,
        runs: strategyPlaytest.runs,
        passed: strategyPlaytest.passed,
        metrics: strategyPlaytest.metrics,
        issues: strategyPlaytest.issues
      } : null
    }
  };
}

export function generationTraceForPath(audit, path) {
  const artifact = audit?.artifacts?.[path];
  if (!artifact) return { path, originKind: "unknown_import" };
  return {
    path,
    fingerprint: artifact.fingerprint,
    originKind: artifact.originKind,
    provider: artifact.provider,
    model: artifact.model,
    generatedAt: artifact.generatedAt,
    humanEditedAt: artifact.humanEditedAt
  };
}
