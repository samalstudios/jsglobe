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
  load: () => import('./index.js'),
};
