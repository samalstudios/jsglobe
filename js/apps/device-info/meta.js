export default {
  id: "device-info",
  name: "Device Info",
  tagline: "Everything the browser knows about this device",
  category: "utility",
  glyph: "ⓘ",
  icon: "monitor",
  tint: "#475569",
  keywords: ["device","browser","screen","agent","info"],
  tag: "jg-app-device-info",
  i18n: {
    de: { name: 'Geräteinfo', tagline: 'Alles, was der Browser über dieses Gerät weiß' },
    es: { name: 'Info del dispositivo', tagline: 'Todo lo que el navegador sabe de este dispositivo' },
    zh: { name: '设备信息', tagline: '浏览器所知的本机全部信息' },
  },
  load: () => import('./index.js'),
};
