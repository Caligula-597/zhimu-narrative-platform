import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "test");
const MIN_TESTS = 100;

const files = readdirSync(root).filter((name) => name.endsWith(".test.js"));
let count = 0;
for (const file of files) {
  const content = readFileSync(join(root, file), "utf8");
  const matches = content.match(/^test\(/gm) ?? [];
  count += matches.length;
}

if (count < MIN_TESTS) {
  console.error(`Expected at least ${MIN_TESTS} test cases, found ${count} across ${files.length} files.`);
  process.exit(1);
}

console.log(`verify-test-count: ${count} tests in ${files.length} files (min ${MIN_TESTS})`);
