import assert from "node:assert/strict";
import test from "node:test";
import { buildRuntimeKnowledgeProjection } from "../src/runtime-knowledge-service.js";
import { buildRuntimeCurrentState } from "../src/runtime-current-state-service.js";
import { assertRuntimeObjectDeletionAllowed } from "../src/runtime-release-guard.js";
import { compileMechanismPackage } from "../src/mechanism-package.js";

const roomId = "20000000-0000-4000-8000-000000000001";
const worldId = "20000000-0000-4000-8000-000000000002";
const roleId = "20000000-0000-4000-8000-000000000003";
const sectionId = "20000000-0000-4000-8000-000000000004";
const clueId = "20000000-0000-4000-8000-000000000005";
const segmentId = "20000000-0000-4000-8000-000000000007";

function mechanismPackage() {
  return compileMechanismPackage({
    semanticConstitution: { facts: [], authorizationGrants: [], branchEvents: [], worldRules: [] },
    causalTimeline: [],
    entities: [],
    resources: [],
    players: [],
    evidenceGraph: { evidence: [], conclusions: [] },
    chapterBeats: [{
      chapterKey: "round-1",
      title: "核对授权",
      goal: "确认授权是否覆盖正式运行",
      playerAction: "讨论授权范围",
      genreMechanicUse: "程序复核",
      stateReads: [],
      stateWrites: [],
      resourceDeltas: [],
      evidenceKeys: [],
      unlocksEvidenceKeys: [],
      locksEvidenceKeys: [],
      decision: {
        key: "decision-auth",
        question: "是否认可本次授权？",
        options: [{ key: "accept", choiceText: "认可", effects: [] }]
      }
    }],
    endingLogic: {
      stateVariables: [],
      defaultRouteKey: "ending-default",
      conflictResolution: "highest-priority",
      routes: [{ key: "ending-default", title: "等待复核", priority: 0, isDefault: true, requirements: [] }]
    }
  });
}

function snapshot() {
  return {
    schemaVersion: 1,
    sourceRevision: 4,
    narrativeProfile: { kind: "mystery" },
    world: {
      id: worldId,
      name: "Release",
      settings: {
        tabletopMapDesign: {
          title: "Runtime map",
          locations: [{
            id: "archive",
            name: "Archive",
            description: "Public archive",
            hostNotes: "Hidden archive truth",
            segmentKey: "opening",
            x: 0.4,
            y: 0.5
          }],
          routes: [],
          variables: [{ id: "truth", label: "Truth", value: 8, min: 0, max: 10 }],
          endings: [{ id: "ending", name: "Ending" }],
          system: {
            dice: { count: 1, sides: 20, modifier: 2, defaultTarget: 12 },
            players: [{ id: "party", name: "Party", hp: 10, maxHp: 12 }],
            npcs: [{ id: "keeper", name: "Keeper", hp: 8, maxHp: 8 }]
          }
        }
      }
    },
    chapters: [],
    roles: [{
      id: roleId,
      name: "Detective",
      public_profile: "public",
      private_profile: "private",
      sequence: 1
    }],
    sections: [{
      id: sectionId,
      role_slot_id: roleId,
      title: "Act one",
      body: "secret body",
      sequence: 1,
      publication_status: "published",
      metadata: { segmentKey: "opening" }
    }],
    scenes: [],
    clues: [{
      id: clueId,
      name: "Receipt",
      public_text: "public clue",
      host_text: "host-only explanation"
    }],
    investigationPoints: [],
    items: [],
    edges: [],
    rules: [],
    segments: [{
      id: segmentId,
      segment_key: "opening",
      title: "Opening investigation",
      sequence: 1,
      story: {
        beatPlan: {
          goal: "Confirm the timeline",
          playerContent: "Compare the first two statements",
          dmTasks: "Ask who handled the receipt",
          advanceCondition: "The table agrees on a suspect",
          estimatedMinutes: 20
        }
      },
      operations: {
        flow: "Read, compare, then discuss",
        hostTruth: "The receipt timestamp was altered",
        playerTips: ["Check the printed time"],
        playerTasks: ["Compare both statements"],
        fallbacks: ["Reveal the register log"]
      }
    }],
    segmentRefs: [],
    truthClaims: [],
    roleRelationships: [],
    roleArchives: [],
    foreshadowBeats: [],
    timelineEvents: [],
    tags: [],
    assetManifest: [],
    mechanismPackage: mechanismPackage()
  };
}

function runtimeRecord() {
  return {
    room_id: roomId,
    world_id: worldId,
    room_name: "Room",
    room_status: "active",
    room_settings: {},
    release_id: "20000000-0000-4000-8000-000000000006",
    release_number: 1,
    release_label: "R1",
    release_source_revision: 4,
    release_snapshot: snapshot(),
    release_created_at: "2026-07-24T00:00:00.000Z",
    current_content_revision: 9
  };
}

function executor(sql) {
  if (sql.includes("release.snapshot AS release_snapshot")) {
    return Promise.resolve({ rows: [runtimeRecord()], rowCount: 1 });
  }
  if (sql.includes("AS recent_logs")) {
    return Promise.resolve({
      rows: [{
        member: { display_name: "Alice", joined_at: "2026-07-24T00:00:00.000Z" },
        player_state: null,
        progress: [],
        unlocks: [],
        clues: [{
          clue_id: clueId,
          owner_role_slot_id: roleId,
          acquired_at: "2026-07-24T00:01:00.000Z",
          read_at: null,
          shared_with_room: false,
          shared_with_roles: [],
          player_note: "",
          host_note: "private host note",
          shared_at: null
        }],
        notes: [],
        investigations: [],
        recent_logs: [{ event_type: "secret", message: "host log" }]
      }],
      rowCount: 1
    });
  }
  if (sql.includes("AS server_cursor")) {
    return Promise.resolve({
      rows: [{
        joined_players: 1,
        total_roles: 1,
        pending_host_events: 0,
        pending_private_actions: 0,
        open_votes: 0,
        player_open_votes: 0,
        active_game: null,
        server_cursor: 42
      }],
      rowCount: 1
    });
  }
  throw new Error(`Unexpected query: ${sql.slice(0, 80)}`);
}

function controlledExecutor(sql) {
  if (sql.includes("release.snapshot AS release_snapshot")) {
    const record = runtimeRecord();
    record.room_settings = {
      runtimePresentation: {
        activeSegmentKey: "closing",
        activeLocationId: "archive",
        revealedLocationIds: ["archive"],
        mapVisible: true,
        updatedAt: "2026-07-24T01:30:00.000Z"
      }
    };
    record.release_snapshot = {
      ...record.release_snapshot,
      segments: [
        ...record.release_snapshot.segments,
        {
          id: "20000000-0000-4000-8000-000000000008",
          segment_key: "closing",
          title: "Closing choice",
          sequence: 2,
          story: { beatPlan: { playerContent: "Choose the final route" } },
          operations: { playerTasks: ["Make the choice"], hostTruth: "Only one route is safe" }
        }
      ]
    };
    return Promise.resolve({ rows: [record], rowCount: 1 });
  }
  return executor(sql);
}

test("player knowledge excludes host-only fields while host uses the same projection", async () => {
  const player = await buildRuntimeKnowledgeProjection({
    roomId,
    roleSlotId: roleId,
    audience: "player",
    runQuery: executor,
    now: Date.parse("2026-07-24T02:00:00.000Z")
  });
  const host = await buildRuntimeKnowledgeProjection({
    roomId,
    roleSlotId: roleId,
    audience: "host",
    runQuery: executor,
    now: Date.parse("2026-07-24T02:00:00.000Z")
  });
  assert.equal(player.sections[0].body, "secret body");
  assert.equal(player.clues[0].hostText, undefined);
  assert.equal(player.clues[0].hostNote, undefined);
  assert.equal(player.recentLogs, undefined);
  assert.equal(host.clues[0].hostText, "host-only explanation");
  assert.equal(host.clues[0].hostNote, "private host note");
  assert.equal(host.recentLogs.length, 1);
});

test("current-state projection carries the same frozen source and journal cursor", async () => {
  const current = await buildRuntimeCurrentState({
    roomId,
    roleSlotId: roleId,
    audience: "player",
    knowledge: {
      summary: { availableSections: 1, completedSections: 0 },
      sections: [{ id: sectionId, title: "Act one", completed: false }]
    },
    runQuery: executor,
    now: Date.parse("2026-07-24T02:00:00.000Z")
  });
  assert.equal(current.syncState.runtimeSource, "release_snapshot");
  assert.equal(current.syncState.isFrozen, true);
  assert.equal(current.syncState.serverCursor, 42);
  assert.equal(current.contentBinding.release.releaseNumber, 1);
  assert.equal(current.currentBeat.key, "opening");
  assert.equal(current.currentBeat.player.content, "Compare the first two statements");
  assert.equal(current.currentBeat.host, null);
  assert.equal(current.suggestedActions[0].key, "read_section");
  assert.equal(current.mechanism.status, "not_started");
  assert.equal(current.mechanism.totalRounds, 1);
  assert.equal(current.presentation.map.activeLocation.name, "Archive");
  assert.equal(current.presentation.map.host, null);
});

test("host-controlled segment is authoritative for both flow and map presentation", async () => {
  const current = await buildRuntimeCurrentState({
    roomId,
    roleSlotId: roleId,
    audience: "player",
    knowledge: {
      summary: { availableSections: 1, completedSections: 0 },
      sections: [{ id: sectionId, title: "Act one", completed: false }]
    },
    runQuery: controlledExecutor,
    now: Date.parse("2026-07-24T02:00:00.000Z")
  });
  assert.equal(current.currentBeat.key, "closing");
  assert.equal(current.currentBeat.source, "host_control");
  assert.equal(current.currentBeat.player.content, "Choose the final route");
  assert.equal(current.currentBeat.host, null);
  assert.equal(current.presentation.activeSegmentKey, "closing");
});

test("host current beat uses the same segment and retains host-only guidance", async () => {
  const current = await buildRuntimeCurrentState({
    roomId,
    audience: "host",
    runQuery: executor,
    now: Date.parse("2026-07-24T02:00:00.000Z")
  });
  assert.equal(current.currentBeat.id, segmentId);
  assert.equal(current.currentBeat.source, "segment_order");
  assert.equal(current.currentBeat.host.dmTasks, "Ask who handled the receipt");
  assert.equal(current.currentBeat.host.hostTruth, "The receipt timestamp was altered");
});

test("deletion guard reports the bound room instead of allowing a destructive cascade", async () => {
  const client = {
    query: async () => ({
      rowCount: 1,
      rows: [{
        room_id: roomId,
        room_name: "Room",
        release_id: "20000000-0000-4000-8000-000000000006",
        release_number: 1
      }]
    })
  };
  await assert.rejects(
    assertRuntimeObjectDeletionAllowed(client, {
      worldId,
      field: "clues",
      objectId: clueId
    }),
    (error) => error.code === "RELEASE_BOUND_CONTENT_IN_USE"
      && error.details.roomId === roomId
  );
});
