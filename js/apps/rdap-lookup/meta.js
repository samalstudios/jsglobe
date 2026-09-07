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
  load: () => import('./index.js'),
};
