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
  i18n: {
    de: { name: 'Video & Audio', tagline: 'Video und Audio mit WebAssembly umwandeln' },
    es: { name: 'Vídeo y audio', tagline: 'Transcodificar vídeo y audio con WebAssembly' },
    zh: { name: '视频与音频', tagline: '用 WebAssembly 转码视频和音频' },
  },
  load: () => import('./index.js'),
};
