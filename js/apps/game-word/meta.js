export default {
  id: "game-word",
  name: "Word Guess",
  tagline: "Six tries to find the five letter word",
  category: "play",
  glyph: "W",
  icon: "letters",
  keywords: ["word","guess","wordle","letters","puzzle","game"],
  tag: "jg-app-game-word",
  window: {"width":640,"height":860},
  i18n: {
    de: { name: 'Worträtsel', tagline: 'Sechs Versuche für das Wort aus fünf Buchstaben' },
    es: { name: 'Adivina la palabra', tagline: 'Seis intentos para hallar la palabra de cinco letras' },
    zh: { name: '猜词', tagline: '六次机会猜出五个字母的单词' },
  },
  load: () => import('./index.js'),
};
