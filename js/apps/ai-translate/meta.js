export default {
  id: "ai-translate",
  name: "Translate",
  tagline: "Translate text with a model on this device",
  category: "ai",
  glyph: "文",
  icon: "languages",
  tint: "#8b5cf6",
  keywords: ["translate","language","ai","localise","localize","spanish","french","japanese"],
  tag: "jg-app-ai-translate",
  window: {"width":980,"height":760},
  i18n: {
    de: { name: 'Übersetzen', tagline: 'Text mit einem Modell auf diesem Gerät übersetzen' },
    es: { name: 'Traducir', tagline: 'Traducir texto con un modelo en este dispositivo' },
    zh: { name: '翻译', tagline: '用本机上的模型翻译文本' },
  },
  load: () => import('./index.js'),
};
