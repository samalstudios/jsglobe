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
  i18n: {
    de: { name: 'Markdown', tagline: 'Markdown schreiben und das HTML ansehen' },
    es: { name: 'Markdown', tagline: 'Escribir markdown y ver el HTML' },
    zh: { name: 'Markdown', tagline: '编写 Markdown 并预览 HTML' },
  },
  load: () => import('./index.js'),
};
