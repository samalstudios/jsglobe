export default {
  id: "ai-writer",
  name: "AI Writer",
  tagline: "Summarise, rewrite, translate and proofread",
  category: "ai",
  glyph: "AIW",
  icon: "pencil",
  tint: "#7e22ce",
  keywords: ["ai","write","summarise","translate","rewrite","commit"],
  tag: "jg-app-ai-writer",
  load: () => import('./index.js'),
};
