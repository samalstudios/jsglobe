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
  load: () => import('./index.js'),
};
