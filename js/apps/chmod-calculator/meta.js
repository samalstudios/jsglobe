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
  load: () => import('./index.js'),
};
