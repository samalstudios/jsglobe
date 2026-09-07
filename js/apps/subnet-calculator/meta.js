export default {
  id: "subnet-calculator",
  name: "Subnet Calculator",
  tagline: "IPv4 CIDR ranges, masks and host counts",
  category: "network",
  glyph: "/24",
  icon: "network",
  tint: "#14b8a6",
  keywords: ["subnet","cidr","ipv4","netmask","network"],
  tag: "jg-app-subnet",
  load: () => import('./index.js'),
};
