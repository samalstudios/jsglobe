export default {
  id: "git-viewer",
  name: "Git Viewer",
  tagline: "Open a git repository on your computer to see its commit graph, diffs and insights like hotspots and bus factor",
  category: "development",
  glyph: "GIT",
  icon: "github",
  tint: "#f05133",
  keywords: ["git","git viewer","git log","git graph","commit history","git client","branches","diff viewer","git status","repository browser","git insights","code churn","hotspots","bus factor","commit activity","codebase audit"],
  tag: "jg-app-git-viewer",
  window: {"width":1240,"height":800,"maximized":true},
  load: () => import('./index.js'),
};
