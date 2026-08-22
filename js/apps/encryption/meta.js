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
  i18n: {
    de: { name: 'Verschlüsseln / Entschlüsseln', tagline: 'AES-GCM-Textverschlüsselung mit Passphrase' },
    es: { name: 'Cifrar / Descifrar', tagline: 'Cifrado de texto AES-GCM con contraseña' },
    zh: { name: '加密 / 解密', tagline: '使用口令的 AES-GCM 文本加密' },
  },
  load: () => import('./index.js'),
};
