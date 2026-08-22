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
  i18n: {
    de: { name: 'KI-Chat', tagline: 'Mit einem Modell auf diesem Gerät chatten' },
    es: { name: 'Chat con IA', tagline: 'Chatear con un modelo que corre en este dispositivo' },
    zh: { name: 'AI 聊天', tagline: '与在本机运行的模型对话' },
  },
  load: () => import('./index.js'),
};
