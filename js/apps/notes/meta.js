export default {
  id: "notes",
  name: "Notes",
  tagline: "Quick scratch notes saved to this workspace",
  category: "utility",
  glyph: "✎",
  icon: "pencil",
  tint: "#0891b2",
  keywords: ["notes","scratch","write","memo"],
  tag: "jg-app-notes",
  widget: true,
  load: () => import('./index.js'),
};
