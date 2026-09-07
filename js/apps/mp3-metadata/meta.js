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
  load: () => import('./index.js'),
};
