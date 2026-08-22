export default {
  id: "mirror",
  name: "Mirror",
  tagline: "Camera mirror with an adjustable ring light",
  category: "media",
  glyph: "◲",
  icon: "mirror",
  tint: "#f43f5e",
  keywords: ["mirror","camera","webcam","ring light","selfie","makeup"],
  tag: "jg-app-mirror",
  window: {"width":760,"height":860},
  i18n: {
    de: { name: 'Spiegel', tagline: 'Kameraspiegel mit einstellbarem Ringlicht' },
    es: { name: 'Espejo', tagline: 'Espejo de cámara con un aro de luz ajustable' },
    zh: { name: '镜子', tagline: '带可调环形补光的摄像头镜子' },
  },
  load: () => import('./index.js'),
};
