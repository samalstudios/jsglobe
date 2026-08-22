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
  i18n: {
    de: { name: 'Farbpalette', tagline: 'Tailwind-Skalen, ein Farbkreis und Harmonien' },
    es: { name: 'Paleta de colores', tagline: 'Escalas estilo Tailwind, rueda de color y armonías' },
    zh: { name: '调色板', tagline: 'Tailwind 风格色阶、色轮与配色方案' },
  },
  load: () => import('./index.js'),
};
