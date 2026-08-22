export default {
  id: "ssh-keys",
  name: "SSH Keys",
  tagline: "Generate and inspect OpenSSH keys offline",
  category: "crypto",
  glyph: "⌁",
  icon: "key",
  tint: "#6a5a8c",
  keywords: ["ssh","key","ed25519","rsa","ecdsa","keygen","fingerprint","authorized_keys","openssh"],
  tag: "jg-app-ssh-keys",
  window: {"width":940,"height":800},
  i18n: {
    de: { name: 'SSH-Schlüssel', tagline: 'OpenSSH-Schlüssel offline erzeugen und prüfen' },
    es: { name: 'Claves SSH', tagline: 'Generar e inspeccionar claves OpenSSH sin conexión' },
    zh: { name: 'SSH 密钥', tagline: '离线生成并查看 OpenSSH 密钥' },
  },
  load: () => import('./index.js'),
};
