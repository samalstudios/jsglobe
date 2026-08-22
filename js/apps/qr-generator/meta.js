export default {
  id: "qr-generator",
  name: "QR Code",
  tagline: "Generate scannable QR codes offline",
  category: "media",
  glyph: "▦",
  icon: "qr",
  tint: "#f43f5e",
  keywords: ["qr","code","barcode","scan","link"],
  tag: "jg-app-qr",
  i18n: {
    de: { name: 'QR-Code', tagline: 'Scanbare QR-Codes offline erzeugen' },
    es: { name: 'Código QR', tagline: 'Generar códigos QR escaneables sin conexión' },
    zh: { name: '二维码', tagline: '离线生成可扫描的二维码' },
  },
  load: () => import('./index.js'),
};
