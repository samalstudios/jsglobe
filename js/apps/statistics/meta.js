export default {
  id: "statistics",
  name: "Statistics",
  tagline: "Summary, histogram and box plot for a set of numbers",
  category: "math",
  glyph: "σ",
  icon: "chart",
  keywords: ["statistics","mean","median","standard deviation","quartile","histogram","box plot"],
  tag: "jg-app-statistics",
  window: {"width":1060,"height":860},
  load: () => import('./index.js'),
};
