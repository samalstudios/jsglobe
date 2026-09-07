export default {
  id: "settings",
  name: "Settings",
  tagline: "Appearance, home screen, workspaces and data",
  category: "system",
  glyph: "⚙",
  icon: "cog",
  tint: "#a1a1aa",
  keywords: ["settings","preferences","theme","workspace","config"],
  tag: "jg-app-settings",
  system: true,
  load: () => import('./index.js'),
};
