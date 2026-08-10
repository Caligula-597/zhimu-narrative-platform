import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeRuntimePresentationControl,
  projectRuntimePresentation
} from "../shared/runtime-presentation.js";

function world() {
  return {
    settings: {
      tabletopMapDesign: {
        title: "盐雾群岛",
        locations: [
          {
            id: "harbor",
            name: "白帆港",
            type: "公共场景",
            description: "潮汐正在退去。",
            hostNotes: "走私者午夜出现。",
            segmentKey: "opening",
            x: 0.2,
            y: 0.4,
            z: 1,
            encounterNpcIds: ["smuggler"],
            checks: [{
              id: "find-smuggler",
              label: "追踪走私者",
              instruction: "说明如何辨认潮水中的足迹。",
              target: 10,
              successText: "找到走私船。",
              failureText: "足迹被潮水冲散。"
            }]
          },
          {
            id: "tower",
            name: "沉钟塔",
            type: "危险场景",
            description: "塔门仍然紧闭。",
            hostNotes: "结局开关在顶层。",
            segmentKey: "finale",
            x: 0.8,
            y: 0.6,
            z: 3,
            encounterNpcIds: ["keeper"]
          }
        ],
        routes: [["harbor", "tower"]],
        variables: [{ id: "threat", label: "威胁", value: 72, min: 0, max: 100 }],
        endings: [{ id: "escape", name: "撤离" }],
        system: {
          dice: { count: 2, sides: 6, modifier: 1, defaultTarget: 9 },
          players: [{ id: "pc", name: "领航员", role: "玩家", hp: 12, maxHp: 16 }],
          npcs: [{ id: "keeper", name: "守塔人", role: "精英", hp: 20, maxHp: 20 }]
        }
      }
    }
  };
}

test("runtime control follows the host segment and reveals the matched active location", () => {
  const design = world().settings.tabletopMapDesign;
  const control = normalizeRuntimePresentationControl({ activeSegmentKey: "finale" }, { design });
  assert.equal(control.activeLocationId, "tower");
  assert.deepEqual(control.revealedLocationIds, ["tower"]);
  assert.equal(control.mapVisible, true);
});

test("player projection contains only revealed public map content", () => {
  const projected = projectRuntimePresentation({
    world: world(),
    roomSettings: {
      runtimePresentation: {
        activeSegmentKey: "opening",
        activeLocationId: "harbor",
        revealedLocationIds: ["harbor"],
        mapVisible: true
      }
    },
    audience: "player"
  });
  assert.equal(projected.map.locations.length, 1);
  assert.equal(projected.map.activeLocation.name, "白帆港");
  assert.equal(projected.map.locations[0].hostNotes, undefined);
  assert.equal(projected.map.host, null);
  assert.deepEqual(projected.map.routes, []);
  assert.equal(projected.map.party[0].name, "领航员");
  assert.equal(projected.map.dice.sides, 6);
});

test("host projection retains all locations and secret operational context", () => {
  const projected = projectRuntimePresentation({
    world: world(),
    roomSettings: {
      runtimePresentation: {
        activeSegmentKey: "opening",
        activeLocationId: "harbor",
        revealedLocationIds: ["harbor"],
        mapVisible: false
      }
    },
    audience: "host"
  });
  assert.equal(projected.map.locations.length, 2);
  assert.equal(projected.map.host.locations[1].hostNotes, "结局开关在顶层。");
  assert.equal(projected.map.host.locations[0].checks[0].label, "追踪走私者");
  assert.equal(projected.map.host.npcs[0].name, "守塔人");
  assert.equal(projected.map.host.endingCount, 1);
  assert.equal(projected.map.visible, false);
});

test("active checks sync publicly without revealing unresolved outcome branches", () => {
  const pending = {
    id: "runtime-check",
    templateId: "find-smuggler",
    locationId: "harbor",
    label: "追踪走私者",
    instruction: "说明如何辨认潮水中的足迹。",
    target: 10,
    bonus: 0,
    rollMode: "normal",
    dice: { count: 2, sides: 6, modifier: 1, defaultTarget: 9 },
    status: "pending",
    result: null,
    successText: "找到走私船。",
    failureText: "足迹被潮水冲散。",
    successEffects: { threat: -4 },
    failureEffects: { threat: 6 },
    appliedChanges: [{ id: "threat", label: "威胁", previous: 72, value: 68, delta: -4 }],
    appliedAt: "",
    outcomeText: "",
    startedAt: "2026-08-10T12:00:00.000Z",
    resolvedAt: ""
  };
  const player = projectRuntimePresentation({
    world: world(),
    roomSettings: { runtimePresentation: { activeLocationId: "harbor", mapVisible: true, activeCheck: pending } },
    audience: "player"
  });
  const host = projectRuntimePresentation({
    world: world(),
    roomSettings: { runtimePresentation: { activeLocationId: "harbor", mapVisible: true, activeCheck: pending } },
    audience: "host"
  });
  assert.equal(player.map.activeCheck.label, "追踪走私者");
  assert.equal(player.map.activeCheck.successText, undefined);
  assert.equal(player.map.activeCheck.failureText, undefined);
  assert.equal(player.map.activeCheck.successEffects, undefined);
  assert.deepEqual(player.map.activeCheck.appliedChanges, []);
  assert.equal(host.map.activeCheck.successText, "找到走私船。");
});

test("active encounters are validated against the authored location and sync as public status", () => {
  const roomSettings = {
    runtimePresentation: {
      activeSegmentKey: "finale",
      activeLocationId: "tower",
      revealedLocationIds: ["tower"],
      mapVisible: true,
      activeEncounter: {
        locationId: "tower",
        npcIds: ["keeper", "unknown-npc"],
        status: "active",
        startedAt: "2026-08-10T12:30:00.000Z"
      }
    }
  };
  const player = projectRuntimePresentation({ world: world(), roomSettings, audience: "player" });
  const host = projectRuntimePresentation({ world: world(), roomSettings, audience: "host" });
  assert.equal(player.map.activeEncounter.locationName, "沉钟塔");
  assert.deepEqual(player.map.activeEncounter.npcs.map((npc) => npc.name), ["守塔人"]);
  assert.equal(player.map.activeEncounter.npcs[0].hostNotes, undefined);
  assert.equal(host.map.activeEncounter.status, "active");
});

test("runtime variables drive host-only ending candidates until the host publishes one", () => {
  const currentWorld = world();
  currentWorld.settings.tabletopMapDesign.endings = [{
    id: "escape",
    name: "潮汐撤离",
    summary: "队伍赶在封港前离开。",
    tone: "resolve",
    priority: 4,
    logic: "all",
    conditions: [{ id: "low-threat", variableId: "threat", operator: "<=", value: 40 }]
  }];
  const roomSettings = {
    runtimePresentation: {
      activeLocationId: "harbor",
      mapVisible: true,
      variableValues: [{ id: "threat", value: 38 }],
      publishedEnding: { id: "escape", publishedAt: "2026-08-10T13:00:00.000Z" }
    }
  };
  const host = projectRuntimePresentation({ world: currentWorld, roomSettings, audience: "host" });
  const player = projectRuntimePresentation({ world: currentWorld, roomSettings, audience: "player" });
  assert.equal(host.map.host.variables[0].value, 38);
  assert.equal(host.map.host.endingCandidates[0].id, "escape");
  assert.equal(player.map.host, null);
  assert.equal(player.map.publishedEnding.name, "潮汐撤离");
  assert.equal(player.map.publishedEnding.summary, "队伍赶在封港前离开。");
});
