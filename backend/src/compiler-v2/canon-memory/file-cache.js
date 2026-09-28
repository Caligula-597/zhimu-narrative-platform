import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_ROOT = path.resolve(__dirname, "../../../../captures/canon-cache");

export async function readCanonCache(key) {
  try {
    const file = path.join(CACHE_ROOT, `${key}.json`);
    const raw = await readFile(file, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function writeCanonCache(key, value) {
  await mkdir(CACHE_ROOT, { recursive: true });
  const file = path.join(CACHE_ROOT, `${key}.json`);
  await writeFile(file, JSON.stringify(value, null, 0), "utf8");
}
