export default {
  id: "password-strength",
  name: "Password Strength",
  tagline: "Entropy, weaknesses and time to crack",
  category: "crypto",
  glyph: "◍",
  icon: "gauge",
  tint: "#7c3aed",
  keywords: ["password","strength","entropy","crack","secure"],
  tag: "jg-app-password-strength",
  load: () => import('./index.js'),
};
