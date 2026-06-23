/** Resolve pg_dump/psql/etc — CI sets PG_CLIENT_BIN_DIR=/usr/lib/postgresql/17/bin */
export function resolvePgTool(name) {
  const envKey = `PG_${name.replace(/-/g, "_").toUpperCase()}`;
  if (process.env[envKey]) return process.env[envKey];
  const dir = process.env.PG_CLIENT_BIN_DIR?.replace(/\/$/, "");
  if (dir) return `${dir}/${name}`;
  return name;
}
