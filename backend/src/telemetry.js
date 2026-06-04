/**
 * Telemetry hooks — trace context today; OTLP SDK can plug in when OTEL_EXPORTER_OTLP_ENDPOINT is set.
 */

export function getTelemetryStatus() {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  return {
    enabled: process.env.OTEL_ENABLED === "true" || Boolean(endpoint),
    serviceName: process.env.OTEL_SERVICE_NAME || "zhimu-api",
    exporter: endpoint ? "otlp" : "none",
    endpoint: endpoint || null
  };
}

/** Best-effort span wrapper for future OpenTelemetry SDK wiring. */
export async function withSpan(name, attributes, fn) {
  const started = process.hrtime.bigint();
  try {
    return await fn();
  } finally {
    if (process.env.OTEL_DEBUG === "true") {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      console.debug(`[otel-stub] span=${name} ms=${ms.toFixed(1)}`, attributes ?? {});
    }
  }
}
