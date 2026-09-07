export default {
  id: "bluetooth-scanner",
  name: "Bluetooth",
  tagline: "Read, subscribe and write to GATT characteristics",
  category: "utility",
  glyph: "B",
  icon: "bluetooth",
  tint: "#3f6b91",
  keywords: ["bluetooth","ble","gatt","device","scanner","characteristic","service","notify","subscribe","rssi","heart rate","battery"],
  tag: "jg-app-bluetooth-scanner",
  window: {"width":900,"height":780},
  load: () => import('./index.js'),
};
