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
  i18n: {
    de: { name: 'Docker Compose', tagline: 'docker-run-Befehle in Compose-Dateien umwandeln' },
    es: { name: 'Docker Compose', tagline: 'Convertir comandos docker run en archivos compose' },
    zh: { name: 'Docker Compose', tagline: '把 docker run 命令转成 compose 文件' },
  },
  load: () => import('./index.js'),
};
