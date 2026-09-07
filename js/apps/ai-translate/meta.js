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
  load: () => import('./index.js'),
};
