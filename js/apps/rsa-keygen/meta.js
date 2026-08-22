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
  i18n: {
    de: { name: 'Schlüsselpaar', tagline: 'RSA- und Elliptische-Kurven-Schlüssel als PEM erzeugen' },
    es: { name: 'Par de claves', tagline: 'Generar claves RSA y de curva elíptica en PEM' },
    zh: { name: '密钥对', tagline: '生成 PEM 格式的 RSA 与椭圆曲线密钥' },
  },
  load: () => import('./index.js'),
};
