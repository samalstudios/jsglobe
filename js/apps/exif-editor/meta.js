export default {
  id: "exif-editor",
  name: "Exif Metadata",
  tagline: "Read and strip metadata from JPEG photos",
  category: "media",
  glyph: "EX",
  icon: "exif",
  keywords: ["exif","metadata","photo","jpeg","gps","privacy","strip"],
  tag: "jg-app-exif-editor",
  window: {"width":900,"height":800,"maximized":true},
  i18n: {
    de: { name: 'Exif-Metadaten', tagline: 'Metadaten aus JPEG-Fotos lesen und entfernen' },
    es: { name: 'Metadatos Exif', tagline: 'Leer y borrar metadatos de fotos JPEG' },
    zh: { name: 'Exif 元数据', tagline: '读取并清除 JPEG 照片的元数据' },
  },
  load: () => import('./index.js'),
};
