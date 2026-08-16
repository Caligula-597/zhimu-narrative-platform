import { cleanText } from "./prompts/shared.js";
import { playStructureProfile } from "../../shared/play-structure.js";

export function validateMatrixEvaluation(raw, setting = {}) {
  const value = raw && typeof raw === "object" ? raw : {};
  const scores = value.scores && typeof value.scores === "object" ? value.scores : {};
  const humanAuthorship = Number(scores.humanAuthorship) || 0;
  const consequenceContinuity = Number(scores.consequenceContinuity) || 0;
  const dramaticTension = Number(scores.dramaticTension) || 0;
  const logicalCoherence = Number(scores.logicalCoherence) || 0;
  const informationSymmetry = Number(scores.informationSymmetry) || 0;
  const clueTopology = Number(scores.clueTopology) || 0;
  const clueResilience = Number(scores.clueResilience) || 0;
  const cooperationRhythm = Number(scores.cooperationRhythm) || 0;
  const playProfile = playStructureProfile(setting.playStructure);
  const playableScoresPass = !playProfile.requiresPlayableDecision || (
    Number(scores.roleAgency) >= 7 &&
    Number(scores.materialOperability) >= 7 &&
    Number(scores.sharedSceneConsistency) >= 7
  );
  const hasHigh = Array.isArray(value.issues) && value.issues.some((issue) => issue?.severity === "high");
  const redTeamFindings = Array.isArray(value.redTeamFindings) ? value.redTeamFindings : [];
  const requiredRedTeamScenarios = new Set(["selfish_withholder", "silent_player", "clue_saboteur", "false_consensus", "novice_host", "remove_role"]);
  const coveredRedTeamScenarios = new Set(redTeamFindings.map((item) => item?.scenario).filter(Boolean));
  const redTeamComplete = [...requiredRedTeamScenarios].every((scenario) => coveredRedTeamScenarios.has(scenario));
  const hasHighRedTeamFinding = redTeamFindings.some((issue) => issue?.severity === "high" || issue?.result === "blocked");
  return {
    overallScore: Number(value.overallScore) || 0,
    verdict: cleanText(value.verdict, 400),
    scores,
    issues: Array.isArray(value.issues) ? value.issues : [],
    revisions: Array.isArray(value.revisions) ? value.revisions : [],
    redTeamFindings,
    readyForSync:
      Boolean(value.readyForSync) &&
      humanAuthorship >= 7 &&
      consequenceContinuity >= 7 &&
      dramaticTension >= 7 &&
      logicalCoherence >= 8 &&
      informationSymmetry >= 7 &&
      clueTopology >= 7 &&
      clueResilience >= 7 &&
      cooperationRhythm >= 7 &&
      playableScoresPass &&
      redTeamComplete &&
      !hasHigh &&
      !hasHighRedTeamFinding,
    redTeamComplete,
    suggestions: Array.isArray(value.suggestions) ? value.suggestions : []
  };
}
