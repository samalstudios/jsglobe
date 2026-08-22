export default {
  id: "typing-test",
  name: "Typing Test",
  tagline: "Words per minute, accuracy and trouble keys",
  category: "play",
  glyph: "WPM",
  icon: "typing",
  keywords: ["typing","wpm","speed","keyboard","accuracy","practice"],
  tag: "jg-app-typing-test",
  window: {"width":900,"height":780},
  i18n: {
    de: { name: 'Tipptest', tagline: 'Wörter pro Minute, Genauigkeit und Problemtasten' },
    es: { name: 'Test de mecanografía', tagline: 'Palabras por minuto, precisión y teclas problemáticas' },
    zh: { name: '打字测试', tagline: '每分钟词数、准确率与易错键' },
  },
  load: () => import('./index.js'),
};
