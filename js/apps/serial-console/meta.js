export default {
  id: "serial-console",
  name: "Serial Console",
  tagline: "Talk to a serial device over USB",
  category: "utility",
  glyph: ">",
  icon: "serial",
  tint: "#5b6470",
  keywords: ["serial","uart","usb","tty","console","arduino","esp32","baud","rs232"],
  tag: "jg-app-serial-console",
  window: {"width":960,"height":720},
  load: () => import('./index.js'),
};
