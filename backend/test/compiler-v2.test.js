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
    assert.equal(state.stageSchema, null);
    assert.equal(state.stageSchemaProposal, null);
    assert.equal(COMPILER_V2_STAGES.length, 9);
    assert.ok(COMPILER_V2_STAGES.includes("canon_memory"));
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

  it("builds overlapping coverage windows and scores gold coverage", async () => {
    const { buildCoverageWindows } = await import("../src/compiler-v2/host-timeline/windows.js");
    const {
      scoreHostTrueTimelineV2,
      CHANGSHENG_HOST_TRUE_GOLD
    } = await import("../src/compiler-v2/benchmarks/changsheng-host-true-gold.js");

    const sections = Array.from({ length: 10 }, (_, i) => ({
      id: `s${i + 1}`,
      originalText: `section ${i + 1}`
    }));
    const windows = buildCoverageWindows(sections, { windowSize: 6, overlap: 2 });
    assert.ok(windows.length >= 2);
    assert.equal(windows[0].sections.length, 6);
    assert.ok(windows[1].sectionIds.includes("s5"));

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
    const score = scoreHostTrueTimelineV2({
      candidates: fakeEvents.map((e, i) => ({ candidateId: `c${i}`, ...e })),
      canonicalEvents: fakeEvents,
      displayGroups: [{ id: "g1", eventIds: ["e1", "e2"], title: "主线" }],
      sourceDispositions: [
        { sourceSectionId: "s1", type: "TIMELINE" },
        { sourceSectionId: "s2", type: "TIMELINE" }
      ],
      candidateDispositions: [
        { candidateId: "c0", type: "CANONICAL" },
        { candidateId: "c1", type: "CANONICAL" }
      ],
      hostSectionIds: ["s1", "s2"],
      gold: CHANGSHENG_HOST_TRUE_GOLD,
      sourceSections: [
        { id: "s1", originalText: "拍卖会玻璃吊灯砸死陶老板" },
        { id: "s2", originalText: "杨峥揭下人皮面具" }
      ]
    });
    assert.ok(score.coverage.covered >= 2);
    assert.equal(score.sourceRefs.withRefs, 2);
    assert.equal(score.v2.silentCandidateLoss, 0);
    assert.equal(score.v2.canonicalDisplayPreservation.rate, 1);
  });

  it("StoryMemory patch + relevant select + no silent candidate loss", async () => {
    const {
      createEmptyStoryMemory,
      applyMemoryPatch,
      selectRelevantMemory
    } = await import("../src/compiler-v2/host-timeline/story-memory.js");
    const {
      ensureCandidateDispositions,
      ensureFullSourceDispositions
    } = await import("../src/compiler-v2/host-timeline/audit.js");
    const { buildTimelineDisplayGroups } = await import(
      "../src/compiler-v2/host-timeline/pass3-display.js"
    );
    const { reconcileCandidatesDeterministic } = await import(
      "../src/compiler-v2/host-timeline/pass2-temporal.js"
    );

    let mem = createEmptyStoryMemory();
    mem = applyMemoryPatch(mem, {
      addEvents: [{ id: "m1", title: "陶老板之死", summary: "吊灯" }],
      addCharacters: [{ name: "杨峥" }],
      addLocations: [{ name: "墓室" }]
    });
    assert.equal(mem.version, 1);
    assert.equal(mem.knownEvents.length, 1);

    const slice = selectRelevantMemory(mem, {
      mentionedCharacters: ["杨峥"],
      recentEventLimit: 5
    });
    assert.ok(slice.characters.some((c) => c.name === "杨峥"));

    const candidates = [
      {
        candidateId: "cand_a",
        title: "啼哭危机",
        summary: "婴儿啼哭导致晕倒",
        importance: "DETAIL",
        sourceSectionIds: ["src1"],
        participantNames: [],
        confidence: "HIGH"
      },
      {
        candidateId: "cand_b",
        title: "人皮面具",
        summary: "杨峥揭面具",
        importance: "CORE",
        sourceSectionIds: ["src2"],
        participantNames: ["杨峥"],
        confidence: "HIGH"
      }
    ];
    // Pass2 omitted cand_a → must recover, not silent drop
    const ensured = ensureCandidateDispositions(candidates, [
      { candidateId: "cand_b", type: "CANONICAL" }
    ]);
    assert.equal(ensured.silentLossCount, 1);
    assert.ok(ensured.dispositions.some((d) => d.candidateId === "cand_a"));

    const disp = ensureFullSourceDispositions(["src1", "src2", "src3"], [
      { sourceSectionId: "src1", type: "TIMELINE", linkedCandidateIds: ["cand_a"] }
    ]);
    assert.equal(disp.missingSectionIds.length, 2);
    assert.equal(disp.dispositions.length, 3);

    const recon = reconcileCandidatesDeterministic(candidates);
    assert.equal(recon.canonicalEvents.length, 2);
    const groups = buildTimelineDisplayGroups(recon.canonicalEvents);
    const covered = new Set(groups.flatMap((g) => g.eventIds));
    assert.equal(covered.size, recon.canonicalEvents.length);
  });

  it("V2 pipeline with mocked LLM keeps host-only + disposition coverage", async () => {
    const { extractHostTrueTimelineV2 } = await import(
      "../src/compiler-v2/host-timeline/pipeline.js"
    );
    const state = createEmptyCompilerV2State({ worldId: "w5" });
    state.documents = [
      { id: "doc_host", kind: "HOST_BOOK", text: "主持全文" },
      { id: "doc_role", kind: "CHARACTER_BOOK", text: "角色私货：其实是凶手" }
    ];
    state.characters = [{ id: "c1", name: "杨峥" }];
    state.sourceSections = [
      {
        id: "src1",
        documentId: "doc_host",
        headingPath: ["开场"],
        originalText: "众人在墓室苏醒，失忆。"
      },
      {
        id: "src2",
        documentId: "doc_host",
        headingPath: ["案发"],
        originalText: "拍卖会陶老板被吊灯砸死。"
      },
      {
        id: "src3",
        documentId: "doc_host",
        headingPath: ["规则"],
        originalText: "搜证规则说明。"
      },
      {
        id: "src_role",
        documentId: "doc_role",
        headingPath: ["私货"],
        originalText: "角色本不应进入真相。"
      }
    ];

    let call = 0;
    const requestJson = async () => {
      call += 1;
      if (call === 1) {
        // Pass 0
        return {
          value: {
            characters: [{ name: "杨峥", aliases: [], roleHint: null }],
            locations: ["墓室"],
            historicalPhases: [],
            plotPhases: [{ id: "p1", label: "开场", summary: "苏醒" }],
            majorIncidents: [{ label: "陶老板之死", hint: "吊灯" }],
            truthSections: ["真相章"],
            unresolvedTopics: []
          },
          usage: null
        };
      }
      // Pass 1 windows — return events for current call sections via generic payload
      return {
        value: {
          events: [
            {
              title: "墓室苏醒",
              summary: "众人在墓室苏醒失忆",
              importance: "CORE",
              confidence: "HIGH",
              sourceSectionIds: ["src1"],
              participantNames: [],
              evidenceQuote: "墓室苏醒"
            },
            {
              title: "陶老板被砸死",
              summary: "拍卖会吊灯砸死陶老板",
              importance: "CORE",
              confidence: "HIGH",
              sourceSectionIds: ["src2"],
              participantNames: [],
              evidenceQuote: "吊灯"
            }
          ],
          memoryPatch: { addEvents: [{ title: "墓室苏醒" }] },
          sourceDispositions: [
            { sourceSectionId: "src1", type: "TIMELINE", linkedCandidateIds: [] },
            { sourceSectionId: "src2", type: "TIMELINE", linkedCandidateIds: [] },
            { sourceSectionId: "src3", type: "RULE", linkedCandidateIds: [] }
          ]
        },
        usage: null
      };
    };

    const result = await extractHostTrueTimelineV2(state, {
      requestJson,
      forceDeterministicPass2: true
    });

    assert.ok(result.events.length >= 1);
    assert.equal(result.meta.hostOnly, true);
    assert.equal(result.meta.sourceDispositionCoverage.rate, 1);
    assert.equal(result.meta.silentCandidateLoss, 0);
    assert.equal(result.meta.displayGroupCount, result.timelineDisplayGroups.length);
    // Role section must not appear in host dispositions
    assert.ok(!result.sourceDispositions.some((d) => d.sourceSectionId === "src_role"));
    assert.ok(!result.events.some((e) => (e.summary || "").includes("私货")));
  });
});

describe("Compiler V2 ManuscriptBoundaryResolver (no LLM)", () => {
  it("splits bound manuscript by repeating ①你的任务一 pattern", async () => {
    const {
      resolveManuscriptBoundaries,
      segmentsToOpeningPackageInput,
      SEGMENT_TYPE
    } = await import("../src/compiler-v2/manuscript-boundary-resolver.js");

    const paragraphs = [];
    const push = (text) => {
      paragraphs.push({
        index: paragraphs.length,
        text,
        textCompact: text.replace(/\s+/g, ""),
        styleId: null,
        isHeading: false,
        pageBreakBefore: false,
        maxFontHalfPoints: 20
      });
    };
    push("《青楼》组织者手册");
    push("开本流程");
    push("①你的任务一：出狱");
    push("第一章：玉满楼");
    push("所有人都称你为江南第一才子。");
    push("第四章：灵石");
    push("①你的任务一：出狱");
    push("第一章：玉满楼");
    push("五岁时你便在名剑山庄和剑打交道。");
    push("第四章：灵石");

    const result = resolveManuscriptBoundaries({
      paragraphs,
      characterNames: ["白斋子", "齐剑心"],
      minRoleChars: 5
    });
    const host = result.segments.find((s) => s.type === SEGMENT_TYPE.HOST);
    const roles = result.segments.filter((s) => s.type === SEGMENT_TYPE.CHARACTER);
    assert.ok(host);
    assert.equal(roles.length, 2);
    assert.equal(roles[0].characterName, "白斋子");
    assert.equal(roles[1].characterName, "齐剑心");
    assert.ok(roles[0].originalContent.includes("才子"));
    assert.ok(!roles[0].originalContent.includes("名剑山庄"));
    const opening = segmentsToOpeningPackageInput(result.segments);
    assert.equal(opening.roleScripts.length, 2);
  });

  it("does not treat inline role mentions as boundaries", async () => {
    const { findExactRoleHeadings } = await import(
      "../src/compiler-v2/manuscript-boundary-resolver.js"
    );
    const paragraphs = [
      {
        index: 0,
        text: "齐剑心看见莫怀走来。",
        textCompact: "齐剑心看见莫怀走来。",
        isHeading: false
      },
      { index: 1, text: "白斋子", textCompact: "白斋子", isHeading: true }
    ];
    const hits = findExactRoleHeadings(paragraphs, ["白斋子", "齐剑心", "莫怀"]);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].characterName, "白斋子");
  });
});

describe("Compiler V2 StageSchema (user confirmation)", () => {
  it("proposes shared stages and binds only after confirm", async () => {
    const {
      proposeStageSchemaFromRoleScripts,
      applyStageSchemaDecision,
      STAGE_SCHEMA_SOURCE,
      attachStageSchemaProposal
    } = await import("../src/compiler-v2/stage-schema.js");

    const roles = ["白斋子", "齐剑心", "莫怀"].map((name) => ({
      characterName: name,
      originalContent: [
        "①你的任务一",
        "第一章：玉满楼",
        "身世……",
        "第二章：灵石",
        "……",
        "第三章：魔石",
        "……",
        "第四章：夜阑 夜初",
        "结局"
      ].join("\n")
    }));

    const proposal = proposeStageSchemaFromRoleScripts(roles);
    assert.ok(proposal);
    assert.equal(proposal.items.map((i) => i.name).join("/"), "玉满楼/灵石/魔石/夜阑");
    assert.equal(proposal.source, STAGE_SCHEMA_SOURCE.PROPOSED);

    let state = createEmptyCompilerV2State({ worldId: "w1" });
    state.characterScripts = roles.map((r, i) => ({
      id: `cs_${i}`,
      characterId: `c_${i}`,
      originalContent: r.originalContent,
      sourceSectionIds: [`src_${i}_a`, `src_${i}_b`]
    }));
    state.sourceSections = roles.flatMap((r, i) =>
      ["玉满楼", "灵石", "魔石", "夜阑"].map((stage, j) => ({
        id: `src_${i}_${j}`,
        characterId: `c_${i}`,
        headingPath: [`第一章：${stage}`],
        originalText: "正文",
        title: `第一章：${stage}`
      }))
    );
    state = attachStageSchemaProposal(state, proposal);
    assert.ok(state.stageSchemaProposal);
    assert.ok(state.unresolved.some((u) => u.field === "stageSchema"));

    const confirmed = applyStageSchemaDecision(state, { decision: "confirm" });
    assert.equal(confirmed.stageSchema.source, STAGE_SCHEMA_SOURCE.USER_CONFIRMED);
    assert.equal(confirmed.stageSchema.items.length, 4);
    assert.equal(confirmed.stageSchemaProposal, null);
    assert.ok(!confirmed.unresolved.some((u) => u.field === "stageSchema"));
    assert.ok(confirmed.characterScripts[0].stageBindings?.length >= 4);
    assert.equal(confirmed.characterScripts[0].stageBindings[0].stageName, "玉满楼");
    assert.ok(confirmed.sourceSections.every((s) => s.stageId));

    const rejected = applyStageSchemaDecision(state, { decision: "reject" });
    assert.equal(rejected.stageSchema.source, STAGE_SCHEMA_SOURCE.REJECTED_AS_HEADINGS);
    assert.equal(rejected.stageSchema.items.length, 0);

    const manual = applyStageSchemaDecision(state, {
      decision: "manual",
      manualItems: [{ name: "序章" }, { name: "终章" }]
    });
    assert.equal(manual.stageSchema.source, STAGE_SCHEMA_SOURCE.MANUAL);
    assert.equal(manual.stageSchema.items.map((i) => i.name).join("/"), "序章/终章");
  });

  it("does not auto-create acts from shared stage chapter titles", async () => {
    const { detectSharedStageSchema } = await import(
      "../src/compiler-v2/manuscript-boundary-resolver.js"
    );
    const shared = detectSharedStageSchema([
      {
        originalContent: "第一章：玉满楼\nA\n第二章：灵石\nB"
      },
      {
        originalContent: "第一章：玉满楼\nC\n第二章：灵石\nD"
      }
    ]);
    assert.ok(shared);
    assert.deepEqual(shared.stages, ["玉满楼", "灵石"]);
    assert.equal(shared.suggestion, "SHARED_GAME_STAGES");
  });
});

describe("Compiler V2 — CanonMemory Stage 2.5", () => {
  it("audits source coverage and flags missing capsules", async () => {
    const { auditSourceCoverage } = await import("../src/compiler-v2/canon-memory/coverage.js");
    const sections = [
      { id: "s1", originalText: "墓室苏醒" },
      { id: "s2", originalText: "规则说明" }
    ];
    const capsules = [
      {
        id: "c1",
        sourceSectionId: "s1",
        type: "EVENT",
        events: [{ title: "苏醒", summary: "墓室苏醒" }]
      }
    ];
    const audit = auditSourceCoverage(sections, capsules);
    assert.equal(audit.total, 2);
    assert.equal(audit.covered, 1);
    assert.deepEqual(audit.missing, ["s2"]);
  });

  it("merges GlobalOutline + SectionCapsules into CanonMemory events", async () => {
    const { mergeCanonMemory } = await import("../src/compiler-v2/canon-memory/merge.js");
    const canon = mergeCanonMemory({
      globalOutline: {
        characters: [{ name: "杨峥", aliases: [], roleHint: null }],
        locations: ["墓室"],
        majorIncidents: []
      },
      sectionCapsules: [
        {
          id: "cap1",
          sourceSectionId: "src1",
          type: "EVENT",
          characters: ["杨峥"],
          locations: ["墓室"],
          events: [
            {
              title: "婴儿啼哭危机",
              summary: "墓室出现婴儿啼哭，玩家晕倒",
              importance: "DETAIL",
              sourceSectionIds: ["src1"]
            }
          ],
          mechanismHints: [],
          importantObjects: []
        }
      ],
      sourceCoverage: { total: 1, covered: 1, rate: 1, missing: [], suspicious: [] }
    });
    assert.equal(canon.events.length, 1);
    assert.equal(canon.characters.length, 1);
    assert.ok(canon.locations.includes("墓室"));
    assert.equal(canon.eventCount, 1);
  });

  it("scores G01–G14 gold presence from Canon events and capsule text", async () => {
    const { scoreCanonGoldPresence } = await import("../src/compiler-v2/canon-memory/gold-presence.js");
    const { CHANGSHENG_HOST_TRUE_GOLD } = await import(
      "../src/compiler-v2/benchmarks/changsheng-host-true-gold.js"
    );
    const canon = {
      events: [
        {
          id: "e1",
          title: "墓室苏醒失忆",
          summary: "众人在墓室苏醒，回忆拍卖",
          sourceSectionIds: ["s1"]
        },
        {
          id: "e2",
          title: "陶老板被吊灯砸死",
          summary: "拍卖会命案",
          sourceSectionIds: ["s2"]
        }
      ],
      sectionCapsules: [
        {
          summary: "婴儿啼哭导致晕倒",
          events: [],
          importantObjects: [],
          mechanismHints: []
        },
        {
          summary: "杨峥揭下人皮面具",
          events: [],
          importantObjects: ["人皮面具"],
          mechanismHints: []
        }
      ],
      sourceCoverage: { rate: 1 }
    };
    const score = scoreCanonGoldPresence(canon, { gold: CHANGSHENG_HOST_TRUE_GOLD });
    assert.ok(score.coverage.covered >= 4);
    assert.ok(score.coverage.eventOnly.covered >= 2);
  });

  it("compileCanonMemoryFromState with mocked LLM achieves full coverage", async () => {
    const { compileCanonMemoryFromState } = await import(
      "../src/compiler-v2/canon-memory/compiler.js"
    );
    const state = createEmptyCompilerV2State({ worldId: "w_canon" });
    state.documents = [{ id: "doc_host", kind: "HOST_BOOK", text: "主持" }];
    state.sourceSections = [
      {
        id: "src1",
        documentId: "doc_host",
        headingPath: ["开场"],
        originalText: "众人在墓室苏醒，失忆。"
      },
      {
        id: "src2",
        documentId: "doc_host",
        headingPath: ["案发"],
        originalText: "拍卖会陶老板被吊灯砸死。"
      },
      {
        id: "src3",
        documentId: "doc_host",
        headingPath: ["规则"],
        originalText: "搜证与投凶规则。"
      }
    ];

    let call = 0;
    const requestJson = async (_msgs, opts) => {
      call += 1;
      if (opts?.phase === "compiler-v2-canon-global-outline") {
        return {
          value: {
            characters: [{ name: "陶老板" }],
            locations: ["墓室"],
            majorIncidents: [{ label: "陶老板之死", sourceSectionIds: ["src2"] }]
          },
          usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 }
        };
      }
      const user = JSON.parse(_msgs[1].content);
      const sid = user.sourceSection?.id;
      const payloads = {
        src1: {
          type: "EVENT",
          events: [{ title: "墓室苏醒", summary: "墓室苏醒失忆", importance: "CORE" }]
        },
        src2: {
          type: "EVENT",
          events: [{ title: "陶老板之死", summary: "吊灯砸死陶老板", importance: "CORE" }]
        },
        src3: { type: "RULE", events: [], summary: "搜证投凶规则" }
      };
      return {
        value: payloads[sid] || { type: "NO_RELEVANT_CONTENT", events: [] },
        usage: { promptTokens: 40, completionTokens: 20, totalTokens: 60 }
      };
    };

    const result = await compileCanonMemoryFromState(state, {
      requestJson,
      useCache: false,
      enableRecovery: false,
      concurrency: 2
    });

    assert.equal(result.sourceCoverage.total, 3);
    assert.equal(result.sourceCoverage.covered, 3);
    assert.equal(result.sourceCoverage.missing.length, 0);
    assert.ok(result.canonMemory.events.length >= 2);
    assert.ok(call >= 4);
  });

  it("canon_memory stage skips LLM when not enabled", async () => {
    const { stage25CanonMemoryCompiler } = await import(
      "../src/compiler-v2/stages/stage25-canon-memory.js"
    );
    const state = createEmptyCompilerV2State({ worldId: "w6" });
    state.documents = [{ id: "h1", kind: "HOST_BOOK", text: "x" }];
    state.sourceSections = [
      { id: "s1", documentId: "h1", originalText: "正文" }
    ];
    const next = await stage25CanonMemoryCompiler(state, { enableLlm: false });
    assert.equal(next.canonMemory, null);
    assert.ok(next.unresolved.some((u) => u.field === "canonMemory"));
    assert.ok(next.job.completedStages.includes("canon_memory"));
  });

  it("Merge V2 promotes PROCESS/DECISION/BRANCH and lifts G03/G11/G12 knowledge", async () => {
    const { mergeCanonMemory } = await import("../src/compiler-v2/canon-memory/merge.js");
    const { scoreCanonGoldV2, GOLD_MATCH } = await import(
      "../src/compiler-v2/canon-memory/gold-scorer-v2.js"
    );
    const { CHANGSHENG_HOST_TRUE_GOLD_V2 } = await import(
      "../src/compiler-v2/benchmarks/changsheng-host-true-gold-v2.js"
    );

    const sections = [
      {
        id: "src_40446d1c175846be",
        originalText: "组织玩家进行第一轮取证，发放公共线索，搜证期间可私聊。投凶环节见后文。"
      },
      {
        id: "src_49fe822720af4a96",
        originalText:
          "此处为抉择的规则：现在长生水制造的阵法已经启动。存在多处死门和对应的生门。"
      },
      {
        id: "src_1882149f984f477e",
        originalText: "4、结局部分：根据玩家不同的抉择结果，来触发不同的结局。结局会根据分支触发旁白。"
      }
    ];
    const capsules = [
      {
        id: "c1",
        sourceSectionId: "src_40446d1c175846be",
        type: "RULE",
        summary: "第一轮取证与公共线索",
        events: [],
        characters: [],
        locations: [],
        importantObjects: [],
        mechanismHints: []
      },
      {
        id: "c2",
        sourceSectionId: "src_49fe822720af4a96",
        type: "RULE",
        summary: "生门死门抉择规则",
        events: [],
        characters: [],
        locations: [],
        importantObjects: [],
        mechanismHints: []
      },
      {
        id: "c3",
        sourceSectionId: "src_1882149f984f477e",
        type: "META",
        summary: "结局分支框架",
        events: [],
        characters: [],
        locations: [],
        importantObjects: [],
        mechanismHints: []
      }
    ];

    const canon = mergeCanonMemory({
      globalOutline: { majorIncidents: [], truthSections: [] },
      sectionCapsules: capsules,
      sourceSections: sections,
      sourceCoverage: { total: 3, covered: 3, rate: 1 }
    });

    assert.equal(canon.schemaVersion, 3);
    assert.ok(canon.nodes.some((n) => n.type === "PROCESS"));
    assert.ok(canon.nodes.some((n) => n.type === "DECISION"));
    assert.ok(canon.nodes.some((n) => n.type === "BRANCH"));

    const subset = CHANGSHENG_HOST_TRUE_GOLD_V2.filter((g) =>
      ["G03", "G11", "G12"].includes(g.id)
    );
    const scored = scoreCanonGoldV2(canon, { gold: subset });
    assert.equal(scored.counts.HIT, 3);
    assert.equal(scored.counts.MISS, 0);
    for (const d of scored.detail) {
      assert.equal(d.status, GOLD_MATCH.HIT);
    }
  });

  it("Promotion V1.2 maps STATIC_FACT/CLUE_REVEAL/META and keeps BRANCH strict", async () => {
    const { classifyCapsuleEvent } = await import(
      "../src/compiler-v2/canon-memory/needs-split.js"
    );
    const { promoteCapsuleToNodes } = await import("../src/compiler-v2/canon-memory/promote.js");
    const { detectEventBoundary } = await import(
      "../src/compiler-v2/canon-memory/event-boundary-detector.js"
    );

    const fact = classifyCapsuleEvent({
      title: "两人素颜几乎无法分辨",
      summary: "姐姐与妹妹素颜时几乎无法分辨，旁人常认错。"
    });
    assert.equal(fact.type, "FACT");

    const reveal = classifyCapsuleEvent({
      title: "尸体身份确认",
      summary: "根据线索确认两具尸体身份为某对夫妇。"
    });
    assert.equal(reveal.type, "REVEAL");

    const meta = classifyCapsuleEvent({
      title: "剧本简介，说明类型、人数、时长及核心机制特点",
      summary: "剧本简介，说明类型、人数、时长及核心机制特点。"
    });
    assert.equal(meta.skip, true);

    const outro = classifyCapsuleEvent({
      title: "结局彩蛋段，宣告游戏结束并预告续作，无实际剧情推进",
      summary: "宣告游戏结束并预告续作，无实际剧情推进。"
    });
    assert.equal(outro.skip, true);

    const none = promoteCapsuleToNodes({
      id: "c_meta",
      sourceSectionId: "src_meta",
      type: "META",
      summary: "开本前主持人介绍规则和背景，包含游戏机制提示和故事背景卡朗读。",
      events: [],
      importantObjects: [],
      mechanismHints: []
    });
    assert.equal(none.length, 0);

    const multi = detectEventBoundary({
      title: "误下毒与仇杀藏尸",
      summary:
        "误将毒药下给目标却被他人误饮；随后追人得知身世，一气之下致死并拖至草堆藏尸。"
    });
    assert.equal(multi.needsSplit, true);

    const keepMurder = detectEventBoundary({
      title: "夜潜杀人并嫁祸",
      summary: "潜入府中迷晕看守，杀害目标后布置嫁祸现场。"
    });
    assert.equal(keepMurder.needsSplit, false);
  });

  it("EventBoundaryDetector V1 splits multi-center campaigns, keeps continuous scenes", async () => {
    const { detectEventBoundary } = await import(
      "../src/compiler-v2/canon-memory/event-boundary-detector.js"
    );

    const multiPhase = detectEventBoundary({
      title: "张九孚接受任务调查明长陵",
      summary:
        "张九孚接受任务后南下调查，发现张家灭门案，拜访顾家，遇见傅月生。"
    });
    assert.equal(multiPhase.needsSplit, true);
    assert.ok(
      multiPhase.signals.some((s) =>
        ["GOAL_ACTION_CENTER", "ACTOR_CENTER", "OUTCOME_CENTER", "TEMPORAL_CENTER"].includes(s.kind)
      )
    );

    const campaign = detectEventBoundary({
      title: "傅月生复仇明朝",
      summary:
        "傅月生百年布局，协助清军，利用吴三桂，最终明朝覆灭。"
    });
    assert.equal(campaign.needsSplit, true);

    const parallel = detectEventBoundary({
      title: "17:00–17:10 白初布置现场，陆卿原假扮杨峥",
      summary: "白初布置现场；同时陆卿原假扮杨峥进入大厅。"
    });
    assert.equal(parallel.needsSplit, true);

    const continuous = detectEventBoundary({
      title: "17:30-17:40 顾怀辰潜入，陶梦芸呼救",
      summary: "顾怀辰潜入陶老板房间找长生水，被陶梦芸发现，陶梦芸呼救逃跑，顾怀辰追至二楼。"
    });
    assert.equal(continuous.needsSplit, false);
  });

  it("Promotion V3 flags OVER_MERGED and avoids generic reveal titles", async () => {
    const { detectNeedsSplit, classifyCapsuleEvent } = await import(
      "../src/compiler-v2/canon-memory/needs-split.js"
    );
    const { promoteCapsuleToNodes } = await import("../src/compiler-v2/canon-memory/promote.js");

    const over = detectNeedsSplit({
      title: "朱棣继续寻找长生水，死于途中",
      summary: "朱棣命人寻找，五年后朱棣死，未得长生水。"
    });
    assert.equal(over.needsSplit, true);

    const cleanEv = detectNeedsSplit({
      title: "17:50 杨峥探查陶老板房间",
      summary: "17:50，杨峥到陶老板房间查探长生水，但被陶老板拒绝鉴定。"
    });
    assert.equal(cleanEv.needsSplit, false);

    const notEvent = classifyCapsuleEvent({
      title: "揭示凶手",
      summary: "明确杀死陶老板的凶手是白初。"
    });
    assert.equal(notEvent.type, "REVEAL");

    const nodes = promoteCapsuleToNodes(
      {
        id: "c",
        sourceSectionId: "src_a73f",
        type: "BACKGROUND",
        summary: "本段叙述黎小曼离开、白初与陆卿原相救相恋、张九孚调查明长陵。",
        events: [],
        importantObjects: [],
        mechanismHints: []
      },
      { id: "src_a73f", originalText: "傅月生与人皮面具出现在远史叙述中，但本段不是揭示现场。" }
    );
    assert.equal(nodes.length, 0);
  });

  it("Splitter V1 proposes parallel/time splits without inventing facts", async () => {
    const { proposeEventSplit, applySplitProposal, validateSplitProposal } = await import(
      "../src/compiler-v2/canon-memory/splitter-v1.js"
    );

    const parallel = proposeEventSplit(
      {
        id: "e_par",
        title: "顾怀辰威胁假陶老板",
        summary:
          "18:25，白初出房间时被顾怀辰误认为陶老板并威胁，黎小曼出现使白初逃脱。同时张九孚与陶梦芸在大厅碰面。",
        sourceSectionIds: ["src_x"],
        needsSplit: true
      },
      { force: true }
    );
    assert.ok(parallel.proposal);
    assert.equal(parallel.proposal.reason, "PARALLEL_EVENT");
    assert.equal(parallel.proposal.children.length, 2);
    assert.ok(parallel.validation.ok);

    const time = proposeEventSplit(
      {
        id: "e_time",
        title: "朱棣继续寻找长生水，死于途中",
        summary: "朱棣心有不甘，命陶文庆继续寻找，五年后朱棣死，未得长生水。",
        sourceSectionIds: ["src_y"],
        needsSplit: true
      },
      { force: true }
    );
    assert.ok(time.proposal);
    assert.equal(time.proposal.reason, "TIME_SHIFT");

    const continuous = proposeEventSplit(
      {
        id: "e_ok",
        title: "17:30-17:40 顾怀辰潜入，陶梦芸呼救",
        summary: "顾怀辰潜入陶老板房间找长生水，被陶梦芸发现，陶梦芸呼救逃跑，顾怀辰追至二楼。",
        sourceSectionIds: ["src_z"],
        needsSplit: false
      },
      { force: false }
    );
    assert.equal(continuous.shouldSplit, false);

    assert.throws(() =>
      applySplitProposal(
        {
          id: "e_par",
          title: "顾怀辰威胁假陶老板",
          summary:
            "18:25，白初出房间时被顾怀辰误认为陶老板并威胁，黎小曼出现使白初逃脱。同时张九孚与陶梦芸在大厅碰面。",
          sourceSectionIds: ["src_x"]
        },
        parallel.proposal,
        { confirmed: false }
      )
    );
    const applied2 = applySplitProposal(
      {
        id: "e_par",
        title: "顾怀辰威胁假陶老板",
        summary:
          "18:25，白初出房间时被顾怀辰误认为陶老板并威胁，黎小曼出现使白初逃脱。同时张九孚与陶梦芸在大厅碰面。",
        sourceSectionIds: ["src_x"]
      },
      parallel.proposal,
      { confirmed: true }
    );
    assert.equal(applied2.ok, true);
    assert.equal(applied2.parent.status, "SPLIT_PARENT");
    assert.equal(applied2.children.length, 2);
    assert.ok(validateSplitProposal(applied2.parent, parallel.proposal).ok !== false);
  });

  it("Gold Scorer V2 rejects keyword hit without source overlap (FALSE_MATCH)", async () => {
    const { matchGoldEventV2, GOLD_MATCH, scoreCanonGoldV2 } = await import(
      "../src/compiler-v2/canon-memory/gold-scorer-v2.js"
    );
    const { CHANGSHENG_HOST_TRUE_GOLD_V2 } = await import(
      "../src/compiler-v2/benchmarks/changsheng-host-true-gold-v2.js"
    );

    const g01 = CHANGSHENG_HOST_TRUE_GOLD_V2.find((g) => g.id === "G01");
    const falseHit = matchGoldEventV2(g01, [
      {
        id: "e_wrong",
        title: "仪式进行与顾怀辰的牺牲",
        summary: "顾怀辰站在死门，墓室红光中苏醒般的仪式",
        sourceSectionIds: ["src_007b7327adda42db"]
      }
    ]);
    assert.equal(falseHit.status, GOLD_MATCH.FALSE_MATCH);

    const trueHit = matchGoldEventV2(g01, [
      {
        id: "e_ok",
        title: "众人苏醒于墓室",
        summary: "晕倒在地的你们缓缓睁开眼，眼前是一座墓室，什么也想不起来，失忆了",
        sourceSectionIds: ["src_8242083ac35d4313"]
      }
    ]);
    assert.equal(trueHit.status, GOLD_MATCH.HIT);

    const g13 = CHANGSHENG_HOST_TRUE_GOLD_V2.find((g) => g.id === "G13");
    const g08 = CHANGSHENG_HOST_TRUE_GOLD_V2.find((g) => g.id === "G08");
    const endingFalse = matchGoldEventV2(g13, [
      {
        id: "e_end",
        title: "顾怀辰生陶梦芸死的结局",
        summary: "日月山庄阵法中的结局分支",
        sourceSectionIds: ["src_da06485bea164206"]
      }
    ]);
    assert.equal(endingFalse.status, GOLD_MATCH.FALSE_MATCH);

    const g06 = CHANGSHENG_HOST_TRUE_GOLD_V2.find((g) => g.id === "G06");
    const partial = matchGoldEventV2(g06, [
      {
        id: "e_partial",
        title: "张九孚询问晕倒前的声音",
        summary: "张九孚问起晕倒前听到的声音",
        sourceSectionIds: ["src_51dd9e5b815f4f91"]
      }
    ]);
    assert.equal(partial.status, GOLD_MATCH.PARTIAL);

    const g08Joint = matchGoldEventV2(g08, [
      {
        id: "e_fu",
        title: "白初揭露顾怀辰身份",
        summary: "白初称呼顾怀辰为傅月生",
        sourceSectionIds: ["src_4d32c81f06b34f75"]
      },
      {
        id: "e_mask",
        title: "杨峥揭下人皮面具",
        summary: "杨峥缓缓揭下了自己的人皮面具",
        sourceSectionIds: ["src_4d32c81f06b34f75"]
      }
    ]);
    assert.equal(g08Joint.status, GOLD_MATCH.HIT);
    assert.ok(
      g08Joint.reason === "JOINT_NODES_CLAIMS_AND_SOURCE" ||
        g08Joint.reason === "NODE_CLAIMS_AND_SOURCE" ||
        g08Joint.reason === "JOINT_CLAIMS_ACROSS_IN_ZONE_EVENTS"
    );
    assert.ok(g08Joint.supportingEventIds.length >= 2);

    const scored = scoreCanonGoldV2({
      events: [
        {
          id: "e_ok",
          title: "众人苏醒于墓室",
          summary: "睁开眼看见墓室，什么也想不起来，失忆",
          sourceSectionIds: ["src_8242083ac35d4313"]
        }
      ]
    });
    assert.equal(scored.counts.HIT, 1);
    assert.ok(scored.counts.MISS + scored.counts.PARTIAL + scored.counts.FALSE_MATCH === 13);
  });
});
