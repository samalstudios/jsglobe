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
  i18n: {
    de: { name: 'XML-Formatierer', tagline: 'XML- oder HTML-Markup einrücken und minimieren' },
    es: { name: 'Formateador XML', tagline: 'Indentar y minificar marcado XML o HTML' },
    zh: { name: 'XML 格式化', tagline: '缩进并压缩 XML 或 HTML 标记' },
  },
  load: () => import('./index.js'),
};
