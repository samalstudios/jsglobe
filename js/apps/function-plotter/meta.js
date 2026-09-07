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
  load: () => import('./index.js'),
};
