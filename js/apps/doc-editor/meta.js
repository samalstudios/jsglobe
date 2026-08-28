export default {
  id: "doc-editor",
  name: "Documents Studio",
  tagline: "Write, format and export documents as PDF or Word, entirely in your browser",
  category: "text",
  glyph: "¶",
  icon: "fileText",
  tint: "#3b6fd4",
  keywords: ["document", "word processor", "editor", "docx", "pdf", "write", "rich text", "export", "pages"],
  tag: "jg-app-doc-editor",
  window: { width: 1180, height: 820, maximized: true },
  i18n: {
    de: { name: 'Dokumentenstudio', tagline: 'Dokumente schreiben, formatieren und als PDF oder Word exportieren, ganz im Browser' },
    es: { name: 'Estudio de documentos', tagline: 'Escribe, da formato y exporta documentos como PDF o Word, todo en el navegador' },
    zh: { name: '文档工作室', tagline: '在浏览器中撰写、排版并导出 PDF 或 Word 文档' },
  },
  load: () => import('./index.js'),
};
