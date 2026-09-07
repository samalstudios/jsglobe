export default {
  id: "otp-generator",
  name: "TOTP",
  tagline: "Time based one-time passwords from a secret",
  category: "crypto",
  glyph: "⏲",
  icon: "timer",
  tint: "#9333ea",
  keywords: ["otp","totp","2fa","mfa","authenticator"],
  tag: "jg-app-otp",
  widget: true,
  load: () => import('./index.js'),
};
