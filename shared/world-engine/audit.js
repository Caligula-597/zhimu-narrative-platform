const RULES = [
  {
    code: "pending_item_reminder",
    pattern: /还没(?:来得及)?(?:看|拆|问|处理)|那张纸一直|刚才的问题还没/u
  },
  {
    code: "scene_summary_intrusion",
    pattern: /七点以前最乱|事情开始复杂|整个上午都不太平|麻烦越来越多|后面的二十多分钟没有停下来/u
  },
  {
    code: "author_reasoning",
    pattern: /你(?:立刻)?意识到|这说明|这显然不是巧合|对得上|确实有道理/u
  },
  {
    code: "job_tutorial",
    pattern: /这种时候.{0,12}一般(?:不会|会)|摄像一般不会马上关机/u
  },
  {
    code: "background_database_dump",
    pattern: /你来到这里第.年|你从小|你一直是/u
  }
];

export function auditScriptText(text = "") {
  const source = String(text || "");
  const hits = [];
  for (const rule of RULES) {
    const match = source.match(rule.pattern);
    if (!match) continue;
    const index = match.index || 0;
    const start = Math.max(0, index - 80);
    const end = Math.min(source.length, index + match[0].length + 80);
    hits.push({
      code: rule.code,
      excerpt: source.slice(start, end),
      index
    });
  }
  return hits;
}

export function localRepairWindow(text = "", hit) {
  const source = String(text || "");
  const index = Number(hit?.index) || 0;
  const start = Math.max(0, index - 120);
  const end = Math.min(source.length, index + 180);
  return {
    start,
    end,
    excerpt: source.slice(start, end)
  };
}
