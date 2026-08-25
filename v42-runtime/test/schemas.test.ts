import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ProjectSpecSchema,
  SettingNodeSchema,
  MotivationNodeSchema,
  AnyDesignNodeSchema
} from "../src/domain/index.js";

function baseFields(type: string) {
  const now = new Date().toISOString();
  return {
    id: `${type}_1`,
    projectId: "proj_1",
    type,
    version: 1,
    status: "draft" as const,
    createdBy: "test",
    updatedBy: "test",
    createdAt: now,
    updatedAt: now,
    lockLevel: 0,
    tags: [] as string[]
  };
}

describe("V4.2 IR schemas", () => {
  it("parses ProjectSpec", () => {
    const spec = ProjectSpecSchema.parse({
      id: "proj_1",
      playerCount: 6,
      cooperationMode: "unspecified",
      deliverables: {
        structure: true,
        characterBooks: true,
        gmManual: true,
        fullNarrative: false
      },
      requirements: ["民国六人本"],
      forbiddenPatterns: []
    });
    assert.equal(spec.playerCount, 6);
  });

  it("parses SettingNode and MotivationNode", () => {
    const setting = SettingNodeSchema.parse({
      ...baseFields("setting"),
      technology: [],
      medicine: [],
      transportation: [],
      communication: [],
      tools: [],
      socialNorms: [],
      legalNorms: [],
      languageConstraints: [],
      unknowns: [],
      description: "民国都市"
    });
    assert.equal(setting.type, "setting");

    const motivation = MotivationNodeSchema.parse({
      ...baseFields("motivation"),
      characterId: "char_1",
      description: "查明真相",
      sourceNodeIds: ["bg_1"],
      priority: "primary",
      conflictWithMotivationIds: [],
      active: true
    });
    assert.equal(motivation.sourceNodeIds.length, 1);
  });

  it("rejects invalid motivation via AnyDesignNode", () => {
    assert.throws(() =>
      AnyDesignNodeSchema.parse({
        ...baseFields("motivation"),
        characterId: "char_1",
        description: "x",
        // sourceNodeIds missing
        priority: "primary",
        conflictWithMotivationIds: [],
        active: true
      })
    );
  });
});
