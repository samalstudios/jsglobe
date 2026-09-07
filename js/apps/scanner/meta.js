export default {
  id: "scanner",
  name: "Code Scanner",
  tagline: "Read QR codes and bar codes from the camera, a picture or the screen",
  category: "utility",
  glyph: "▣",
  icon: "scan",
  tint: "#2f9e6e",
  keywords: ["qr", "barcode", "scan", "reader", "camera", "ean", "upc", "code 128", "decode", "screenshot"],
  tag: "jg-app-scanner",
  window: { width: 1040, height: 760 },
  load: () => import('./index.js'),
};
