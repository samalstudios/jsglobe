export default {
  id: "csv-studio",
  name: "CSV Studio",
  tagline: "Open, edit and convert CSV data in a table",
  category: "development",
  glyph: "CSV",
  icon: "table",
  keywords: ["csv","tsv","spreadsheet","table","json","sql","markdown","convert","excel"],
  tag: "jg-app-csv-studio",
  window: {"width":1120,"height":880,"maximized":true},
  i18n: {
    de: { name: 'CSV-Studio', tagline: 'CSV-Daten in einer Tabelle öffnen, bearbeiten und umwandeln' },
    es: { name: 'CSV Studio', tagline: 'Abrir, editar y convertir datos CSV en una tabla' },
    zh: { name: 'CSV 工作台', tagline: '以表格打开、编辑并转换 CSV 数据' },
  },
  load: () => import('./index.js'),
};
