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
  i18n: {
    de: { name: 'KI-Autor', tagline: 'Zusammenfassen, umschreiben, übersetzen und korrigieren' },
    es: { name: 'Escritor IA', tagline: 'Resumir, reescribir, traducir y corregir' },
    zh: { name: 'AI 写作', tagline: '摘要、改写、翻译与校对' },
  },
  load: () => import('./index.js'),
};
