export default {
  id: "list-converter",
  name: "List Converter",
  tagline: "Sort, dedupe, wrap and rejoin lists",
  category: "converter",
  glyph: "≡",
  icon: "list",
  tint: "#d97706",
  keywords: ["list","sort","dedupe","join","split","lines","csv"],
  tag: "jg-app-list-converter",
  load: () => import('./index.js'),
};
