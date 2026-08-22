export default {
  id: "function-plotter",
  name: "Function Plotter",
  tagline: "Graph expressions with zoom, roots and derivatives",
  category: "math",
  glyph: "ƒ",
  icon: "curve",
  keywords: ["plot","graph","function","chart","derivative","roots","calculator","math"],
  tag: "jg-app-function-plotter",
  window: {"width":1000,"height":820,"maximized":true},
  i18n: {
    de: { name: 'Funktionsplotter', tagline: 'Ausdrücke mit Zoom, Nullstellen und Ableitungen zeichnen' },
    es: { name: 'Graficador de funciones', tagline: 'Graficar expresiones con zoom, raíces y derivadas' },
    zh: { name: '函数绘图', tagline: '绘制表达式，支持缩放、求根与导数' },
  },
  load: () => import('./index.js'),
};
