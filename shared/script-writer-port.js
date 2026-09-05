/**
 * P8.2.1 ScriptWriterPort — marker module + default constraints.
 * Implementations: DeterministicTestScriptWriter (and future LLM providers).
 */

export { WRITER_CONSTRAINTS, buildScriptWriterRequest } from "./script-writer-result-contracts.js";
export { DeterministicTestScriptWriter, makeMutatingWriter } from "./deterministic-test-script-writer.js";

/**
 * @typedef {import('./script-writer-result-contracts.js').buildScriptWriterRequest} _
 * ScriptWriterPort: { write(request): Promise<ScriptWriterResult> }
 */
