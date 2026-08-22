export default {
  id: "gamepad-tester",
  name: "Gamepad Tester",
  tagline: "Check every stick, trigger and button",
  category: "utility",
  glyph: "⊕",
  icon: "joystick",
  tint: "#9c6440",
  keywords: ["gamepad","joystick","controller","xbox","playstation","test","axes","buttons","rumble"],
  tag: "jg-app-gamepad-tester",
  widget: true,
  window: {"width":900,"height":820},
  i18n: {
    de: { name: 'Gamepad-Tester', tagline: 'Jeden Stick, Trigger und Knopf prüfen' },
    es: { name: 'Probador de mando', tagline: 'Comprobar cada stick, gatillo y botón' },
    zh: { name: '手柄测试', tagline: '检查每个摇杆、扳机与按键' },
  },
  load: () => import('./index.js'),
};
