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
  load: () => import('./index.js'),
};
