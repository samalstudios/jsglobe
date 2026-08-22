export default {
  id: "ascii-art",
  name: "ASCII Art",
  tagline: "Text banners and image to ASCII conversion",
  category: "media",
  glyph: "A",
  icon: "ascii",
  keywords: ["ascii","art","banner","figlet","text","image","terminal"],
  tag: "jg-app-ascii-art",
  window: {"width":900,"height":860},
  i18n: {
    de: { name: 'ASCII-Art', tagline: 'Textbanner und Bild-zu-ASCII-Umwandlung' },
    es: { name: 'Arte ASCII', tagline: 'Banners de texto y conversión de imagen a ASCII' },
    zh: { name: 'ASCII 艺术', tagline: '文字横幅与图片转 ASCII' },
  },
  load: () => import('./index.js'),
};
