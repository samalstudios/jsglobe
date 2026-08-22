export default {
  id: "chmod-calculator",
  name: "Chmod",
  tagline: "Unix permissions in octal and symbolic form",
  category: "development",
  glyph: "755",
  icon: "fileLock",
  tint: "#65a30d",
  keywords: ["chmod","permission","unix","octal","file"],
  tag: "jg-app-chmod",
  i18n: {
    de: { name: 'Chmod', tagline: 'Unix-Rechte in oktaler und symbolischer Form' },
    es: { name: 'Chmod', tagline: 'Permisos Unix en forma octal y simbólica' },
    zh: { name: 'Chmod', tagline: '八进制与符号形式的 Unix 权限' },
  },
  load: () => import('./index.js'),
};
