export default {
  id: "emoji-picker",
  name: "Emoji Picker",
  tagline: "Browse, search and copy emoji with their code points",
  category: "text",
  glyph: "☺",
  icon: "emoji",
  keywords: ["emoji","unicode","smiley","symbol","picker","copy"],
  tag: "jg-app-emoji-picker",
  window: {"width":880,"height":760},
  i18n: {
    de: { name: 'Emoji-Auswahl', tagline: 'Emoji mit Codepunkten durchsuchen und kopieren' },
    es: { name: 'Selector de emoji', tagline: 'Explorar, buscar y copiar emoji con sus puntos de código' },
    zh: { name: 'Emoji 选择器', tagline: '浏览、搜索并复制 emoji 及其码位' },
  },
  load: () => import('./index.js'),
};
