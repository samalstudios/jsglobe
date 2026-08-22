export default {
  id: "math-evaluator",
  name: "Math Evaluator",
  tagline: "Evaluate expressions with functions and constants",
  category: "math",
  glyph: "=",
  icon: "calculator",
  tint: "#eab308",
  keywords: ["math","calculator","evaluate","expression"],
  tag: "jg-app-math",
  widget: true,
  i18n: {
    de: { name: 'Rechner', tagline: 'Ausdrücke mit Funktionen und Konstanten auswerten' },
    es: { name: 'Calculadora', tagline: 'Evaluar expresiones con funciones y constantes' },
    zh: { name: '计算器', tagline: '求值带函数与常量的表达式' },
  },
  load: () => import('./index.js'),
};
