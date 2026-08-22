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
  i18n: {
    de: { name: 'Serielle Konsole', tagline: 'Mit einem seriellen Gerät über USB sprechen' },
    es: { name: 'Consola serie', tagline: 'Hablar con un dispositivo serie por USB' },
    zh: { name: '串口终端', tagline: '通过 USB 与串口设备通信' },
  },
  load: () => import('./index.js'),
};
