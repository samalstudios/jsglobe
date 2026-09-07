export default {
  id: "letters",
  name: "Letters",
  tagline: "Learn the Greek, Cyrillic, Japanese, Korean and Chinese letters",
  category: "text",
  glyph: "Ω",
  icon: "alphabet",
  tint: "#0ea5e9",
  keywords: ["alphabet","letters","greek","cyrillic","russian","japanese","hiragana","katakana","korean","hangul","chinese","bopomofo","learn","flashcards"],
  tag: "jg-app-letters",
  window: { width: 1040, height: 840, maximized: true },
  load: () => import('./index.js'),
};
