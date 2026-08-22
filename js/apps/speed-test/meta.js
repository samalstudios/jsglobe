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
  i18n: {
    de: { name: 'Speedtest', tagline: 'Download, Upload, Latenz und Jitter messen' },
    es: { name: 'Test de velocidad', tagline: 'Medir descarga, subida, latencia y jitter' },
    zh: { name: '网速测试', tagline: '测量下载、上传、延迟与抖动' },
  },
  load: () => import('./index.js'),
};
