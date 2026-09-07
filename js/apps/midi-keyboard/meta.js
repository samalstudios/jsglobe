export default {
  id: "midi-keyboard",
  name: "MIDI Keyboard",
  tagline: "Playable synth with computer keyboard and MIDI input",
  category: "play",
  glyph: "♪",
  icon: "piano",
  tint: "#f59e0b",
  keywords: ["midi","piano","keyboard","synth","music","notes","audio"],
  tag: "jg-app-midi-keyboard",
  window: {"width":900,"height":720},
  load: () => import('./index.js'),
};
