export default {
  id: "ai-code",
  name: "AI Code",
  tagline: "Explain, review, document and convert code",
  category: "ai",
  glyph: "AIC",
  icon: "codeSparkle",
  tint: "#9333ea",
  keywords: ["ai","code","explain","review","refactor","tests","llm"],
  tag: "jg-app-ai-code",
  load: () => import('./index.js'),
};
