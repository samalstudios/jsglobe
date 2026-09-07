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
  load: () => import('./index.js'),
};
