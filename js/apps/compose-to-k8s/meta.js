export default {
  id: "compose-to-k8s",
  name: "Compose to K8s",
  tagline: "Turn a compose file into Kubernetes manifests",
  category: "development",
  glyph: "K",
  icon: "helm",
  tint: "#3b6fb6",
  keywords: ["docker","compose","kubernetes","k8s","convert","manifest","deployment","service","ingress","nginx","traefik","yaml","devops","migrate"],
  tag: "jg-app-compose-to-k8s",
  window: {"width":1180,"height":860,"maximized":true},
  i18n: {
    de: { name: 'Compose zu K8s', tagline: 'Eine Compose-Datei in Kubernetes-Manifeste umwandeln' },
    es: { name: 'Compose a K8s', tagline: 'Convertir un archivo compose en manifiestos de Kubernetes' },
    zh: { name: 'Compose 转 K8s', tagline: '把 compose 文件转成 Kubernetes 清单' },
  },
  load: () => import('./index.js'),
};
