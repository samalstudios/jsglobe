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
  i18n: {
    de: { name: 'Bildkonverter', tagline: 'Bilder im Browser umwandeln, skalieren und komprimieren' },
    es: { name: 'Conversor de imágenes', tagline: 'Convertir, redimensionar y comprimir imágenes en el navegador' },
    zh: { name: '图片转换', tagline: '在浏览器中转换、缩放并压缩图片' },
  },
  load: () => import('./index.js'),
};
