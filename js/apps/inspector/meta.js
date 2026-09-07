export default {
  id: "inspector",
  name: "Inspector AI",
  tagline: "Ask questions of your own documents, answered with references",
  category: "ai",
  glyph: "🔎",
  icon: "inspect",
  tint: "#5b5b8a",
  keywords: ["rag","pdf","documents","questions","answers","references","search","retrieval","local ai","notes"],
  tag: "jg-app-inspector",
  window: { width: 1160, height: 860, maximized: true },
  load: () => import('./index.js'),
};
