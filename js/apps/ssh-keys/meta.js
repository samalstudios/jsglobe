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
  load: () => import('./index.js'),
};
