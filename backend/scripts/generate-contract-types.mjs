import fs from "node:fs/promises";
import path from "node:path";
import { compile } from "json-schema-to-typescript";
import {
  clueShareRolesSchema,
  completeSectionSchema,
  hostGrantClueSchema,
  hostLogSchema,
  hostNudgeWaitingSchema,
  hostUnlockSectionSchema,
  inviteLookupSchema,
  joinRoomSchema,
  notebookEntrySchema,
  readClueSchema,
  sectionProgressResponseSchema
} from "../src/routes/schemas/player.js";
import {
  createRoomVoteSchema,
  createSegmentSchema,
  updateRoomSettingsSchema,
  updateWorldSchema
} from "../src/routes/schemas/world.js";
import {
  createClueSchema,
  createRoleSchema,
  createRoomSchema,
  createSceneSchema,
  createSectionSchema,
  createWorldSchema
} from "../src/routes/schemas/creator.js";
import { deepseekPipelineSpecSchema } from "../src/routes/schemas/ai.js";
import {
  createPhysicalTokensSchema,
  createPlazaPostSchema,
  submitBetaApplicationSchema
} from "../src/routes/schemas/platform.js";
import { playerProgressAssessmentSchema } from "../src/player-progress-assessment.js";
import { PLATFORM_EVENT_SCHEMAS } from "../src/platform-event-schemas.js";
import { ROOM_EVENT_SCHEMAS } from "../src/room-event-schemas.js";

function eventContractName(type) {
  return `${type.split(/[^a-zA-Z0-9]+/).map((part) => part[0].toUpperCase() + part.slice(1)).join("")}Data`;
}

const roomEventContracts = Object.entries(ROOM_EVENT_SCHEMAS)
  .map(([type, schema]) => [eventContractName(type), schema]);

const contracts = [
  ["InviteLookupParams", inviteLookupSchema.params],
  ["JoinRoomBody", joinRoomSchema.body],
  ["NotebookEntryBody", notebookEntrySchema.body],
  ["ClueShareRolesBody", clueShareRolesSchema.body],
  ["CompleteSectionParams", completeSectionSchema.params],
  ["SectionProgressResponse", sectionProgressResponseSchema],
  ["ReadClueParams", readClueSchema.params],
  ["HostGrantClueBody", hostGrantClueSchema.body],
  ["HostUnlockSectionBody", hostUnlockSectionSchema.body],
  ["HostNudgeWaitingBody", hostNudgeWaitingSchema.body],
  ["HostLogBody", hostLogSchema.body],
  ["PlayerProgressAssessment", playerProgressAssessmentSchema],
  ["UpdateWorldBody", updateWorldSchema.body],
  ["UpdateRoomSettingsBody", updateRoomSettingsSchema.body],
  ["CreateSegmentBody", createSegmentSchema.body],
  ["CreateRoomVoteBody", createRoomVoteSchema.body],
  ["CreateWorldBody", createWorldSchema.body],
  ["CreateRoleBody", createRoleSchema.body],
  ["CreateSectionBody", createSectionSchema.body],
  ["CreateSceneBody", createSceneSchema.body],
  ["CreateClueBody", createClueSchema.body],
  ["CreateRoomBody", createRoomSchema.body],
  ["DeepseekPipelineSpecBody", deepseekPipelineSpecSchema.body],
  ["CreatePhysicalTokensBody", createPhysicalTokensSchema.body],
  ["SubmitBetaApplicationBody", submitBetaApplicationSchema.body],
  ["CreatePlazaPostBody", createPlazaPostSchema.body],
  ["PlatformPlazaPostCreatedData", PLATFORM_EVENT_SCHEMAS["plaza.post_created"]],
  ["PlatformPlazaPostDeletedData", PLATFORM_EVENT_SCHEMAS["plaza.post_deleted"]],
  ["PlatformPlazaReplyCreatedData", PLATFORM_EVENT_SCHEMAS["plaza.reply_created"]],
  ["PlatformPlazaReplyDeletedData", PLATFORM_EVENT_SCHEMAS["plaza.reply_deleted"]],
  ["PlatformSocialFriendRequestData", PLATFORM_EVENT_SCHEMAS["social.friend_request"]],
  ["PlatformSocialFriendAcceptedData", PLATFORM_EVENT_SCHEMAS["social.friend_accepted"]],
  ["PlatformSocialFriendDeclinedData", PLATFORM_EVENT_SCHEMAS["social.friend_declined"]],
  ["PlatformDmMessageCreatedData", PLATFORM_EVENT_SCHEMAS["dm.message_created"]],
  ...roomEventContracts
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

const backendTarget = path.resolve(import.meta.dirname, "../generated/api-contracts.d.ts");
const sharedTarget = path.resolve(import.meta.dirname, "../../shared/generated/api-contracts.d.ts");

await fs.mkdir(path.dirname(backendTarget), { recursive: true });
await fs.mkdir(path.dirname(sharedTarget), { recursive: true });
await fs.writeFile(backendTarget, output);
await fs.writeFile(sharedTarget, output);
console.log(`Generated ${contracts.length} API contracts -> ${path.relative(process.cwd(), backendTarget)}`);
console.log(`Synced shared copy -> ${path.relative(process.cwd(), sharedTarget)}`);
