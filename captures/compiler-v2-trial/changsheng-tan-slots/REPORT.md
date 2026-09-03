# Compiler V2 试跑：changsheng-tan-slots

来源：Opening Package 槽位：data-zhimu/changsheng-tan/{主持人.txt + 6 角色.txt}；不猜归属；toStage=clue_asset

状态：**needs_review** · stoppedAt=`clue_asset+integrity` · 123ms

### Acceptance checklist (no LLM)

| Check | Result |
|---|---|
| Project title HIGH / null | `长生叹` / AUTO_DETECTED |
| Characters from slots only | 6 |
| CharacterScript cross-talk | PASS 0 |
| Acts explicit 第N幕 only | 第一幕, 第二幕, 第三幕 |
| Clues from clue slots | 0 (files: none) |
| SourceSection max chars | 1795 (avg 634) |

## Project

```json
{
  "worldId": "trial_changsheng-tan-slots",
  "title": "长生叹",
  "titleStatus": "AUTO_DETECTED",
  "playerCount": 6,
  "playerCountStatus": "AUTO_DETECTED",
  "actCount": 3,
  "actCountStatus": "AUTO_DETECTED",
  "creationType": "murder_mystery",
  "titleSuggestion": null
}
```

## Counts

```json
{
  "documents": 8,
  "characters": 6,
  "acts": 3,
  "characterScripts": 6,
  "sourceSections": 260,
  "timelineEvents": 0,
  "scenes": 0,
  "clues": 0,
  "characterCores": 0,
  "mechanisms": 0,
  "warnings": 3,
  "unresolved": 1
}
```

## Characters

```json
[
  {
    "name": "张九孚",
    "nameStatus": "AUTO_DETECTED",
    "nameSource": "upload_slot",
    "scriptCount": 1,
    "documentFilename": "张九孚.txt"
  },
  {
    "name": "杨峥",
    "nameStatus": "AUTO_DETECTED",
    "nameSource": "upload_slot",
    "scriptCount": 1,
    "documentFilename": "杨峥.txt"
  },
  {
    "name": "白初",
    "nameStatus": "AUTO_DETECTED",
    "nameSource": "upload_slot",
    "scriptCount": 1,
    "documentFilename": "白初.txt"
  },
  {
    "name": "陶梦芸",
    "nameStatus": "AUTO_DETECTED",
    "nameSource": "upload_slot",
    "scriptCount": 1,
    "documentFilename": "陶梦芸.txt"
  },
  {
    "name": "顾怀晨",
    "nameStatus": "AUTO_DETECTED",
    "nameSource": "upload_slot",
    "scriptCount": 1,
    "documentFilename": "顾怀晨.txt"
  },
  {
    "name": "黎小曼",
    "nameStatus": "AUTO_DETECTED",
    "nameSource": "upload_slot",
    "scriptCount": 1,
    "documentFilename": "黎小曼.txt"
  }
]
```

## Acts

```json
[
  {
    "title": "第一幕",
    "explicit": true
  },
  {
    "title": "第二幕",
    "explicit": true
  },
  {
    "title": "第三幕",
    "explicit": true
  }
]
```

## Cross-talk

```json
[]
```

## Sample character scripts

```json
[
  {
    "character": "张九孚",
    "title": "未分幕",
    "bodyPreview": "你从墓中醒来，你的记忆似乎受到了严重的影响 （旁白）光影摇晃，晕倒在地的你们缓缓睁开眼，眼前看上去像是一座墓室。这 墓室中的地砖尽是雕花的汉白玉，地砖上刻满了奇异的纹路，而这些纹路正引向 不远处倾斜向",
    "documentId": "doc_f6ef1179e52a4e13",
    "sourceSectionIds": [
      "src_bdb6ffadb2de4f7e",
      "src_36644f0e44c34bec",
      "src_16f15b31bfb145f9",
      "src_15c17dbd89e943bb",
      "src_2d006cc51d034458",
      "src_9848a2cf1ad140bb",
      "src_5bd90e20ab7742ba",
      "src_fb44de202df34e25",
      "src_bcd5e49d69624667",
      "src_ba4947ec95ae451e",
      "src_1910e0ca170646ce",
      "src_0d90ea88df9341e6",
      "src_e69cc64ebf284b5c",
      "src_ad11fba738064957",
      "src_6a08a4459e6f46c4",
      "src_08f8871c10234f45",
      "src_f0b47ebfcd694462",
      "src_579b447b9bf44d4f",
      "src_d8d150374e604db1",
      "src_9b0c41b767f74fe0",
      "src_e153df5c82ce4cd7",
      "src_43618fafa08848dd",
      "src_bf7d6fdaac6d4897",
      "src_dfc4096cd95c4609",
      "src_f006ff8573124776",
      "src_30b134f0cbef4ce7",
      "src_66ef5111679f41e8",
      "src_f06fecf687814fa1",
      "src_d1f18c60fe144307",
      "src_0ab6cb5fb4de440f",
      "src_3d434e9264c140f0",
      "src_b1f9909aea064689",
      "src_4a5145ae0c42420d",
      "src_a0ca60df30984512",
      "src_17f0362dbca94ca1",
      "src_a1ce6b01a6f84982",
      "src_40a40bfe095d4966"
    ]
  },
  {
    "character": "杨峥",
    "title": "未分幕",
    "bodyPreview": "你从墓中醒来，你的记忆似乎受到了严重的影响 （旁白）光影摇晃，晕倒在地的你们缓缓睁开眼，眼前看上去像是一座墓室。这 墓室中的地砖尽是雕花的汉白玉，地砖上刻满了奇异的纹路，而这些纹路正引向 不远处倾斜向",
    "documentId": "doc_4b0038ab4db74506",
    "sourceSectionIds": [
      "src_9d2f43df53334ea1",
      "src_9bfcf51b29ca4fdf",
      "src_e7cb2c1e99d543d1",
      "src_f364eec93c724054",
      "src_2a246364b5de4945",
      "src_2d586ee568be48e8",
      "src_2231c2b590c74d13",
      "src_a732936f08d14bad",
      "src_86efbcb3c57142a9",
      "src_5b15b2755b784d9c",
      "src_0a8c417a8f534cb3",
      "src_0ef848358bbf435b",
      "src_1cefe09d86434ce3",
      "src_f705f8b6b3cb4356",
      "src_561935bddad244a1",
      "src_380a308ef2c1448c",
      "src_8ea3b96701354f93",
      "src_240dee9ff4934956",
      "src_9bd8d611b8174f20",
      "src_08138728a27048a3",
      "src_9ba14a988a5340bc",
      "src_cf19797e1ec4460f",
      "src_6b147578e3034926",
      "src_8934b7629966461f",
      "src_0e41001c0dbe4ea2",
      "src_740be0b4f35a44f9",
      "src_3fe198cb10ec4230",
      "src_d47eb430b86c4842",
      "src_80a963d16efd42f0",
      "src_41bc0dafdcc74070",
      "src_e42f5b68416f4600",
      "src_15106cbf181c4c79"
    ]
  },
  {
    "character": "白初",
    "title": "未分幕",
    "bodyPreview": "你从墓中醒来，你的记忆似乎受到了严重的影响 （旁白）光影摇晃，晕倒在地的你们缓缓睁开眼，眼前看上去像是一座墓室。这 墓室屮的地砖尽是雕花的汉白玉，地砖上刻满了奇异的纹路，而这些纹路正引向 不远处倾斜向",
    "documentId": "doc_66f1cc7c1b314074",
    "sourceSectionIds": [
      "src_51cd195b14ee4b79",
      "src_ca103f72747246dd",
      "src_859b1eabc20e4a0c",
      "src_c4048e90fd8f4e8f",
      "src_3b2018b3f9e5406f",
      "src_6ee032b4c7a64f79",
      "src_2eb314240fa94eb4",
      "src_a79360ed0ad04b5a",
      "src_9e7441a1814f4eec",
      "src_697602dbccf748ce",
      "src_23fe4e2374a94022",
      "src_54c676ed49834867",
      "src_f8a21b974ebe4cb8",
      "src_890d891dfb984a29",
      "src_64f0d139e477431f",
      "src_7387be7e28b24547",
      "src_6ba38327df9f4f24",
      "src_44f9fe1c5235455f",
      "src_6adb297c57594597",
      "src_8087fd4deb284899",
      "src_92712f0bbc0748ba",
      "src_7bc10a713f2241b2",
      "src_41c3958b43484dc8",
      "src_62b1eb5f8ba2412c",
      "src_36f7cf3bdbba4ca7",
      "src_41bf91c95f754deb",
      "src_7733f4a7fd234539",
      "src_22d9920fce4c489d",
      "src_11cf18db1b1d4c4a",
      "src_bb6ea5273daf46b4",
      "src_a7536833a1134b43",
      "src_f426d96c01074719",
      "src_6037c08a9c0f4768",
      "src_a489dc40f5f44023",
      "src_112340d936d444f2",
      "src_f571792094074a38",
      "src_6abf8d73c2844efb",
      "src_96efe1c063024e4c"
    ]
  },
  {
    "character": "陶梦芸",
    "title": "未分幕",
    "bodyPreview": "你从墓中醒来，你的记忆似乎受到了严重的影响 （旁白）光影摇晃，晕倒在地的你们缓缓睁开眼，眼前看上去像是一座墓室。这 墓室中的地砖尽是雕花的汉白玉，地砖上刻满了奇异的纹路，而这些纹路正引向 不远处倾斜向",
    "documentId": "doc_0112c00b78bf4c09",
    "sourceSectionIds": [
      "src_e25a891ceda64450",
      "src_84749f5fe8ec40ed",
      "src_e39bb296463e4ae1",
      "src_3c5ce18a5d4f492f",
      "src_9ef3228ad6394b48",
      "src_10761020c3d84f92",
      "src_19c1127926594031",
      "src_7c180b65aa7a4025",
      "src_bd1abefcc7554388",
      "src_81c3c4d37d3049b0",
      "src_ae261078edad421f",
      "src_e03f842fb48a49ea",
      "src_172a3d4533ce4f7c",
      "src_64bac79c9aad4520",
      "src_1341e2918afd46c2",
      "src_02f974e20df44074",
      "src_b3763acd2d8a48cc",
      "src_0b772fa4f060499c",
      "src_e3dd86b3a4aa422b",
      "src_611c1ae05e88499b",
      "src_6d6d341343964718",
      "src_8731ee71bed84cf5",
      "src_261929e0d85d4c7c",
      "src_b03b6cc1faad4b1f",
      "src_7f948e3cdb004d3f",
      "src_8cb656ea81df4083",
      "src_f039abc8c9f14393",
      "src_c5019343fbb44d6f",
      "src_00c1517643054ef6",
      "src_bc37e6034c934500",
      "src_9158f75f93424128",
      "src_b17917627d8e4969",
      "src_377edfbe38b64b87"
    ]
  },
  {
    "character": "顾怀晨",
    "title": "未分幕",
    "bodyPreview": "你从墓中醒来，你的记忆似乎受到了严重的影响 （旁白）光影摇晃，晕倒在地的你们缓缓睁开眼，眼前看上去像是一座墓室。这 墓室中的地砖尽是雕花的汉白玉，地砖上刻满了奇异的纹路，而这些纹路正引向 不远处倾斜向",
    "documentId": "doc_be03561e228e449e",
    "sourceSectionIds": [
      "src_4141d4703129446c",
      "src_afcab06599c84ef8",
      "src_7d847c7db3314a62",
      "src_75f65b7d4f3c497e",
      "src_c30177e9756d4091",
      "src_c10ab0359f0443f9",
      "src_ec2dbccf99224e2e",
      "src_40bf98a6295c4491",
      "src_881fc06ffcb54b05",
      "src_01104d92bd474aa2",
      "src_b04e37e5efa44d30",
      "src_4f840f94f32946df",
      "src_3ae52de5dde54e7f",
      "src_5a328f637e1548fd",
      "src_76e456d59d7b4fae",
      "src_fcbc2bd1cf404f80",
      "src_bc653b596e074629",
      "src_c82ce7f1eb744035",
      "src_ceb0e5596eb24360",
      "src_c2256ab186044d6c",
      "src_2b3ac5f5d66842e0",
      "src_75b5c28ae71b49fc",
      "src_fa63f1c9a0504cb6",
      "src_5a73f679caec405a",
      "src_361be4d160e04512",
      "src_8c627071e20f49b2",
      "src_1248aaa890de4f3a",
      "src_4a25d1d7368e4744",
      "src_5fff9fbbe4074594",
      "src_eaf01ddeb522485d",
      "src_faab19aa6a344623"
    ]
  },
  {
    "character": "黎小曼",
    "title": "未分幕",
    "bodyPreview": "你从墓中醒来，你的记忆似乎受到了严重的影响 （旁白）光影摇晃，晕倒在地的你们缓缓睁开眼，眼前看上去像是一座墓室。这 墓室中的地砖尽是雕花的汉白玉，地砖上刻满了奇异的纹路，而这些纹路正引向 不远处倾斜向",
    "documentId": "doc_7eeffc387cc8410f",
    "sourceSectionIds": [
      "src_f7d3f3f23b334e9e",
      "src_297f91d3ae9f4ea5",
      "src_a25057e86b074a3f",
      "src_326c829b1afa42c0",
      "src_cac6a6c7b3644872",
      "src_1c708bc228dc46ce",
      "src_d7a57291bfb14a89",
      "src_90224d664392468d",
      "src_8d4151f6a75b4ba9",
      "src_a4bdb99442014d87",
      "src_bf5e10de2ae84361",
      "src_5b6a4c474ba944b8",
      "src_e5c2ac79abfc42fd",
      "src_2eaaa52b69e146b0",
      "src_0e1783d78a224a5d",
      "src_6ad3141718d1462e",
      "src_6bdd6483c21341d2",
      "src_6a156a81c475458d",
      "src_3db69034ddab476f",
      "src_2b071da0e8f349a1",
      "src_7d9ad2748c4e48af",
      "src_a3fa71b43d484179",
      "src_38c0a76868e04519",
      "src_cd7ac76bab5b450a",
      "src_e5fa94293c694036",
      "src_60745d45f4554001",
      "src_9ef6ed73d3d342ba",
      "src_20d5bed565fc4baa",
      "src_d2b2f0ee3ac845b6",
      "src_47912513e5c648a7",
      "src_22e6033be692416d",
      "src_f1112d3b0fed4184",
      "src_dd0ebef9aac542cd",
      "src_cecdbd475d334369"
    ]
  }
]
```

## Sample source sections

```json
[
  {
    "headingPath": [
      "Live Action"
    ],
    "preview": "《长生叹》主持人手册",
    "chars": 10,
    "offsets": [
      19,
      29
    ]
  },
  {
    "headingPath": [
      "冃U言1："
    ],
    "preview": "本剧本为6人剧本，分为3男3女，预计总游戏时长为4小时-4. 5小时。 前言2： 《长生叹》为体验情感的沉浸式剧本，所以玩家性别全部不建议反串。（手册后 续内容",
    "chars": 93,
    "offsets": [
      55,
      148
    ]
  },
  {
    "headingPath": [
      "前言3："
    ],
    "preview": "游戏开始前，请主持人确认好剧本、线索等内容齐全，并已完整阅读主持人手册, 清楚熟悉流程后再进行游戏。 感谢您玩我的游戏，祝您游戏愉快!",
    "chars": 68,
    "offsets": [
      156,
      224
    ]
  },
  {
    "headingPath": [
      "咅频联系售后领取"
    ],
    "preview": "若有其他剧本相关问题，请添加微信号：LARPshouhou,联系LARP售后。",
    "chars": 39,
    "offsets": [
      326,
      365
    ]
  },
  {
    "headingPath": [
      "1、背景故事:"
    ],
    "preview": "兵荒马乱的民国年间，局势动荡，政治波云诡谪，百姓民不聊生。 民国18年，长沙迎来了漫长的雨季。有一身穿黑色长袍的诗人慕名来到一 处山庄，望着门前的半座石雕沉思许",
    "chars": 287,
    "offsets": [
      396,
      683
    ]
  },
  {
    "headingPath": [
      "2、人物介绍及分发剧本："
    ],
    "preview": "（注意：《长生叹》为沉浸式情感本，请主持人尽量根据玩家的性格来分 配对应角色，以便于玩家沉浸代入情感。括号中的内容为帮助主持人为玩家分 配角色时使用，请不要念出",
    "chars": 327,
    "offsets": [
      699,
      1026
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
    "stage": "manuscript_ingest",
    "code": "ACT_UNASSIGNED_SCRIPTS",
    "message": "6 段角色剧本未检出明确幕标题（actId=null，未造假幕）"
  },
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
