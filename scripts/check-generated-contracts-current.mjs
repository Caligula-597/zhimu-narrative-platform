import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultGeneratorPath = path.join(root, "backend", "scripts", "generate-contract-types.mjs");
const defaultGeneratedPaths = [
  path.join(root, "backend", "generated", "api-contracts.d.ts"),
  path.join(root, "shared", "generated", "api-contracts.d.ts")
];

function readGeneratedFile(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath) : null;
}

export function checkGeneratedContractsCurrent({
  cwd = root,
  generatorPath = defaultGeneratorPath,
  generatedPaths = defaultGeneratedPaths,
  runGenerator = () => spawnSync(
    process.execPath,
    [generatorPath],
    { cwd, encoding: "utf8", stdio: "inherit" }
  )
} = {}) {
  const before = new Map(
    generatedPaths.map((filePath) => [filePath, readGeneratedFile(filePath)])
  );
  const result = runGenerator();
  if (result?.status !== 0) {
    throw new Error(`contract generator failed with exit code ${result?.status ?? "unknown"}`);
  }

  const changedPaths = generatedPaths.filter((filePath) => {
    const previous = before.get(filePath);
    const current = readGeneratedFile(filePath);
    if (previous === null || current === null) return previous !== current;
    return !previous.equals(current);
  });

  return {
    current: changedPaths.length === 0,
    changedPaths
  };
}

function isMainModule() {
  return process.argv[1] &&
    pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
}

if (isMainModule()) {
  try {
    const result = checkGeneratedContractsCurrent();
    if (!result.current) {
      console.error(
        "Generated API contracts were stale and have been regenerated:\n" +
        result.changedPaths
          .map((filePath) => `  - ${path.relative(root, filePath).replaceAll("\\", "/")}`)
          .join("\n") +
        "\nReview and include the regenerated files, then run this check again."
      );
      process.exitCode = 1;
    } else {
      console.log("Generated API contracts are current.");
    }
  } catch (error) {
    console.error(error?.stack || error);
    process.exitCode = 1;
  }
}
