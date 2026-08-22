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
  i18n: {
    de: { name: 'Zertifikat-Decoder', tagline: 'X.509-Zertifikate und Signieranfragen lesen' },
    es: { name: 'Decodificador de certificados', tagline: 'Leer un certificado X.509 o una solicitud de firma' },
    zh: { name: '证书解码', tagline: '读取 X.509 证书或签名请求' },
  },
  load: () => import('./index.js'),
};
