import { spawnSync } from "node:child_process";
import path from "node:path";

const DOCKER_IMAGE = process.env.PG_DRILL_IMAGE || process.env.ZHIMU_PG_DOCKER_IMAGE || "postgres:17-alpine";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function dockerAvailable() {
  const result = spawnSync("docker", ["info"], { encoding: "utf8", shell: false, stdio: "ignore" });
  return !result.error && result.status === 0;
}

function resolveNativeToolPath(name) {
  const envKey = `PG_${name.replace(/-/g, "_").toUpperCase()}`;
  if (process.env[envKey]) return process.env[envKey];
  const dir = process.env.PG_CLIENT_BIN_DIR?.replace(/[\\/]$/, "");
  if (dir) {
    const binary = process.platform === "win32" ? `${name}.exe` : name;
    return path.join(dir, binary);
  }
  return name;
}

function nativeToolAvailable(name) {
  const tool = resolveNativeToolPath(name);
  const probe = spawnSync(tool, ["--version"], {
    encoding: "utf8",
    shell: process.platform === "win32",
    stdio: "pipe"
  });
  return !probe.error && probe.status === 0;
}

function usesDockerClient() {
  if (process.env.ZHIMU_PG_DOCKER_CLIENT === "0") return false;
  if (process.env.ZHIMU_PG_DOCKER_CLIENT === "1") return true;
  return !nativeToolAvailable("psql") && dockerAvailable();
}

function rewriteDatabaseUrl(url) {
  try {
    const parsed = new URL(url);
    if (LOCAL_HOSTS.has(parsed.hostname)) {
      parsed.hostname = "host.docker.internal";
    }
    return parsed.toString();
  } catch {
    return url;
  }
}

function rewriteArgs(args) {
  return args.map((arg) => {
    if (typeof arg === "string" && /^postgres(ql)?:\/\//i.test(arg)) {
      return rewriteDatabaseUrl(arg);
    }
    if (typeof arg === "string" && arg.startsWith("--dbname=")) {
      return `--dbname=${rewriteDatabaseUrl(arg.slice("--dbname=".length))}`;
    }
    return arg;
  });
}

function fileMountFromArgs(args) {
  const idx = args.indexOf("-f");
  if (idx < 0 || !args[idx + 1]) return null;
  const hostPath = path.resolve(args[idx + 1]);
  return {
    hostDir: path.dirname(hostPath),
    containerFile: `/work/${path.basename(hostPath)}`
  };
}

function passwordFromArgs(args) {
  for (const arg of args) {
    if (typeof arg !== "string") continue;
    const raw = arg.startsWith("--dbname=") ? arg.slice("--dbname=".length) : arg;
    if (!/^postgres(ql)?:\/\//i.test(raw)) continue;
    try {
      const parsed = new URL(raw);
      if (parsed.password) return parsed.password;
    } catch {
      // ignore malformed URL fragments
    }
  }
  return process.env.PGPASSWORD || null;
}

/** Resolve pg_dump/psql/etc — CI sets PG_CLIENT_BIN_DIR=/usr/lib/postgresql/17/bin */
export function resolvePgTool(name) {
  if (usesDockerClient()) return `docker:${DOCKER_IMAGE}:${name}`;
  return resolveNativeToolPath(name);
}

export function pgClientMode() {
  if (nativeToolAvailable("psql") && nativeToolAvailable("pg_dump")) return "native";
  if (usesDockerClient()) return "docker";
  return "missing";
}

export function assertPgClientAvailable() {
  const mode = pgClientMode();
  if (mode === "missing") {
    console.error("psql/pg_dump not on PATH and Docker unavailable — restore evidence cannot be produced");
    process.exit(1);
  }
  if (mode === "docker") {
    console.log(`[pg-bin] using Docker client image ${DOCKER_IMAGE} (host.docker.internal for localhost)`);
  }
  return mode;
}

export function runPgTool(name, args, opts = {}) {
  const spawn = opts.spawnSync || spawnSync;
  if (!usesDockerClient()) {
    return spawn(resolveNativeToolPath(name), args, {
      encoding: "utf8",
      shell: process.platform === "win32",
      env: { ...process.env, PGPASSWORD: process.env.PGPASSWORD },
      ...opts
    });
  }

  let rewritten = rewriteArgs(args);
  const dockerArgs = ["run", "--rm"];
  const mount = fileMountFromArgs(rewritten);
  if (mount) {
    dockerArgs.push("-v", `${mount.hostDir}:/work`);
    const fileIndex = rewritten.indexOf("-f");
    rewritten = [...rewritten];
    rewritten[fileIndex + 1] = mount.containerFile;
  }

  const password = passwordFromArgs(rewritten);
  if (password) dockerArgs.push("-e", `PGPASSWORD=${password}`);

  dockerArgs.push(DOCKER_IMAGE, name, ...rewritten);
  return spawn("docker", dockerArgs, {
    encoding: "utf8",
    shell: false,
    env: process.env,
    ...opts
  });
}
