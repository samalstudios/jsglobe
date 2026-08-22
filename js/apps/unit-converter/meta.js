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
  i18n: {
    de: { name: 'Einheiten', tagline: 'Länge, Masse, Daten, Temperatur und Zeit' },
    es: { name: 'Unidades', tagline: 'Longitud, masa, datos, temperatura y tiempo' },
    zh: { name: '单位换算', tagline: '长度、质量、数据、温度与时间' },
  },
  load: () => import('./index.js'),
};
