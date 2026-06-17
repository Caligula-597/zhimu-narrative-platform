/**
 * Creator import guide — static product copy for pre-import UI.
 */
export const IMPORT_GUIDE = {
  title: "导入前说明",
  supportedFormats: [
    {
      id: "json",
      label: "织幕 JSON 内容包",
      extensions: [".json"],
      description: "完整导出/导入，含角色、章节、分幕、场景、线索与规则。"
    },
    {
      id: "markdown",
      label: "Markdown / TXT",
      extensions: [".md", ".txt"],
      description: "按角色或章节拆分的纯文本，需已有角色席位。"
    },
    {
      id: "docx",
      label: "Word 文档",
      extensions: [".docx"],
      description: "解析为文本块后再映射到角色分幕。"
    },
    {
      id: "pdf",
      label: "PDF",
      extensions: [".pdf"],
      description: "提取文本层或按页 OCR；复杂排版建议先整理为 Markdown。"
    }
  ],
  modes: [
    {
      id: "append",
      label: "追加到当前世界",
      description: "保留现有内容，将包内条目合并进来。不会删除已有数据。"
    },
    {
      id: "new_world",
      label: "创建新世界并导入",
      description: "新建独立剧本后写入全部内容，适合整包迁移。"
    }
  ],
  willGenerate: [
    "角色席位、章节、私人分幕（若包内包含）",
    "场景、线索、调查点与图谱边（若包内包含）",
    "自动化规则（引用 ID 会在导入时重映射）"
  ],
  willNotGenerate: [
    "平行运行房与邀请码（导入后请手动创建测试房）",
    "玩家阅读进度、主持日志与复盘",
    "云端附件二进制（仅保留元数据引用，需重新上传）"
  ],
  overwritePolicy: "追加模式不会覆盖同名条目；JSON 导入使用包内 UUID 映射，冲突条目会跳过或合并（见导入预览）。",
  tips: [
    "Word/Markdown 导入前，先用「角色名 + 章节标题」分段，减少手动拆分。",
    "导入完成后运行「发布前检查」，确认分幕已开放测试、测试房已建立。",
    "公开库上架须单独提交审核，导入不等于自动公开。"
  ]
};

export function getImportGuide() {
  return IMPORT_GUIDE;
}
