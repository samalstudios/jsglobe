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
  i18n: {
    de: { name: 'KI-Code', tagline: 'Code erklären, prüfen, dokumentieren und umwandeln' },
    es: { name: 'Código con IA', tagline: 'Explicar, revisar, documentar y convertir código' },
    zh: { name: 'AI 代码', tagline: '解释、审查、注释并转换代码' },
  },
  load: () => import('./index.js'),
};
