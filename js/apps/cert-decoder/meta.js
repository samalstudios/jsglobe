export default {
  id: "cert-decoder",
  name: "Certificate Decoder",
  tagline: "Read an X.509 certificate or signing request",
  category: "crypto",
  glyph: "X5",
  icon: "certificate",
  keywords: ["certificate","x509","pem","ssl","tls","csr","fingerprint","expiry"],
  tag: "jg-app-cert-decoder",
  window: {"width":1100,"height":860},
  load: () => import('./index.js'),
};
