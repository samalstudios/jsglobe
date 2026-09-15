export default {
  id: "file-manager",
  name: "File Manager",
  tagline: "Open a folder on your computer to browse, preview, edit and organise its files",
  category: "utility",
  glyph: "FM",
  icon: "folder",
  tint: "#2f7de1",
  keywords: ["file manager","file explorer","file browser","finder","open folder","local files","rename files","preview files","text editor","file system access"],
  tag: "jg-app-file-manager",
  window: {"width":1180,"height":760},
  load: () => import('./index.js'),
};
