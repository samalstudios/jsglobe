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
  load: () => import('./index.js'),
};
