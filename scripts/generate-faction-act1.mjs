#!/usr/bin/env node
/** Compile V6 IRs then render act 1. Renderer sees Narrative Event Packets only. */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  buildFactionAct1World,
  clauseProvenanceGate,
  compileNarrativeIr,
  compilePublicBriefing,
  crossRoleSimilarityGate,
  detectInternalIdentifierLeak,
  extractPublicContext,
  payloadForRenderer,
  spokenLinesOf,
  uniqueGateCodes
} from "../shared/world-engine/index.js";
import { buildNarrativeIrRenderMessages } from "../backend/src/world-engine-llm.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const backendRequire = createRequire(path.join(root, "backend", "package.json"));
backendRequire("dotenv").config({ path: path.join(root, "backend", ".env") });

function parseJsonObject(content) {
  const cleaned = String(content || "").replace(/^```json\s*|\s*```$/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error("json parse failed");
  }
}

async function requestJson(messages) {
  const apiKey = String(process.env.DEEPSEEK_API_KEY || "").trim();
  const baseUrl = String(process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
  const model = String(process.env.DEEPSEEK_MODEL || "deepseek-v4-flash");
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY missing");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.35,
      max_tokens: 2200,
      response_format: { type: "json_object" },
      thinking: { type: "disabled" }
    })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || `HTTP ${response.status}`);
  return parseJsonObject(payload?.choices?.[0]?.message?.content);
}

function gateText(text, narrativeIr) {
  const allowSpeech = (narrativeIr.events || []).some((row) => row.speech_mode === "direct" && row.spoken_line);
  const allowPhone = JSON.stringify(narrativeIr.events || []).includes("电话");
  const issues = clauseProvenanceGate(text, { allowSpeech, allowPhone });
  if (detectInternalIdentifierLeak(text)) {
    issues.push({ code: "internal_identifier_leak" });
  }
  const quotes = (text.match(/[“「][^”」]{2,}[”」]/gu) || []).length;
  const direct = (narrativeIr.events || []).some((row) => row.speech_mode === "direct" && row.spoken_line);
  if (quotes >= 4 && !direct) issues.push({ code: "render_mode_violation" });
  return uniqueGateCodes(issues);
}

function outDirFromArgs() {
  const flag = process.argv.find((row) => row.startsWith("--out="));
  const name = flag ? flag.slice("--out=".length) : "faction-act1-b";
  return path.join(root, "案例", ".gate-cache", name);
}

async function main() {
  const world = buildFactionAct1World();
  const publicContext = extractPublicContext(world.ledger, world);
  const outDir = outDirFromArgs();
  fs.mkdirSync(outDir, { recursive: true });
  const briefing = compilePublicBriefing(publicContext);
  fs.writeFileSync(path.join(outDir, "public-briefing.txt"), `${briefing}\n`, "utf8");
  const scripts = [];
  const narrativeByRole = [];
  for (const character of world.ledger.characters) {
    const narrativeIr = compileNarrativeIr(world.ledger, character.id, { ...world, publicContext });
    const payload = payloadForRenderer(narrativeIr, world.ledger);
    process.stdout.write(`render ${character.name}\n`);
    const value = await requestJson(buildNarrativeIrRenderMessages(payload));
    const text = String(value.text || "").trim();
    const gates = [
      ...gateText(text, narrativeIr),
      ...narrativeIr.underfill.map((row) => row.code)
    ];
    const row = {
      characterId: character.id,
      name: character.name,
      roleKey: character.roleKey,
      gates: [...new Set(gates)],
      runtimeIds: narrativeIr.runtimeIds,
      packetIds: narrativeIr.events.map((item) => item.packet_id),
      allowedSharedPhrases: spokenLinesOf(narrativeIr),
      payload,
      text
    };
    scripts.push(row);
    narrativeByRole.push(narrativeIr);
    fs.writeFileSync(path.join(outDir, `${character.id}.txt`), `${character.name}　${character.roleKey}\n\n${text}\n`, "utf8");
    fs.writeFileSync(path.join(outDir, `${character.id}.payload.json`), JSON.stringify(payload, null, 2), "utf8");
  }
  const cross = crossRoleSimilarityGate(scripts, publicContext);
  const irPath = path.join(outDir, "ir.json");
  fs.writeFileSync(irPath, JSON.stringify({
    title: world.ledger.seed.title,
    publicBriefing: briefing,
    playIr: world.playIr,
    runtimeLog: world.runtimeLog,
    collisions: world.collisions,
    interactions: world.interactions,
    crossRoleGates: cross,
    narrativePackets: narrativeByRole.map((row) => ({
      characterId: row.characterId,
      public_refs: row.public_refs,
      events: row.events
    })),
    scripts: scripts.map((row) => ({ ...row, text: undefined, payload: undefined }))
  }, null, 2), "utf8");
  const md = ["# 《临河泊位》第一幕（V6-B Narrative Event Packet）", "", "## 公共开场", "", briefing, ""];
  for (const row of scripts) {
    md.push(`## ${row.name}（${row.roleKey}）`, "", row.text, "", `门禁：${row.gates.join(", ") || "无"}`, "");
  }
  md.push("## 跨角色门禁", "", cross.length ? JSON.stringify(cross, null, 2) : "无", "");
  fs.writeFileSync(path.join(outDir, "act1.md"), md.join("\n"), "utf8");
  console.log(`wrote ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
