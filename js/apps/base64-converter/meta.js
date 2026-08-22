export default {
  id: "base64-converter",
  name: "Base64",
  tagline: "Encode and decode text or files",
  category: "converter",
  glyph: "64",
  icon: "swap",
  tint: "#f59e0b",
  keywords: ["base64","encode","decode","atob","btoa","data uri"],
  tag: "jg-app-base64",
  i18n: {
    de: { name: 'Base64', tagline: 'Text oder Dateien kodieren und dekodieren' },
    es: { name: 'Base64', tagline: 'Codificar y decodificar texto o archivos' },
    zh: { name: 'Base64', tagline: '编码和解码文本或文件' },
  },
  load: () => import('./index.js'),
};
