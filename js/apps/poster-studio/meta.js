export default {
  id: "poster-studio",
  name: "Poster Studio",
  tagline: "Design posters and social variants with an event QR",
  category: "media",
  glyph: "P",
  icon: "image",
  tint: "#a8443c",
  keywords: ["poster","flyer","design","layout","template","event","qr","social","instagram","story","banner","print","typography"],
  tag: "jg-app-poster-studio",
  window: {"width":1240,"height":880,"maximized":true},
  i18n: {
    de: { name: 'Poster-Studio', tagline: 'Poster und Social-Varianten mit Event-QR gestalten' },
    es: { name: 'Estudio de carteles', tagline: 'Diseñar carteles y variantes sociales con un QR de evento' },
    zh: { name: '海报工作室', tagline: '设计海报与社交版本，附带活动二维码' },
  },
  load: () => import('./index.js'),
};
