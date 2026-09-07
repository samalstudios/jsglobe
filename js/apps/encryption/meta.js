export default {
  id: "encryption",
  name: "Encrypt / Decrypt",
  tagline: "AES-GCM text encryption with a passphrase",
  category: "crypto",
  glyph: "🔒",
  icon: "lock",
  tint: "#6d28d9",
  keywords: ["aes","encrypt","decrypt","cipher","password","gcm"],
  tag: "jg-app-encryption",
  load: () => import('./index.js'),
};
