/** Generation-stage heuristics that are intentionally stricter than the neutral protocol vocabulary. */

export const UNRESOLVED_BLUEPRINT_LOGIC = /真凶\s*[（(]?\s*或|凶手\s*或\s*幕后黑手|真凶\s*或\s*幕后黑手|实为[^。；]{0,40}(?:但|却|又)\s*实为|(?:真相|真凶|凶手|幕后黑手|核心责任|答案|结论)[^。；]{0,16}(?:待定|尚未确定|任选其一)|(?:待定|尚未确定|任选其一)[^。；]{0,16}(?:真相|真凶|凶手|幕后黑手|核心责任|答案|结论)/iu;
