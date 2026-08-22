export default {
  id: "api-spec",
  name: "API Spec Editor",
  tagline: "Edit and check OpenAPI documents",
  category: "development",
  glyph: "API",
  icon: "spec",
  keywords: ["openapi","swagger","api","spec","rest","yaml","schema","lint"],
  tag: "jg-app-api-spec",
  window: {"width":1120,"height":860},
  i18n: {
    de: { name: 'API-Spec-Editor', tagline: 'OpenAPI-Dokumente bearbeiten und prüfen' },
    es: { name: 'Editor de API', tagline: 'Editar y comprobar documentos OpenAPI' },
    zh: { name: 'API 规范编辑器', tagline: '编辑并校验 OpenAPI 文档' },
  },
  load: () => import('./index.js'),
};
