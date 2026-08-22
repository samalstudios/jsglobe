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
  i18n: {
    de: { name: 'Bluetooth', tagline: 'GATT-Merkmale lesen, abonnieren und schreiben' },
    es: { name: 'Bluetooth', tagline: 'Leer, suscribirse y escribir características GATT' },
    zh: { name: '蓝牙', tagline: '读取、订阅并写入 GATT 特征' },
  },
  load: () => import('./index.js'),
};
