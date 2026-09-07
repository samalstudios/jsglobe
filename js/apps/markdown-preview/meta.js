export default {
  id: "markdown-preview",
  name: "Markdown",
  tagline: "Write markdown and preview the HTML",
  category: "text",
  glyph: "M↓",
  icon: "fileText",
  tint: "#9d174d",
  keywords: ["markdown","md","preview","html","render"],
  tag: "jg-app-markdown",
  load: () => import('./index.js'),
};
