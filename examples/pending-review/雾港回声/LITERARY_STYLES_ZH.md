# 文风预设目录（v5.3）

> 代码权威来源：`backend/src/prompts/matrix-literary-styles.js`  
> 用法：`setting.literaryStyle = "<key>"` 或中文 label（如 `电影感文风`）

---

## 主流文风（12）

| key | 名称 | 节奏要点 |
|-----|------|----------|
| `light-novel` | 日式轻小说 | 短句、对话快、适度内心吐槽 |
| `three-body` | 三体文风 | 冷静、硬科幻质感、宏观微观对照 |
| `game` | 游戏文风 | 场景标签、任务驱动、可交互感 |
| `cinematic` | 电影感文风 | 镜头切镜、光影声场、少旁白 |
| `chunqiu` | 春秋文风 | 史笔、微言大义、极简练 |
| `minimal` | 极简文风 | 极短句、删形容词、留白 |
| `delicate` | 细腻文风 | 感官细节层层递进 |
| `web-novel` | 网文文风 | 钩子密、节奏快、信息密度高 |
| `horror` | 恐怖文风 | 未知先于解释、日常异化 |
| `luxun` | 鲁迅文风 | 冷峻讽刺、白描见骨 |
| `comedy` | 搞笑文风 | 反差误会，不破坏推理公平 |
| `classical` | 古风文风 | 半文半白，名物准确 |

---

## 悬疑推理参照

| key | 名称 | 适用 |
|-----|------|------|
| `christie` | 阿加莎·克里斯蒂 | 封闭空间、群像、红鲱鱼、公平线索 |
| `holmes` | 福尔摩斯 | 细节演绎、观察→推理链 |
| `christie-holmes` | 阿加莎 + 福尔摩斯 | **默认**；盘问埋线索 + 细节放大 |

`setting.mysteryStyle = "christie-holmes"`

---

## 已废弃字段

| 旧字段 | 替代 |
|--------|------|
| `setting.tone` | `literaryStyle` |
| `setting.styleAnchor` | 预设内 `anchor` 范例句 |

仍传入旧字段时会被忽略（以 `literaryStyle` 为准）。

---

## 注入位置

- 推理长篇（⑤）、分幕大纲（⑦）、structured 行动/公聊（⑨）
- 上游 truth / characters / matrix 的 user 块仍带 `风格卡` JSON
