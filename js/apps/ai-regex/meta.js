export default {
  id: "ai-regex",
  name: "AI Regex",
  tagline: "Describe a pattern and get a tested regex",
  category: "ai",
  glyph: "AIR",
  icon: "regex",
  tint: "#c026d3",
  keywords: ["ai","regex","pattern","generate","explain"],
  tag: "jg-app-ai-regex",
  load: () => import('./index.js'),
};
