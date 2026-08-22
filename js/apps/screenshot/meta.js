export default {
  id: "screenshot",
  name: "Screenshot Studio",
  tagline: "Capture, annotate, blur and compare screenshots",
  category: "media",
  glyph: "⌗",
  icon: "screenshot",
  tint: "#e11d48",
  keywords: ["screenshot","capture","annotate","blur","redact","crop","arrow","before after"],
  tag: "jg-app-screenshot",
  window: {"width":1080,"height":900},
  i18n: {
    de: { name: 'Screenshot-Studio', tagline: 'Screenshots aufnehmen, beschriften, unkenntlich machen und vergleichen' },
    es: { name: 'Estudio de capturas', tagline: 'Capturar, anotar, difuminar y comparar capturas de pantalla' },
    zh: { name: '截图工作台', tagline: '截取、标注、模糊并对比截图' },
  },
  load: () => import('./index.js'),
};
