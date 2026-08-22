export default {
  id: "rdap-lookup",
  name: "Domain Lookup",
  tagline: "RDAP records for a domain, IP or network",
  category: "network",
  glyph: "W",
  icon: "globe",
  keywords: ["whois","rdap","domain","registrar","expiry","ip","asn","nameserver"],
  tag: "jg-app-rdap-lookup",
  window: {"width":900,"height":860},
  i18n: {
    de: { name: 'Domain-Abfrage', tagline: 'RDAP-Daten zu einer Domain, IP oder einem Netz' },
    es: { name: 'Consulta de dominio', tagline: 'Registros RDAP de un dominio, IP o red' },
    zh: { name: '域名查询', tagline: '域名、IP 或网段的 RDAP 记录' },
  },
  load: () => import('./index.js'),
};
