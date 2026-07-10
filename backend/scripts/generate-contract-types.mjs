import fs from "node:fs/promises";
import path from "node:path";
import { compile } from "json-schema-to-typescript";
import {
  clueShareRolesSchema,
  inviteLookupSchema,
  joinRoomSchema,
  notebookEntrySchema
} from "../src/routes/schemas/player.js";
import {
  createSegmentSchema,
  updateWorldSchema
} from "../src/routes/schemas/world.js";
import {
  createRoleSchema,
  createWorldSchema
} from "../src/routes/schemas/creator.js";
import { deepseekPipelineSpecSchema } from "../src/routes/schemas/ai.js";
import {
  createPhysicalTokensSchema,
  createPlazaPostSchema,
  submitBetaApplicationSchema
} from "../src/routes/schemas/platform.js";

const contracts = [
  ["InviteLookupParams", inviteLookupSchema.params],
  ["JoinRoomBody", joinRoomSchema.body],
  ["NotebookEntryBody", notebookEntrySchema.body],
  ["ClueShareRolesBody", clueShareRolesSchema.body],
  ["UpdateWorldBody", updateWorldSchema.body],
  ["CreateSegmentBody", createSegmentSchema.body],
  ["CreateWorldBody", createWorldSchema.body],
  ["CreateRoleBody", createRoleSchema.body],
  ["DeepseekPipelineSpecBody", deepseekPipelineSpecSchema.body],
  ["CreatePhysicalTokensBody", createPhysicalTokensSchema.body],
  ["SubmitBetaApplicationBody", submitBetaApplicationSchema.body],
  ["CreatePlazaPostBody", createPlazaPostSchema.body]
];

const sections = [];
for (const [name, schema] of contracts) {
  sections.push(await compile(schema, name, {
    bannerComment: "",
    ignoreMinAndMaxItems: true,
    style: { singleQuote: false, semi: true, tabWidth: 2 }
  }));
}

const output = [
  "/* AUTO-GENERATED from Fastify JSON Schema. Do not edit by hand. */",
  "/* Run: npm run contracts:generate --prefix backend */",
  "",
  ...sections
].join("\n");
const target = path.resolve(import.meta.dirname, "../generated/api-contracts.d.ts");
await fs.mkdir(path.dirname(target), { recursive: true });
await fs.writeFile(target, output);
console.log(`Generated ${contracts.length} API contracts -> ${path.relative(process.cwd(), target)}`);
