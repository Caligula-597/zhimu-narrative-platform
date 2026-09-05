/**
 * P9.3 RealScriptWriter — ScriptWriterPort over injectable LLM.
 * maxAttempts=2 (2nd is FORMAT_REPAIR_ONLY). Never Source of Truth.
 */

import {
  buildScriptWriterRequest,
  normalizeScriptWriterResult,
} from "./script-writer-result-contracts.js";
import {
  buildFormatRepairPrompt,
  buildWriterSystemPrompt,
  buildWriterUserPrompt,
  getWriterProfile,
} from "./script-writer-profiles.js";
import {
  buildWriterInputFingerprint,
  buildWriterOutputFingerprint,
  normalizeWriterRunMetadata,
} from "./script-writer-run-metadata.js";
import { isUsableWriterResult, parseScriptWriterResultJson } from "./script-writer-format-repair.js";
import { MockScriptWriterLlm } from "./script-writer-llm-port.js";

function nowIso(now) {
  return typeof now === "function" ? now() : now || new Date().toISOString();
}

export class RealScriptWriter {
  /**
   * @param {{
   *   llm?: { completeJson: Function, modelId?: string, adapterId?: string },
   *   now?: Function,
   *   contextRevision?: number|null,
   *   gameNarrativeRevision?: number|null,
   * }} [opts]
   */
  constructor(opts = {}) {
    this.llm = opts.llm || new MockScriptWriterLlm();
    this.now = opts.now || (() => new Date().toISOString());
    this.contextRevision = opts.contextRevision ?? null;
    this.gameNarrativeRevision = opts.gameNarrativeRevision ?? null;
  }

  async write(request, { regeneration = false } = {}) {
    const req = buildScriptWriterRequest(request);
    const profile = getWriterProfile(req.packetKind);
    if (!profile) {
      return normalizeScriptWriterResult({
        requestId: req.requestId,
        packetKind: req.packetKind,
        sections: [],
        diagnostics: [
          { code: "UNKNOWN_PACKET_KIND", message: String(req.packetKind), severity: "error" },
        ],
      });
    }

    const startedAt = nowIso(this.now);
    const inputFingerprint = buildWriterInputFingerprint({
      packet: req.packet,
      writerProfileId: profile.id,
      promptVersion: profile.promptVersion,
      contextRevision: this.contextRevision,
      gameNarrativeRevision: this.gameNarrativeRevision,
    });

    const system = buildWriterSystemPrompt(profile);
    const user = buildWriterUserPrompt({ request: req, profile });
    let attemptCount = 0;
    let formatRepairUsed = false;
    let lastRaw = "";
    let parsed = null;
    let parseError = null;

    // Attempt 1 — normal write
    attemptCount += 1;
    const first = await this.llm.completeJson({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    lastRaw = first.text;
    try {
      parsed = parseScriptWriterResultJson(first.text, {
        requestId: req.requestId,
        packetKind: req.packetKind,
      });
      if (!isUsableWriterResult(parsed)) throw new Error("sections_unusable");
    } catch (err) {
      parseError = err?.message || String(err);
      parsed = null;
    }

    // Attempt 2 — FORMAT_REPAIR_ONLY
    if (!parsed) {
      formatRepairUsed = true;
      attemptCount += 1;
      const repair = await this.llm.completeJson({
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: buildFormatRepairPrompt({
              previousRaw: lastRaw,
              parseError,
              profile,
            }),
          },
        ],
      });
      lastRaw = repair.text;
      try {
        parsed = parseScriptWriterResultJson(repair.text, {
          requestId: req.requestId,
          packetKind: req.packetKind,
        });
        if (!isUsableWriterResult(parsed)) throw new Error("sections_unusable_after_repair");
      } catch (err) {
        return normalizeScriptWriterResult({
          requestId: req.requestId,
          packetKind: req.packetKind,
          sections: [],
          diagnostics: [
            {
              code: "WRITER_SCHEMA_FAIL",
              message: err?.message || String(err),
              severity: "error",
            },
          ],
          writerRunMetadata: normalizeWriterRunMetadata({
            writerProfileId: profile.id,
            providerAdapterId: this.llm.adapterId || first.adapterId || "llm",
            modelId: this.llm.modelId || first.modelId,
            promptVersion: profile.promptVersion,
            requestId: req.requestId,
            startedAt,
            completedAt: nowIso(this.now),
            inputFingerprint,
            outputFingerprint: null,
            attemptCount,
            formatRepairUsed,
            regeneration,
          }),
        });
      }
    }

    const result = normalizeScriptWriterResult({
      ...parsed,
      requestId: req.requestId,
      packetKind: req.packetKind,
      writerRunMetadata: normalizeWriterRunMetadata({
        writerProfileId: profile.id,
        providerAdapterId: this.llm.adapterId || "llm",
        modelId: this.llm.modelId,
        promptVersion: profile.promptVersion,
        requestId: req.requestId,
        startedAt,
        completedAt: nowIso(this.now),
        inputFingerprint,
        outputFingerprint: buildWriterOutputFingerprint(parsed),
        attemptCount,
        formatRepairUsed,
        regeneration,
      }),
    });
    return result;
  }
}
