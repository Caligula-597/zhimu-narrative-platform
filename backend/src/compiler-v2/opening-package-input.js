/**
 * Opening Package → Compiler V2 input contract.
 * Document kind comes from upload slot — never re-guessed from merged text.
 *
 * OpeningPackageCommit {
 *   hostHandbook
 *   roleScripts[]  { characterName / roleName, file }
 *   clueTextFiles[] | clueTextDoc
 *   clueImages[]
 *   notes
 * }
 */

export const SLOT_KIND = Object.freeze({
  hostHandbook: "HOST_BOOK",
  roleScript: "CHARACTER_BOOK",
  clueTextDoc: "CLUE_FILE",
  clueTextFile: "CLUE_FILE",
  clueImage: "CLUE_MEDIA",
  mechanismDoc: "MECHANISM_FILE",
  notes: "NOTES"
});

/**
 * Normalize API / trial payloads into a single opening-package shape.
 */
export function normalizeOpeningPackageInput(inputFiles = {}) {
  const hostHandbook = inputFiles.hostHandbook || null;
  const roleScripts = Array.isArray(inputFiles.roleScripts)
    ? inputFiles.roleScripts.map((f) => ({
        ...f,
        roleName: f.roleName || f.characterName || null
      }))
    : [];

  const clueTextFiles = [];
  if (Array.isArray(inputFiles.clueTextFiles)) {
    clueTextFiles.push(...inputFiles.clueTextFiles);
  }
  if (inputFiles.clueTextDoc?.filename) {
    clueTextFiles.push(inputFiles.clueTextDoc);
  }

  const clueImages = Array.isArray(inputFiles.clueImages) ? inputFiles.clueImages : [];
  const notes =
    inputFiles.notes == null || inputFiles.notes === ""
      ? null
      : String(inputFiles.notes);

  return {
    rightsConfirmed: inputFiles.rightsConfirmed,
    creationType: inputFiles.creationType || "murder_mystery",
    hostHandbook,
    roleScripts,
    clueTextFiles,
    clueImages,
    mechanismDoc: inputFiles.mechanismDoc || null,
    notes
  };
}

export function kindFromSlot(slot) {
  return SLOT_KIND[slot] || "OTHER";
}
