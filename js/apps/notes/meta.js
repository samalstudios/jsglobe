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
  i18n: {
    de: { name: 'Notizen', tagline: 'Schnelle Notizen in diesem Arbeitsbereich' },
    es: { name: 'Notas', tagline: 'Notas rápidas guardadas en este espacio de trabajo' },
    zh: { name: '备忘', tagline: '保存在此工作区的速记' },
  },
  load: () => import('./index.js'),
};
