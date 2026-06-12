import { PRODUCT_BOUNDARY, cleanText, untrustedUserPayload } from "./shared.js";
import { creativeInputUserBlocks } from "./creative-input.js";

/** 从设定 + 纲要 + 各章总剧情归纳玩家角色清单（③ 第一步） */
export function buildRolesMetaFromNarrativeMessages({ setting, synopsis, chapters = [] }) {
  const chapterPayload = chapters.map((ch) => ({
    chapterKey: ch.chapterKey,
    title: ch.title,
    summary: cleanText(ch.summary, 300)
  }));
  const system = `你是剧本杀角色策划。根据创作设定、剧情纲要与各章摘要，输出恰好 ${setting.playerCount} 位可玩角色的元数据（不写分幕正文）。

${PRODUCT_BOUNDARY}

【输出 schema】
{
  "roles": [
    {
      "key": "role-1",
      "name": "角色名",
      "publicProfile": "公开身份（玩家可见）",
      "privateProfile": "私人秘密与动机（host/改编用，勿写入玩家本）"
    }
  ],
  "suggestions": ["角色设计注意"]
}
key 必须为 role-1 … role-N，恰好 ${setting.playerCount} 个。`;
  const user = `${creativeInputUserBlocks(setting, synopsis)}

${untrustedUserPayload("各章摘要", chapterPayload)}

只返回 JSON。`;
  return [{ role: "system", content: system }, { role: "user", content: user }];
}
