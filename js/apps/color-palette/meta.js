export default {
  id: "color-palette",
  name: "Colour Palette",
  tagline: "Tailwind style scales, a colour wheel and harmonies",
  category: "converter",
  glyph: "▤",
  icon: "swatches",
  tint: "#f97316",
  keywords: ["color","colour","palette","tailwind","wheel","scale","shades","harmony","swatch"],
  tag: "jg-app-color-palette",
  window: {"width":1040,"height":900},
  load: () => import('./index.js'),
};
