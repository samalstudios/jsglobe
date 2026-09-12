export default {
  id: "gif-maker",
  name: "GIF Maker",
  tagline: "Turn pictures or a video clip into an animated GIF",
  category: "media",
  glyph: "GIF",
  icon: "film",
  tint: "#c2410c",
  keywords: ["gif","animated gif","gif maker","video to gif","images to gif","animation","gif editor","boomerang","frames","loop"],
  tag: "jg-app-gif-maker",
  load: () => import('./index.js'),
};
