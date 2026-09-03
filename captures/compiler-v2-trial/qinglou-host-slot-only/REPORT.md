# Compiler V2 试跑：qinglou-host-slot-only

来源：Opening Package：仅 hostHandbook=qinglou-v0.1.json BLK0–60 合并正文；roleScripts=[]（不启发式切角色）；无线索槽。验证：标题=青楼、不串台、不伪造幕/线索

状态：**needs_review** · stoppedAt=`clue_asset+integrity` · 33ms

### Acceptance checklist (no LLM)

| Check | Result |
|---|---|
| Project title HIGH / null | `青楼` / AUTO_DETECTED |
| Characters from slots only | 0 |
| CharacterScript cross-talk | PASS 0 |
| Acts explicit 第N幕 only | （空 — 无假 fallback Act） |
| Clues from clue slots | 0 (files: none) |
| SourceSection max chars | 1782 (avg 349) |

## Project

```json
{
  "worldId": "trial_qinglou-host-slot-only",
  "title": "青楼",
  "titleStatus": "AUTO_DETECTED",
  "playerCount": 7,
  "playerCountStatus": "AUTO_DETECTED",
  "actCount": null,
  "actCountStatus": "NEEDS_CONFIRMATION",
  "creationType": "murder_mystery",
  "titleSuggestion": null
}
```

## Counts

```json
{
  "documents": 2,
  "characters": 0,
  "acts": 0,
  "characterScripts": 0,
  "sourceSections": 89,
  "timelineEvents": 0,
  "scenes": 0,
  "clues": 0,
  "characterCores": 0,
  "mechanisms": 0,
  "warnings": 2,
  "unresolved": 4
}
```

## Characters

```json
[]
```

## Acts

```json
[]
```

## Cross-talk

```json
[]
```

## Sample character scripts

```json
[]
```

## Sample source sections

```json
[
  {
    "headingPath": [
      "美工：发阳"
    ],
    "preview": "本故事纯属虚构，版权所有，翻版必究。",
    "chars": 18,
    "offsets": [
      56,
      74
    ]
  },
  {
    "headingPath": [
      "★作者想对您说的话 ★"
    ],
    "preview": "这是我的第一部作品，如有不足之处，希望能得到您的建议及理解。 如您遇到问题时，还望您向我提出，我很重视玩家及店家的评价，同 时若是在您的带领下，收到了玩家们的好",
    "chars": 196,
    "offsets": [
      157,
      353
    ]
  },
  {
    "headingPath": [
      "★黑羽发行社 ★"
    ],
    "preview": "感谢您带领玩家体验《青楼》之旅，为了方便您更好地给予玩家游戏 体验，可以向我们咨询，我们会给您建议配乐的歌单、道具清单链接。 包括有关此剧本任何疑问都可以向我们",
    "chars": 85,
    "offsets": [
      365,
      450
    ]
  },
  {
    "headingPath": [
      "作者微信"
    ],
    "preview": "黑 羽 发 行 工 作 室 《青楼》 致给店家的一封信： 特别感谢您能在众多剧本中选择此剧本《青楼》，为了让您更好地带领玩家体验 《青楼》之旅，请您务必仔细阅读",
    "chars": 670,
    "offsets": [
      465,
      1135
    ]
  },
  {
    "headingPath": [
      "★剧本简介 ★"
    ],
    "preview": "此剧本《青楼》为四男三女的古装七人机制本，整本共四章，讲述的是一段发生 在唐朝年间的青楼之事。微变剧情，本格推凶，推理难度适中，可玩性较高，适 合中、高级玩家体",
    "chars": 270,
    "offsets": [
      1229,
      1499
    ]
  },
  {
    "headingPath": [
      "大唐监狱对应物品栏及杀人报备表×3张"
    ],
    "preview": "（普通版含以上道具，精装版比普通版多实体道具【魔石灵石】，如若店家并未 购买精装版，店家需自行用道具或灯光来代替此道具，建议购买精装版效果会更",
    "chars": 72,
    "offsets": [
      1609,
      1681
    ]
  }
]
```

## Sample clues

```json
[]
```

## Scenes / Mechanisms (should be empty without LLM / mechanism slot)

```json
{
  "scenes": [],
  "mechanisms": []
}
```

## Unresolved

```json
[
  {
    "stage": "project_identify",
    "kind": "NEEDS_CONFIRMATION",
    "field": "roleScripts",
    "message": "未上传角色剧本槽位；不会从主持手册猜测切分角色本"
  },
  {
    "stage": "project_identify",
    "kind": "NEEDS_CONFIRMATION",
    "field": "project.actCount",
    "message": "幕数无法从主持手册可靠解析，请确认"
  },
  {
    "stage": "manuscript_ingest",
    "kind": "NEEDS_CONFIRMATION",
    "field": "acts",
    "message": "未识别到明确幕结构（不造 fallback Act）"
  },
  {
    "stage": "timeline_compiler",
    "kind": "NEEDS_LLM",
    "field": "timelineEvents",
    "message": "主时间线 / 角色分支时间线需 LLM 提取；当前骨架未自动猜测事件。不确定项不得标 CONFIRMED。"
  }
]
```

## Warnings

```json
[
  {
    "stage": "scene_resolver",
    "code": "SCENE_EMPTY",
    "message": "尚无场景（需 Timeline locationHint 或后续 Scene 专用提取）；未从标题关键词伪造场景"
  },
  {
    "stage": "clue_asset",
    "code": "CLUE_EMPTY",
    "message": "线索槽位为空或未解析出线索卡（不会从主持/角色正文猜测线索）"
  }
]
```
