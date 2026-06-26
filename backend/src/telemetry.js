/**
 * OpenTelemetry bootstrap and span helpers.
 */
import { context, trace } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";

let sdk = null;
let initialized = false;
let initError = null;

function resolveTelemetryConfig() {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  const enabled = process.env.OTEL_ENABLED === "true" || Boolean(endpoint);
  return {
    enabled,
    serviceName: process.env.OTEL_SERVICE_NAME || "zhimu-api",
    exporter: endpoint ? "otlp-http" : "none",
    endpoint: endpoint || null
  };
}

export async function initTelemetry() {
  const config = resolveTelemetryConfig();
  if (!config.enabled || initialized || sdk) return getTelemetryStatus();
  if (!config.endpoint) {
    initError = "OTEL_EXPORTER_OTLP_ENDPOINT missing";
    return getTelemetryStatus();
  }
  process.env.OTEL_SERVICE_NAME = config.serviceName;
  try {
    sdk = new NodeSDK({
      traceExporter: new OTLPTraceExporter({ url: config.endpoint }),
      instrumentations: [getNodeAutoInstrumentations()]
    });
    await Promise.resolve(sdk.start());
    initialized = true;
    initError = null;
  } catch (error) {
    initError = error?.message || String(error);
    sdk = null;
  }
  return getTelemetryStatus();
}

export async function shutdownTelemetry() {
  if (!sdk) return;
  try {
    await sdk.shutdown();
  } finally {
    sdk = null;
    initialized = false;
  }
}

export function getTelemetryStatus() {
  return {
    ...resolveTelemetryConfig(),
    initialized,
    error: initError
  };
}

export async function withSpan(name, attributes, fn) {
  const tracer = trace.getTracer(process.env.OTEL_SERVICE_NAME || "zhimu-api");
  return tracer.startActiveSpan(name, { attributes: attributes ?? {} }, context.active(), async (span) => {
    try {
      return await fn();
    } catch (error) {
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  });
}
