import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

export async function registerOpenApi(app, { nodeEnv }) {
  await app.register(swagger, {
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "织幕 API",
        description: "Interactive narrative engine — generated from Fastify route schemas.",
        version: "0.1.0"
      },
      tags: [
        { name: "system", description: "Health and ops" },
        { name: "auth", description: "Authentication" },
        { name: "worlds", description: "Worlds and studio" },
        { name: "rooms", description: "Runtime rooms and players" }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "session"
          }
        }
      }
    }
  });

  app.get(
    "/api/openapi.json",
    {
      schema: {
        hide: true,
        tags: ["system"],
        response: {
          200: { type: "object", additionalProperties: true }
        }
      }
    },
    async () => app.swagger()
  );

  const showUi = process.env.OPENAPI_UI === "true" || nodeEnv !== "production";
  if (showUi) {
    await app.register(swaggerUi, {
      routePrefix: "/api/docs",
      uiConfig: {
        docExpansion: "list",
        deepLinking: true
      }
    });
  }
}
