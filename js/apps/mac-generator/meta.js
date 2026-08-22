export default {
  id: "mac-generator",
  name: "MAC Address",
  tagline: "Generate and reformat MAC addresses",
  category: "network",
  glyph: "MAC",
  icon: "router",
  tint: "#0f766e",
  keywords: ["mac","address","ethernet","hardware","generate"],
  tag: "jg-app-mac",
  i18n: {
    de: { name: 'MAC-Adresse', tagline: 'MAC-Adressen erzeugen und umformatieren' },
    es: { name: 'Dirección MAC', tagline: 'Generar y reformatear direcciones MAC' },
    zh: { name: 'MAC 地址', tagline: '生成并重新格式化 MAC 地址' },
  },
  load: () => import('./index.js'),
};
