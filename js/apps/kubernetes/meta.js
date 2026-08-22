export default {
  id: "kubernetes",
  name: "Kubernetes",
  tagline: "Generate deployment, service and ingress manifests",
  category: "development",
  glyph: "K8s",
  icon: "helm",
  keywords: ["kubernetes","k8s","manifest","deployment","service","ingress","yaml","devops"],
  tag: "jg-app-kubernetes",
  window: {"width":1140,"height":880},
  i18n: {
    de: { name: 'Kubernetes', tagline: 'Deployment-, Service- und Ingress-Manifeste erzeugen' },
    es: { name: 'Kubernetes', tagline: 'Generar manifiestos de deployment, service e ingress' },
    zh: { name: 'Kubernetes', tagline: '生成 deployment、service 与 ingress 清单' },
  },
  load: () => import('./index.js'),
};
