export default {
  id: "media-converter",
  name: "Video & Audio",
  tagline: "Transcode video and audio with WebAssembly",
  category: "media",
  glyph: "AV",
  icon: "film",
  tint: "#be123c",
  keywords: ["video","audio","convert","ffmpeg","mp4","webm","mp3","gif","transcode"],
  tag: "jg-app-media-converter",
  load: () => import('./index.js'),
};
