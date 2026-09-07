export default {
  id: "morse-code",
  name: "Morse Code",
  tagline: "Translate text to Morse and play it back",
  category: "converter",
  glyph: ".-",
  icon: "morse",
  keywords: ["morse","code","telegraph","signal","sos","decode"],
  tag: "jg-app-morse-code",
  window: {"width":760,"height":820},
  load: () => import('./index.js'),
};
