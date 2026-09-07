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
  load: () => import('./index.js'),
};
