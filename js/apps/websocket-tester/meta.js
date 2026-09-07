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
  load: () => import('./index.js'),
};
