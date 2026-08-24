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
  i18n: {
    de: { name: 'Code-Scanner', tagline: 'QR-Codes und Barcodes aus Kamera, Bild oder Bildschirm lesen' },
    es: { name: 'Escáner de códigos', tagline: 'Lee códigos QR y de barras desde la cámara, una imagen o la pantalla' },
    zh: { name: '扫码器', tagline: '从摄像头、图片或屏幕读取二维码与条形码' },
  },
  load: () => import('./index.js'),
};
