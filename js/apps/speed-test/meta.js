export default {
  id: "speed-test",
  name: "Speed Test",
  tagline: "Measure download, upload, latency and jitter",
  category: "network",
  glyph: "Mb",
  icon: "gauge2",
  tint: "#0d9488",
  keywords: ["speed","test","bandwidth","download","upload","latency","ping","internet"],
  tag: "jg-app-speed-test",
  load: () => import('./index.js'),
};
