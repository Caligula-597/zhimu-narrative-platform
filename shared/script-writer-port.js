/**
 * P8.2.1 / P9.3 ScriptWriterPort — marker module + default constraints.
 * Implementations: DeterministicTestScriptWriter, RealScriptWriter.
 */

export { WRITER_CONSTRAINTS, buildScriptWriterRequest } from "./script-writer-result-contracts.js";
export { DeterministicTestScriptWriter, makeMutatingWriter } from "./deterministic-test-script-writer.js";
export { RealScriptWriter } from "./real-script-writer.js";

/**
 * @typedef {import('./script-writer-result-contracts.js').buildScriptWriterRequest} _
 * ScriptWriterPort: { write(request): Promise<ScriptWriterResult> }
 */
