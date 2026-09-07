export default {
  id: "token-generator",
  name: "Token Generator",
  tagline: "Strong random passwords and API tokens",
  category: "crypto",
  glyph: "⁂",
  icon: "asterisk",
  tint: "#a855f7",
  keywords: ["password","token","random","secret","entropy"],
  tag: "jg-app-token",
  widget: true,
  load: () => import('./index.js'),
};
