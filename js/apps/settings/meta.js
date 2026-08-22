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
  i18n: {
    de: { name: 'Einstellungen', tagline: 'Darstellung, Startbildschirm, Arbeitsbereiche und Daten' },
    es: { name: 'Ajustes', tagline: 'Apariencia, pantalla de inicio, espacios de trabajo y datos' },
    zh: { name: '设置', tagline: '外观、主屏幕、工作区与数据' },
  },
  load: () => import('./index.js'),
};
