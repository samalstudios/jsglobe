export default {
  id: "mp3-metadata",
  name: "MP3 Metadata",
  tagline: "Edit ID3 tags and artwork on MP3 files",
  category: "media",
  glyph: "ID3",
  icon: "music",
  keywords: ["mp3","id3","tags","metadata","music","artwork","album"],
  tag: "jg-app-mp3-metadata",
  window: {"width":940,"height":820},
  i18n: {
    de: { name: 'MP3-Metadaten', tagline: 'ID3-Tags und Cover in MP3-Dateien bearbeiten' },
    es: { name: 'Metadatos MP3', tagline: 'Editar etiquetas ID3 y carátulas en archivos MP3' },
    zh: { name: 'MP3 元数据', tagline: '编辑 MP3 文件的 ID3 标签与封面' },
  },
  load: () => import('./index.js'),
};
