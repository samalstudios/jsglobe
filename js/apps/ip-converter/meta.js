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
  i18n: {
    de: { name: 'IP-Konverter', tagline: 'IPv4 dezimal, hexadezimal, binär und oktal' },
    es: { name: 'Conversor de IP', tagline: 'IPv4 en decimal, hexadecimal, binario y octal' },
    zh: { name: 'IP 转换', tagline: '十进制、十六进制、二进制与八进制的 IPv4' },
  },
  load: () => import('./index.js'),
};
