export default {
  id: "inspector",
  name: "Inspector",
  tagline: "Ask questions of your own documents, answered with references",
  category: "ai",
  glyph: "🔍",
  icon: "search",
  tint: "#5b5b8a",
  keywords: ["rag","documents","questions","answers","references","search","retrieval","local ai","notes"],
  tag: "jg-app-inspector",
  window: { width: 1160, height: 860, maximized: true },
  i18n: {
    de: { name: 'Inspektor', tagline: 'Fragen an eigene Dokumente stellen, beantwortet mit Belegen' },
    es: { name: 'Inspector', tagline: 'Haz preguntas a tus documentos y recibe respuestas con referencias' },
    zh: { name: '文档问答', tagline: '向自己的文档提问，答案附带出处' },
  },
  load: () => import('./index.js'),
};
