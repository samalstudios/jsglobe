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
  load: () => import('./index.js'),
};
