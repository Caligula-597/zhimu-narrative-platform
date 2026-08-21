/**
 * Creator import guide — static product copy for pre-import UI.
 */
export const IMPORT_GUIDE = {
  title: "导入前说明",
  supportedFormats: [
    {
      id: "docx",
      label: "Word 文档（.docx）",
      extensions: [".docx"],
      description: "稿件正文解析仅接受 .docx。旧版 .doc 请先另存为 .docx。"
    },
    {
      id: "zip",
      label: "剧本 ZIP 包",
      extensions: [".zip"],
      description: "压缩包内放 .docx 稿件；图片与音频作为素材原样入库，不做 OCR。"
    },
    {
      id: "assets",
      label: "图片 / 音频素材",
      extensions: [".jpg", ".png", ".webp", ".gif", ".mp3", ".wav", ".ogg", ".m4a"],
      description: "在素材库直接上传，不走稿件解析。"
    },
    {
      id: "json",
      label: "织幕 JSON 内容包",
      extensions: [".json"],
      description: "完整导出/导入，含角色、章节、分幕、场景、线索与规则。"
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
    "从 PDF/扫描件自动识别的正文（请先整理为 .docx）"
  ],
  overwritePolicy: "追加模式不会覆盖同名条目；JSON 导入使用包内 UUID 映射，冲突条目会跳过或合并（见导入预览）。",
  tips: [
    "Word 导入前，先用「角色名 + 章节标题」分段，减少手动拆分。",
    "图片与音频请走素材库上传，不要塞进稿件解析。",
    "导入完成后运行「发布前检查」，确认分幕已开放测试、测试房已建立。",
    "公开库上架须单独提交审核，导入不等于自动公开。"
  ]
};

export function getImportGuide() {
  return IMPORT_GUIDE;
}
