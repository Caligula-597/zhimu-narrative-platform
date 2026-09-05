# P8 Generalization Cases

Input fixtures for **P8.0 Multi-Script Generalization Audit**.

- Layer: `ProjectStoryState` + `storyPlan` (accepted STORY templates), **not** frozen PMD.
- Corpus: GEN-01～GEN-08 — see `docs/P8_0B_REPRESENTATIVE_CORPUS_ZH.md`.
- A–H fidelity samples live elsewhere and are **not** part of this corpus.

```bash
npm run test:p8-generalization
npm run audit:p8-generalization
```
