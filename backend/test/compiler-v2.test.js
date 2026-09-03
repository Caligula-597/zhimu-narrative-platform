import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createEmptyCompilerV2State,
  COMPILER_V2_STAGES,
  DETECTION_STATUS,
  ACT_STATUS,
  MECHANISM_MATCH
} from "../src/compiler-v2/state.js";
import { matchMechanismAgainstCatalog } from "../src/compiler-v2/mechanism-matcher.js";
import {
  guessPlayerCountFromText,
  guessActCountFromText,
  isActTitle,
  splitActSectionTree,
  detectProjectTitle
} from "../src/compiler-v2/document-utils.js";
import { stage4SceneResolver } from "../src/compiler-v2/stages/stage4-scene-resolver.js";
import { stage5ClueAssetImport } from "../src/compiler-v2/stages/stage5-clue-asset.js";
import { stage7MechanismRuntimeCompiler } from "../src/compiler-v2/stages/stage7-mechanism-runtime.js";
import { stage8IntegrityValidator } from "../src/compiler-v2/stages/stage8-integrity-check.js";
import { runCompilerV2Pipeline } from "../src/compiler-v2/index.js";

describe("Compiler V2 state", () => {
  it("creates empty state with all stage buckets", () => {
    const state = createEmptyCompilerV2State({ worldId: "w1", jobId: "j1" });
    assert.equal(state.project.worldId, "w1");
    assert.equal(state.job.jobId, "j1");
    assert.equal(state.project.playerCountStatus, DETECTION_STATUS.NEEDS_CONFIRMATION);
    assert.ok(Array.isArray(state.sourceSections));
    assert.equal(COMPILER_V2_STAGES.length, 8);
  });
});

describe("Compiler V2 document utils", () => {
  it("guesses player/act counts only when explicit", () => {
    assert.equal(guessPlayerCountFromText("本局为4人剧本杀"), 4);
    assert.equal(guessPlayerCountFromText("四男三女的七人机制本"), 7);
    assert.equal(guessPlayerCountFromText("雨夜洋房"), null);
    assert.equal(guessActCountFromText("共3幕结构"), 3);
  });

  it("detects act titles by semantics, not any heading", () => {
    assert.equal(isActTitle("第一幕"), true);
    assert.equal(isActTitle("第二幕：晚宴"), true);
    assert.equal(isActTitle("1、第一幕游戏："), true);
    assert.equal(isActTitle("序幕"), true);
    assert.equal(isActTitle("灵石"), false);
    assert.equal(isActTitle("魔石"), false);
    assert.equal(isActTitle("玉满楼"), false);
    assert.equal(isActTitle("主持手册"), false);
    assert.equal(isActTitle("未分幕"), false);
    assert.equal(isActTitle("玉满楼场景复盘：莫寒在今日早些其实便已经来到了玉满楼"), false);
  });

  it("only promotes true acts; unassigned sections keep actTitle=null", () => {
    const tree = splitActSectionTree(
      ["第一幕", "我的身世。", "", "灵石", "公共机制说明。", "", "第二幕", "进入玉满楼。"].join(
        "\n"
      )
    );
    assert.deepEqual(
      tree.acts.map((a) => a.title),
      ["第一幕", "第二幕"]
    );
    assert.ok(tree.acts.every((a) => a.explicit === true));
    assert.ok(tree.sections.some((s) => s.headingPath.includes("灵石")));
    assert.ok(!tree.acts.some((a) => a.title === "灵石"));

    const bare = splitActSectionTree("前言一段。\n没有幕标题。");
    assert.equal(bare.acts.length, 0);
    assert.ok(bare.sections.length >= 1);
    assert.ok(bare.sections.every((s) => s.actTitle === null && s.actStatus === "UNASSIGNED"));
  });

  it("detects project title HIGH only for real book names", () => {
    assert.equal(detectProjectTitle("《长生叹》主持人手册").title, "长生叹");
    assert.equal(detectProjectTitle("《长生叹》主持人手册").confidence, "HIGH");
    assert.equal(detectProjectTitle("感谢您体验《 青 楼 》之旅").title, "青楼");
    assert.equal(detectProjectTitle("感谢您体验《 青 楼 》之旅").confidence, "HIGH");
    assert.equal(detectProjectTitle("发行方：黑羽发行工作室 作者：发阳").title, null);
    assert.notEqual(detectProjectTitle("《组织者手册》请阅读").confidence, "HIGH");
  });
});

describe("Compiler V2 six ingress invariants", () => {
  it("1+2: upload slot & character ownership are authoritative", async () => {
    const state = await runCompilerV2Pipeline(
      createEmptyCompilerV2State({ worldId: "inv-12", jobId: "j12" }),
      {
        toStage: "manuscript_ingest",
        inputFiles: {
          hostHandbook: {
            filename: "host.txt",
            text: "《青楼》\n四男三女\n第一幕\n开场。白斋子也来了。"
          },
          roleScripts: [
            {
              filename: "齐剑心.txt",
              characterName: "齐剑心",
              text: "第一幕\n我是齐剑心私人本。"
            }
          ]
        }
      }
    );
    assert.ok(state.documents.every((d) => d.kindSource === "upload_slot"));
    assert.equal(state.characters.length, 1);
    assert.equal(state.characters[0].name, "齐剑心");
    assert.ok(state.characterScripts.every((s) => {
      const doc = state.documents.find((d) => d.id === s.documentId);
      return doc?.kind === "CHARACTER_BOOK" && doc.roleName === "齐剑心";
    }));
    // Host text mentioning 白斋子 must NOT create that character
    assert.ok(!state.characters.some((c) => c.name === "白斋子"));
  });

  it("3: heading != act — no fallback Act entities", async () => {
    const state = await runCompilerV2Pipeline(
      createEmptyCompilerV2State({ worldId: "inv-3", jobId: "j3" }),
      {
        toStage: "manuscript_ingest",
        inputFiles: {
          hostHandbook: {
            filename: "host.txt",
            text: "《青楼》\n发行说明。\n灵石\n规则。"
          },
          roleScripts: [
            {
              filename: "白斋子.txt",
              characterName: "白斋子",
              text: "身世段落。\n没有幕标题。"
            }
          ]
        }
      }
    );
    assert.equal(state.acts.length, 0);
    assert.ok(!state.acts.some((a) => a.title === "主持手册" || a.title === "未分幕"));
    assert.ok(state.sourceSections.every((s) => s.actId === null));
    assert.ok(state.sourceSections.every((s) => s.actStatus === ACT_STATUS.UNASSIGNED));
    assert.ok(state.characterScripts.every((s) => s.actId === null));
    assert.ok(state.unresolved.some((u) => u.field === "acts"));
  });

  it("4: ClueAsset only from clue slots", async () => {
    const state = createEmptyCompilerV2State({ worldId: "inv-4" });
    state.documents = [
      {
        id: "doc_host",
        kind: "HOST_BOOK",
        slot: "hostHandbook",
        filename: "host.txt",
        text: "请注意！此剧本严禁盲开。线索很多。"
      }
    ];
    const next = await stage5ClueAssetImport(state);
    assert.equal(next.clues.length, 0);
  });

  it("5: Scene must be a resolved place — no heading keyword invent", async () => {
    const state = createEmptyCompilerV2State({ worldId: "inv-5" });
    state.documents = [
      {
        id: "d1",
        kind: "HOST_BOOK",
        text: "玉满楼场景复盘：莫寒今日早些来到了玉满楼"
      }
    ];
    state.timelineEvents = [];
    const next = await stage4SceneResolver(state);
    assert.equal(next.scenes.length, 0);
  });

  it("6: Mechanism source must be selected — no full-text catalog scan", async () => {
    const state = createEmptyCompilerV2State({ worldId: "inv-6" });
    state.documents = [
      {
        id: "d1",
        kind: "HOST_BOOK",
        slot: "hostHandbook",
        filename: "host.txt",
        text: "版权所有。搜证耗尽后进入下一轮。严禁盲开。拍卖开始。"
      }
    ];
    const next = await stage7MechanismRuntimeCompiler(state);
    assert.equal(next.mechanisms.length, 0);
    assert.ok(next.unresolved.some((u) => u.field === "mechanisms"));
  });
});

describe("Compiler V2 mechanism matcher", () => {
  it("matches known kit keywords without inventing templates", () => {
    const hit = matchMechanismAgainstCatalog("本局使用权限交换：签字权换通行证");
    assert.ok(
      [MECHANISM_MATCH.MATCHED, MECHANISM_MATCH.PARTIAL_MATCH].includes(hit.status)
    );
    assert.ok(hit.templateKey || hit.family);
  });

  it("returns CUSTOM when no catalog hit", () => {
    const miss = matchMechanismAgainstCatalog("完全无关的一句天气描写而已");
    assert.equal(miss.status, MECHANISM_MATCH.CUSTOM_MECHANISM);
  });
});

describe("Compiler V2 scene resolver", () => {
  it("resolves locationHint only — does not invent scenes from empty timeline", async () => {
    const state = createEmptyCompilerV2State({ worldId: "w1" });
    state.timelineEvents = [
      {
        id: "ev1",
        title: "晚宴",
        locationHint: "玉满楼大厅",
        truthStatus: "UNCERTAIN",
        sourceRefs: []
      }
    ];
    const next = await stage4SceneResolver(state);
    assert.equal(next.scenes.length, 1);
    assert.equal(next.scenes[0].name, "玉满楼大厅");
    assert.equal(next.timelineEvents[0].locationId, next.scenes[0].id);
  });
});

describe("Compiler V2 integrity", () => {
  it("flags missing character scripts", async () => {
    const state = createEmptyCompilerV2State({ worldId: "w1" });
    state.characters = [{ id: "c1", name: "沈", nameStatus: "AUTO_DETECTED" }];
    state.characterScripts = [];
    const next = await stage8IntegrityValidator(state);
    assert.ok(next.unresolved.some((u) => u.field === "character.script:c1"));
  });

  it("rejects fallback Act titles", async () => {
    const state = createEmptyCompilerV2State({ worldId: "w1" });
    state.acts = [{ id: "a1", title: "主持手册", explicit: false }];
    const next = await stage8IntegrityValidator(state);
    assert.ok(next.unresolved.some((u) => String(u.field).includes("fallbackForbidden")));
  });
});

describe("Compiler V2 Opening Package pipeline", () => {
  it("uses upload slots for kinds; no cross-talk; explicit acts only", async () => {
    const hostText = [
      "《玉满楼奇案》组织者手册",
      "本局为4人硬核推理",
      "共2幕",
      "第一幕",
      "宾客齐聚。",
      "第二幕",
      "众人搜查。"
    ].join("\n");

    const state = await runCompilerV2Pipeline(
      createEmptyCompilerV2State({ worldId: "w-test", jobId: "j-test" }),
      {
        toStage: "clue_asset",
        inputFiles: {
          rightsConfirmed: true,
          creationType: "murder_mystery",
          hostHandbook: { filename: "host.txt", text: hostText },
          roleScripts: [
            {
              filename: "沈砚秋.txt",
              characterName: "沈砚秋",
              text: "第一幕\n我是医生。\n第二幕\n我要查清死因。"
            },
            {
              filename: "白斋子.txt",
              characterName: "白斋子",
              text: "第一幕\n我是才子。\n第二幕\n我去玉满楼。"
            }
          ],
          clueTextFiles: [
            {
              filename: "clues.txt",
              text: "血手帕\n\n一块染血的手帕。"
            }
          ]
        }
      }
    );

    assert.equal(state.project.title, "玉满楼奇案");
    assert.equal(state.project.titleStatus, DETECTION_STATUS.AUTO_DETECTED);
    assert.equal(state.characters.length, 2);
    assert.deepEqual(
      state.characters.map((c) => c.name).sort(),
      ["沈砚秋", "白斋子"]
    );
    assert.ok(state.documents.every((d) => d.kindSource === "upload_slot" || d.slot));
    assert.ok(state.characterScripts.length >= 2);
    for (const s of state.characterScripts) {
      const doc = state.documents.find((d) => d.id === s.documentId);
      const ch = state.characters.find((c) => c.id === s.characterId);
      assert.equal(doc.characterId, ch.id);
      assert.equal(doc.roleName, ch.name);
    }
    assert.ok(state.acts.every((a) => a.explicit === true));
    assert.ok(!state.acts.some((a) => a.title === "灵石" || a.title === "主持手册" || a.title === "未分幕"));
    assert.deepEqual(
      state.acts.map((a) => a.title).sort(),
      ["第一幕", "第二幕"]
    );
    assert.ok(state.clues.length >= 1);
    assert.ok(state.clues.every((c) => c.sourceSlot === "clueText" || c.sourceSlot === "clueImage"));
    assert.equal(state.timelineEvents.length, 0);
    assert.equal(state.job.status, "needs_review");
    assert.equal(state.job.currentStage, "clue_asset");
  });

  it("does not invent characters or fallback acts when roleScripts empty", async () => {
    const state = await runCompilerV2Pipeline(
      createEmptyCompilerV2State({ worldId: "w2", jobId: "j2" }),
      {
        toStage: "manuscript_ingest",
        inputFiles: {
          hostHandbook: {
            filename: "host.txt",
            text: "《青楼》\n四男三女\n没有第N幕标题的前言。"
          },
          roleScripts: []
        }
      }
    );
    assert.equal(state.project.title, "青楼");
    assert.equal(state.characters.length, 0);
    assert.equal(state.characterScripts.length, 0);
    assert.equal(state.acts.length, 0);
    assert.ok(state.unresolved.some((u) => u.field === "roleScripts"));
    assert.ok(state.unresolved.some((u) => u.field === "acts"));
  });
});

describe("Compiler V2 Stage 3A Host TRUE Timeline (no live LLM)", () => {
  it("stays empty with NEEDS_LLM when enableTimelineLlm is off", async () => {
    const state = await runCompilerV2Pipeline(
      createEmptyCompilerV2State({ worldId: "w3", jobId: "j3" }),
      {
        toStage: "timeline_compiler",
        enableTimelineLlm: false,
        inputFiles: {
          hostHandbook: {
            filename: "host.txt",
            text: "《长生叹》\n第一幕\n陶老板被砸死。\n第二幕\n墓室啼哭。"
          },
          roleScripts: []
        }
      }
    );
    assert.equal(state.timelineEvents.length, 0);
    assert.ok(state.unresolved.some((u) => u.field === "timelineEvents"));
  });

  it("chunks host source sections and scores gold coverage", async () => {
    const { buildHostTimelineChunks } = await import("../src/compiler-v2/host-true-timeline.js");
    const {
      scoreHostTrueTimeline,
      CHANGSHENG_HOST_TRUE_GOLD
    } = await import("../src/compiler-v2/benchmarks/changsheng-host-true-gold.js");

    const state = createEmptyCompilerV2State({ worldId: "w4" });
    state.documents = [{ id: "doc_host", kind: "HOST_BOOK", text: "x".repeat(100) }];
    state.sourceSections = [
      { id: "s1", documentId: "doc_host", originalText: "a".repeat(3000) },
      { id: "s2", documentId: "doc_host", originalText: "b".repeat(3000) },
      { id: "s3", documentId: "doc_host", originalText: "c".repeat(3000) }
    ];
    const chunks = buildHostTimelineChunks(state, { maxChars: 5500 });
    assert.ok(chunks.length >= 2);

    const fakeEvents = [
      {
        id: "e1",
        order: 1,
        title: "拍卖会陶老板被吊灯砸死",
        summary: "拍卖会上玻璃吊灯砸死陶老板。",
        sourceSectionIds: ["s1"],
        evidenceQuote: "吊灯砸"
      },
      {
        id: "e2",
        order: 2,
        title: "杨峥揭下人皮面具",
        summary: "杨峥揭下人皮面具。",
        sourceSectionIds: ["s2"],
        evidenceQuote: "人皮面具"
      }
    ];
    const score = scoreHostTrueTimeline(fakeEvents, CHANGSHENG_HOST_TRUE_GOLD, {
      sourceSections: [
        { id: "s1", originalText: "拍卖会玻璃吊灯砸死陶老板" },
        { id: "s2", originalText: "杨峥揭下人皮面具" }
      ]
    });
    assert.ok(score.coverage.covered >= 2);
    assert.equal(score.sourceRefs.withRefs, 2);
  });
});
