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
  i18n: {
    de: { name: 'Testdaten', tagline: 'Realistische Testdaten aus einer Feldliste erzeugen' },
    es: { name: 'Datos de prueba', tagline: 'Generar datos de prueba realistas desde una lista de campos' },
    zh: { name: '测试数据', tagline: '按字段列表生成逼真的测试数据' },
  },
  load: () => import('./index.js'),
};
