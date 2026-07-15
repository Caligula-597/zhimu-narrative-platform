/**
 * Fastify logger options: JSON in production (or LOG_FORMAT=json) for log aggregation.
 */

export function buildFastifyLoggerOptions({ nodeEnv, loggerOption }) {
  if (loggerOption === false) {
    return false;
  }

  const useJson = nodeEnv === "production" || process.env.LOG_FORMAT === "json";
  const level = process.env.LOG_LEVEL || (nodeEnv === "production" ? "info" : "debug");

  if (!useJson) {
    return loggerOption === true || loggerOption == null ? { level } : { level, ...loggerOption };
  }

  return {
    level,
    ...(typeof loggerOption === "object" ? loggerOption : {}),
    serializers: {
      req(request) {
        return {
          method: request.method,
          // Query strings can contain OAuth codes, reset tokens and invite codes.
          url: String(request.url || "").split("?")[0],
          requestId: request.id
        };
      },
      res(reply) {
        return {
          statusCode: reply.statusCode
        };
      },
      err(error) {
        return {
          type: error.name,
          message: error.message,
          stack: error.stack
        };
      }
    },
    formatters: {
      level(label) {
        return { level: label };
      },
      bindings(bindings) {
        return {
          pid: bindings.pid,
          hostname: bindings.hostname,
          service: "zhimu-backend"
        };
      }
    },
    timestamp: () => `,"time":"${new Date().toISOString()}"`
  };
}
