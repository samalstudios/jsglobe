export default {
  id: "letters",
  name: "Letters",
  tagline: "Learn the Greek, Cyrillic, Japanese and Chinese letters",
  category: "text",
  glyph: "Ω",
  icon: "alphabet",
  tint: "#0ea5e9",
  keywords: ["alphabet","letters","greek","cyrillic","russian","japanese","hiragana","katakana","chinese","bopomofo","learn","flashcards"],
  tag: "jg-app-letters",
  window: { width: 1040, height: 840 },
  i18n: {
    de: { name: 'Buchstaben', tagline: 'Griechische, kyrillische, japanische und chinesische Zeichen lernen' },
    es: { name: 'Letras', tagline: 'Aprende las letras griegas, cirílicas, japonesas y chinas' },
    zh: { name: '字母', tagline: '学习希腊、西里尔、日语和汉语的字符' },
  },
  load: () => import('./index.js'),
};
