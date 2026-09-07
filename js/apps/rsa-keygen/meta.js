export default {
  id: "rsa-keygen",
  name: "Key Pair",
  tagline: "Generate RSA and elliptic curve keys as PEM",
  category: "crypto",
  glyph: "PEM",
  icon: "keyPair",
  tint: "#6d28d9",
  keywords: ["rsa","key","pair","pem","ecdsa","public","private","ssh"],
  tag: "jg-app-rsa-keygen",
  load: () => import('./index.js'),
};
