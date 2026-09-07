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
  load: () => import('./index.js'),
};
