export default {
  id: "text-encoder",
  name: "Text Encoder",
  tagline: "Binary, hex, unicode, NATO, morse and ROT13",
  category: "converter",
  glyph: "01",
  icon: "transform",
  tint: "#ea580c",
  keywords: ["binary","hex","unicode","nato","morse","rot13","escape","numeronym"],
  tag: "jg-app-text-encoder",
  i18n: {
    de: { name: 'Text-Encoder', tagline: 'Binär, Hex, Unicode, NATO, Morse und ROT13' },
    es: { name: 'Codificador de texto', tagline: 'Binario, hex, unicode, NATO, morse y ROT13' },
    zh: { name: '文本编码', tagline: '二进制、十六进制、Unicode、北约字母、摩尔斯与 ROT13' },
  },
  load: () => import('./index.js'),
};
