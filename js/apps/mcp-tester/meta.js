export default {
  id: "mcp-tester",
  name: "MCP Tester",
  tagline: "Connect to a Model Context Protocol server and try its tools, resources and prompts",
  category: "ai",
  glyph: "MCP",
  icon: "network",
  tint: "#1f6feb",
  keywords: ["mcp","model context protocol","mcp inspector","mcp client","mcp server","json-rpc","tools","resources","prompts","ai agents","streamable http","sse"],
  tag: "jg-app-mcp-tester",
  window: {"width":1120,"height":800},
  load: () => import('./index.js'),
};
