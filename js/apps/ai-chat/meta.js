export default {
  id: "ai-chat",
  name: "AI Chat",
  tagline: "Chat with a model running on this device",
  category: "ai",
  glyph: "AI",
  icon: "sparkles",
  tint: "#a855f7",
  keywords: ["ai","chat","llm","webllm","assistant","local"],
  tag: "jg-app-ai-chat",
  widget: true,
  load: () => import('./index.js'),
};
