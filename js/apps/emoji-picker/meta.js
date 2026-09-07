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
  load: () => import('./index.js'),
};
