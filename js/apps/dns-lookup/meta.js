export default {
  id: "dns-lookup",
  name: "DNS Lookup",
  tagline: "Dig style record lookups over DNS-over-HTTPS",
  category: "network",
  glyph: "DNS",
  icon: "server2",
  tint: "#0f766e",
  keywords: ["dns","dig","nslookup","records","mx","txt","ns","ptr","domain"],
  tag: "jg-app-dns-lookup",
  window: {"width":820,"height":780},
  i18n: {
    de: { name: 'DNS-Abfrage', tagline: 'Dig-artige Abfragen über DNS-over-HTTPS' },
    es: { name: 'Consulta DNS', tagline: 'Consultas tipo dig sobre DNS-over-HTTPS' },
    zh: { name: 'DNS 查询', tagline: '通过 DNS-over-HTTPS 进行 dig 式记录查询' },
  },
  load: () => import('./index.js'),
};
