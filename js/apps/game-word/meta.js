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
  load: () => import('./index.js'),
};
