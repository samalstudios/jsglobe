export default {
  id: "ip-converter",
  name: "IP Converter",
  tagline: "IPv4 in decimal, hex, binary and octal",
  category: "network",
  glyph: "IP",
  icon: "globe",
  tint: "#0d9488",
  keywords: ["ip","ipv4","convert","decimal","binary"],
  tag: "jg-app-ip-converter",
  load: () => import('./index.js'),
};
