#!/usr/bin/env node
/** Diagnose local dev ports used by Zhimu. */
import net from "node:net";

const PORTS = [
  { port: 4180, name: "API", url: "http://127.0.0.1:4180/api/health/live", expect: "api" },
  { port: 4173, name: "main app", url: "http://127.0.0.1:4173/", expect: "html" },
  { port: 5174, name: "play app", url: "http://127.0.0.1:5174/", expect: "html" },
  { port: 5175, name: "host app", url: "http://127.0.0.1:5175/", expect: "html" }
];

function canListen(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function probe(item) {
  try {
    const response = await fetch(item.url, { signal: AbortSignal.timeout(2_500) });
    const text = await response.text();
    if (!response.ok) return `${response.status}`;
    if (item.expect === "api") {
      const body = JSON.parse(text);
      return body.ok === false ? "api unhealthy" : "api live";
    }
    if (text.includes("<!doctype html") || text.includes("<html")) return "html";
    return "unknown response";
  } catch (error) {
    return error.name === "TimeoutError" ? "timeout" : "not responding";
  }
}

let busy = 0;
for (const item of PORTS) {
  const free = await canListen(item.port);
  if (free) {
    console.log(`FREE ${item.port} ${item.name}`);
    continue;
  }
  busy += 1;
  const detail = await probe(item);
  console.log(`BUSY ${item.port} ${item.name} - ${detail}`);
}

console.log("");
console.log("Expected commands:");
console.log("  API:       cd backend && npm run dev");
console.log("  main app:  npm run dev");
console.log("  play app:  cd play && npm run dev -- --port 5174 --strictPort");
console.log("  host app:  cd host && npm run dev");

if (busy) {
  console.log("");
  console.log("If a port is occupied by the wrong service, stop the old process before running smoke/E2E.");
}
