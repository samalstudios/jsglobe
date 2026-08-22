export default {
  id: "websocket-tester",
  name: "WebSocket Tester",
  tagline: "Connect to a socket and watch the frames",
  category: "network",
  glyph: "WS",
  icon: "socket",
  keywords: ["websocket","ws","wss","socket","realtime","debug","frames"],
  tag: "jg-app-websocket-tester",
  window: {"width":1040,"height":820},
  i18n: {
    de: { name: 'WebSocket-Tester', tagline: 'Mit einem Socket verbinden und die Frames beobachten' },
    es: { name: 'Probador WebSocket', tagline: 'Conectar a un socket y observar los frames' },
    zh: { name: 'WebSocket 测试', tagline: '连接 socket 并观察数据帧' },
  },
  load: () => import('./index.js'),
};
