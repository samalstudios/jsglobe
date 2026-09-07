export default {
  id: "typing-test",
  name: "Typing Test",
  tagline: "Words per minute, accuracy and trouble keys",
  category: "play",
  glyph: "WPM",
  icon: "typing",
  keywords: ["typing","wpm","speed","keyboard","accuracy","practice"],
  tag: "jg-app-typing-test",
  window: {"width":900,"height":780},
  load: () => import('./index.js'),
};
