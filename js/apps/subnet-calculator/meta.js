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
  i18n: {
    de: { name: 'Subnetzrechner', tagline: 'IPv4-CIDR-Bereiche, Masken und Hostanzahl' },
    es: { name: 'Calculadora de subredes', tagline: 'Rangos CIDR IPv4, máscaras y número de hosts' },
    zh: { name: '子网计算器', tagline: 'IPv4 CIDR 范围、掩码与主机数' },
  },
  load: () => import('./index.js'),
};
