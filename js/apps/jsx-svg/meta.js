export default {
  id: "jsx-svg",
  name: "JSX to SVG",
  tagline: "Convert React components to SVG and back",
  category: "development",
  glyph: "<>",
  icon: "jsx",
  keywords: ["jsx","react","svg","component","icon","convert","tsx"],
  tag: "jg-app-jsx-svg",
  window: {"width":980,"height":780},
  i18n: {
    de: { name: 'JSX zu SVG', tagline: 'React-Komponenten in SVG umwandeln und zurück' },
    es: { name: 'JSX a SVG', tagline: 'Convertir componentes de React a SVG y al revés' },
    zh: { name: 'JSX 转 SVG', tagline: '在 React 组件与 SVG 之间互转' },
  },
  load: () => import('./index.js'),
};
