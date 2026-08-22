export default {
  id: "keycode-info",
  name: "Keycode Info",
  tagline: "Inspect keyboard events key by key",
  category: "web",
  glyph: "⌨",
  icon: "keyboard",
  tint: "#0e7490",
  keywords: ["key","keycode","keyboard","event","which"],
  tag: "jg-app-keycode",
  i18n: {
    de: { name: 'Keycode-Info', tagline: 'Tastaturereignisse Taste für Taste untersuchen' },
    es: { name: 'Códigos de tecla', tagline: 'Inspeccionar eventos de teclado tecla a tecla' },
    zh: { name: '键码信息', tagline: '逐键查看键盘事件' },
  },
  load: () => import('./index.js'),
};
