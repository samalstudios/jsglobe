export default {
  id: "xml-formatter",
  name: "XML Formatter",
  tagline: "Indent and minify XML or HTML markup",
  category: "development",
  glyph: "</>",
  icon: "code",
  tint: "#15803d",
  keywords: ["xml","html","format","pretty","indent"],
  tag: "jg-app-xml-formatter",
  load: () => import('./index.js'),
};
