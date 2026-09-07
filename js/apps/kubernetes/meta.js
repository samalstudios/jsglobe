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
  load: () => import('./index.js'),
};
