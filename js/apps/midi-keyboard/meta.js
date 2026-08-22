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
  i18n: {
    de: { name: 'MIDI-Keyboard', tagline: 'Spielbarer Synthesizer mit Computertastatur und MIDI-Eingang' },
    es: { name: 'Teclado MIDI', tagline: 'Sintetizador con el teclado del ordenador y entrada MIDI' },
    zh: { name: 'MIDI 键盘', tagline: '可用电脑键盘与 MIDI 输入演奏的合成器' },
  },
  load: () => import('./index.js'),
};
