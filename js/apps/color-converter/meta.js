export default {
  id: "color-converter",
  name: "Color Converter",
  tagline: "HEX, RGB, HSL, OKLCH and contrast checks",
  category: "converter",
  glyph: "◐",
  icon: "palette",
  tint: "#f97316",
  keywords: ["color","hex","rgb","hsl","palette","contrast","wcag"],
  tag: "jg-app-color",
  widget: true,
  i18n: {
    de: { name: 'Farbkonverter', tagline: 'HEX, RGB, HSL, OKLCH und Kontrastprüfung' },
    es: { name: 'Conversor de color', tagline: 'HEX, RGB, HSL, OKLCH y comprobación de contraste' },
    zh: { name: '颜色转换', tagline: 'HEX、RGB、HSL、OKLCH 与对比度检查' },
  },
  load: () => import('./index.js'),
};
