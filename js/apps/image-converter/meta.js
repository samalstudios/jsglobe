export default {
  id: "image-converter",
  name: "Image Converter",
  tagline: "Convert, resize and compress images in the browser",
  category: "media",
  glyph: "IMG",
  icon: "image",
  tint: "#e11d48",
  keywords: ["image","convert","resize","compress","png","jpeg","webp"],
  tag: "jg-app-image-converter",
  load: () => import('./index.js'),
};
