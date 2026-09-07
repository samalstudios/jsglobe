export default {
  id: "docker-compose",
  name: "Docker Compose",
  tagline: "Convert docker run commands to compose files",
  category: "development",
  glyph: "🐳",
  icon: "docker",
  keywords: ["docker","compose","container","run","yaml","devops"],
  tag: "jg-app-docker-compose",
  window: {"width":1100,"height":800},
  load: () => import('./index.js'),
};
