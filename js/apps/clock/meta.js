export default {
  id: "clock",
  name: "Clock",
  tagline: "World clocks, stopwatch and countdown timer",
  category: "utility",
  glyph: "◷",
  icon: "clock",
  tint: "#0ea5e9",
  keywords: ["clock","time","timezone","stopwatch","timer","world"],
  tag: "jg-app-clock",
  widget: true,
  i18n: {
    de: { name: 'Uhr', tagline: 'Weltzeituhren, Stoppuhr und Countdown' },
    es: { name: 'Reloj', tagline: 'Relojes mundiales, cronómetro y cuenta atrás' },
    zh: { name: '时钟', tagline: '世界时钟、秒表与倒计时' },
  },
  load: () => import('./index.js'),
};
