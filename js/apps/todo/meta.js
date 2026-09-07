export default {
  id: "todo",
  name: "Tasks",
  tagline: "A lightweight checklist per workspace",
  category: "utility",
  glyph: "✓",
  icon: "checkSquare",
  tint: "#16a34a",
  keywords: ["todo","task","checklist","done"],
  tag: "jg-app-todo",
  widget: true,
  load: () => import('./index.js'),
};
