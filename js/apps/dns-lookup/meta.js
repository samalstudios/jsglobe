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
  load: () => import('./index.js'),
};
