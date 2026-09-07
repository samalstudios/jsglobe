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
  load: () => import('./index.js'),
};
