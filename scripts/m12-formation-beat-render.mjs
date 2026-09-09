/**
 * F4B — Beat 人工审渲染 CLI（质量 Gate 素材：隐藏 Node ID，看剧情形成过程）
 *
 *   node scripts/m12-formation-beat-render.mjs
 *   → captures/m12-formation-beats/{gold,alt}-beats.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createProjectStoryState } from "../shared/story-mechanism-contracts.js";
import { upsertM12FormationArtifact } from "../shared/m12-formation-contracts.js";
import { buildM12FormationArtifact } from "../shared/m12-formation-builder.js";
import {
  compileM12FormationBeats,
  renderM12FormationBeatsForReview,
} from "../shared/m12-formation-beat-compiler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function compileFixture(fixturePath) {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
  let state = createProjectStoryState({
    projectId: fixture.projectId,
    mechanismBlocks: [
      {
        id: fixture.sourceBlockId,
        templateId: "M12-1",
        revision: fixture.sourceBlockRevision,
        status: "USER_ACCEPTED",
        roleBindings: {
          bargainA: fixture.participants.seekerId,
          bargainB: fixture.participants.holderId,
        },
      },
    ],
  });
  const built = buildM12FormationArtifact({
    state,
    sourceBlockId: fixture.sourceBlockId,
    artifactId: fixture.id,
    authoredFormation: {
      stake: fixture.stake,
      nodes: fixture.nodes,
      formation: fixture.formation,
      proof: fixture.proof,
    },
  });
  if (!built.ok) throw new Error(JSON.stringify(built.errors));
  state = upsertM12FormationArtifact(state, built.artifact);
  return { fixture, result: compileM12FormationBeats({ state, artifactId: built.artifact.id }) };
}

const TARGETS = [
  {
    key: "gold",
    fixture: path.join(root, "fixtures/m12-formation/closed-after-hours-gold.json"),
    context: path.join(root, "fixtures/m12-formation/closed-after-hours-context.json"),
    title: "《闭馆之后》Formation Beats（人工审 · Node ID 已隐藏）",
  },
  {
    key: "alt",
    fixture: path.join(root, "fixtures/m12-formation/sealed-room-alt-topology.json"),
    context: null,
    title: "《封存间》Formation Beats（旁证 · Node ID 已隐藏）",
  },
];

const outDir = path.join(root, "captures/m12-formation-beats");
fs.mkdirSync(outDir, { recursive: true });

for (const target of TARGETS) {
  const { result } = compileFixture(target.fixture);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  let characterNames = {};
  if (target.context) {
    const ctx = JSON.parse(fs.readFileSync(target.context, "utf8"));
    characterNames = Object.fromEntries(ctx.characters.map((c) => [c.id, c.name]));
  } else {
    characterNames = { P1: "顾一岚", P2: "商雪臣", P3: "老纪" };
  }
  const md = [
    `# ${target.title}`,
    "",
    `> ${result.coverage.nodeCount} 个 Formation 节点 → ${result.coverage.beatCount} 个 Beat`,
    "",
    renderM12FormationBeatsForReview({ beats: result.beats, characterNames }),
  ].join("\n");
  const out = path.join(outDir, `${target.key}-beats.md`);
  fs.writeFileSync(out, md, "utf8");
  console.log(`✔ ${path.relative(root, out)}（${result.coverage.beatCount} beats / ${result.coverage.nodeCount} nodes）`);
}
