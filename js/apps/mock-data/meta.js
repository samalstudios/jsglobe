export default {
  id: "mock-data",
  name: "Mock Data",
  tagline: "Generate realistic test data from a field list",
  category: "development",
  glyph: "{}",
  icon: "dice",
  keywords: ["mock","fake","test data","seed","fixtures","json","csv","sql","faker"],
  tag: "jg-app-mock-data",
  window: {"width":1080,"height":820},
  load: () => import('./index.js'),
};
