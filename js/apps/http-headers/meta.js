export default {
  id: "http-headers",
  name: "Header Review",
  tagline: "Grade response headers for security and privacy",
  category: "web",
  glyph: "H",
  icon: "headers",
  keywords: ["http","headers","security","csp","hsts","cookies","audit","response"],
  tag: "jg-app-http-headers",
  window: {"width":1120,"height":840},
  load: () => import('./index.js'),
};
