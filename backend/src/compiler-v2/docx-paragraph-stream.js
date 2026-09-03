/**
 * DOCX paragraph stream — styles, page breaks, plain text.
 * No LLM. Used by ManuscriptBoundaryResolver.
 */

import AdmZip from "adm-zip";

function decodeXmlEntities(text = "") {
  return String(text)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

/**
 * @returns {Array<{
 *   index: number,
 *   text: string,
 *   textCompact: string,
 *   styleId: string|null,
 *   isHeading: boolean,
 *   pageBreakBefore: boolean,
 *   maxFontHalfPoints: number|null
 * }>}
 */
export function extractDocxParagraphStream(buffer) {
  const zip = new AdmZip(buffer);
  const entry = zip.getEntry("word/document.xml");
  if (!entry) throw new Error("DOCX missing word/document.xml");
  const xml = entry.getData().toString("utf8");

  const paragraphs = [];
  const re = /<w:p\b[\s\S]*?<\/w:p>/g;
  let match;
  let index = 0;
  while ((match = re.exec(xml))) {
    const p = match[0];
    const texts = [...p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g)].map((x) =>
      decodeXmlEntities(x[1])
    );
    const text = texts.join("").replace(/\s+/g, " ").trim();
    if (!text) {
      // keep empty paras only if page break (structural)
      const pageBreak = /w:type="page"/.test(p) || /w:lastRenderedPageBreak/.test(p);
      if (!pageBreak) continue;
      paragraphs.push({
        index: index++,
        text: "",
        textCompact: "",
        styleId: null,
        isHeading: false,
        pageBreakBefore: true,
        maxFontHalfPoints: null
      });
      continue;
    }

    const styleId = (p.match(/w:pStyle\s+w:val="([^"]+)"/) || [])[1] || null;
    const isHeading =
      Boolean(styleId && /heading|标题|Title|toc/i.test(styleId)) ||
      Boolean(styleId && /^[1-9]$/.test(styleId));
    const pageBreakBefore =
      /w:type="page"/.test(p) || /w:lastRenderedPageBreak/.test(p);
    const sizes = [...p.matchAll(/w:sz\s+w:val="(\d+)"/g)].map((x) => Number(x[1]));
    const maxFontHalfPoints = sizes.length ? Math.max(...sizes) : null;

    paragraphs.push({
      index: index++,
      text,
      textCompact: text.replace(/\s+/g, ""),
      styleId,
      isHeading,
      pageBreakBefore,
      maxFontHalfPoints
    });
  }
  return paragraphs;
}

export function joinParagraphs(paragraphs, start, endExclusive) {
  return paragraphs
    .slice(start, endExclusive)
    .map((p) => p.text)
    .filter(Boolean)
    .join("\n");
}
