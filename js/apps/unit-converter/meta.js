export default {
  id: "unit-converter",
  name: "Unit Converter",
  tagline: "Length, mass, data, temperature and time",
  category: "math",
  glyph: "⇄",
  icon: "scale",
  tint: "#ca8a04",
  keywords: ["unit","convert","length","weight","temperature","bytes"],
  tag: "jg-app-units",
  load: () => import('./index.js'),
};
