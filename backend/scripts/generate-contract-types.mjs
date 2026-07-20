import fs from "node:fs/promises";
import path from "node:path";
import { compile } from "json-schema-to-typescript";
import {
  clueShareRolesSchema,
  inviteLookupSchema,
  joinRoomSchema,
  readClueSchema
} from "../src/routes/schemas/player.js";
import {
  hostLogSchema,
  hostNudgeWaitingSchema
} from "../src/routes/schemas/host-communication.js";
import { hostPlayerNotesSchema } from "../src/routes/schemas/host-player-management.js";
import {
  hostGrantClueSchema,
  hostRelockSectionSchema,
  hostResendClueSchema,
  hostRevokeClueSchema,
  hostSkipSectionSchema,
  hostUnlockSectionSchema
} from "../src/routes/schemas/host-content-action.js";
import {
  completeSectionSchema,
  notebookEntrySchema,
  sectionProgressResponseSchema
} from "../src/routes/schemas/player-progress.js";
import {
  createRoomVoteSchema,
  createSegmentSchema,
  updateRoomSettingsSchema,
  updateWorldSchema
} from "../src/routes/schemas/world.js";
import {
  createContentVersionSchema,
  createItemSchema,
  createRoleSchema,
  createRoomSchema,
  createSectionSchema,
  patchItemSchema,
  updateSectionSchema,
  createWorldSchema
} from "../src/routes/schemas/creator.js";
import {
  createClueSchema,
  createSceneSchema,
  patchClueSchema,
  patchSceneSchema
} from "../src/routes/schemas/studio-scene-clue.js";
import { createRuleSchema, updateRuleSchema } from "../src/routes/schemas/rules.js";
import { createRecapSchema } from "../src/routes/schemas/recap.js";
import {
  createTruthClaimSchema,
  patchTruthClaimSchema
} from "../src/routes/schemas/content-platform-truth.js";
import {
  importDocumentPagesSchema,
  importDocumentSchema,
  parseDocumentSchema,
  parseFeishuDocumentSchema
} from "../src/routes/schemas/creator-document.js";
import {
  creatorReviewCreateSchema,
  creatorReviewListSchema,
  creatorReviewPatchSchema,
  creatorReviewReplySchema,
  creatorVersionCompareSchema
} from "../src/routes/schemas/creator-review.js";
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
  ["HostRevokeClueBody", hostRevokeClueSchema.body],
  ["HostResendClueBody", hostResendClueSchema.body],
  ["HostUnlockSectionBody", hostUnlockSectionSchema.body],
  ["HostRelockSectionBody", hostRelockSectionSchema.body],
  ["HostSkipSectionBody", hostSkipSectionSchema.body],
  ["HostNudgeWaitingBody", hostNudgeWaitingSchema.body],
  ["HostLogBody", hostLogSchema.body],
  ["HostPlayerNotesBody", hostPlayerNotesSchema.body],
  ["PlayerProgressAssessment", playerProgressAssessmentSchema],
  ["UpdateWorldBody", updateWorldSchema.body],
  ["UpdateRoomSettingsBody", updateRoomSettingsSchema.body],
  ["CreateSegmentBody", createSegmentSchema.body],
  ["CreateRoomVoteBody", createRoomVoteSchema.body],
  ["CreateWorldBody", createWorldSchema.body],
  ["CreateRoleBody", createRoleSchema.body],
  ["CreateSectionBody", createSectionSchema.body],
  ["UpdateSectionBody", updateSectionSchema.body],
  ["CreateSceneBody", createSceneSchema.body],
  ["PatchSceneBody", patchSceneSchema.body],
  ["CreateClueBody", createClueSchema.body],
  ["PatchClueBody", patchClueSchema.body],
  ["CreateItemBody", createItemSchema.body],
  ["PatchItemBody", patchItemSchema.body],
  ["CreateContentVersionBody", createContentVersionSchema.body],
  ["CreateRoomBody", createRoomSchema.body],
  ["CreateRecapBody", createRecapSchema.body],
  ["CreateTruthClaimBody", createTruthClaimSchema.body],
  ["PatchTruthClaimBody", patchTruthClaimSchema.body],
  ["ParseDocumentBody", parseDocumentSchema.body],
  ["ParseFeishuDocumentBody", parseFeishuDocumentSchema.body],
  ["ImportDocumentBody", importDocumentSchema.body],
  ["ImportDocumentPagesBody", importDocumentPagesSchema.body],
  ["CreatorReviewListQuery", creatorReviewListSchema.querystring],
  ["CreatorReviewCreateBody", creatorReviewCreateSchema.body],
  ["CreatorReviewPatchBody", creatorReviewPatchSchema.body],
  ["CreatorReviewReplyBody", creatorReviewReplySchema.body],
  ["CreatorVersionCompareQuery", creatorVersionCompareSchema.querystring],
  ["CreateRuleBody", createRuleSchema.body],
  ["UpdateRuleBody", updateRuleSchema.body],
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
