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
  i18n: {
    de: { name: 'KI-Regex', tagline: 'Ein Muster beschreiben und eine getestete Regex erhalten' },
    es: { name: 'Regex con IA', tagline: 'Describir un patrón y obtener una regex probada' },
    zh: { name: 'AI 正则', tagline: '描述一个模式并得到经过测试的正则' },
  },
  load: () => import('./index.js'),
};
