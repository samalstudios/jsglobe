export default {
  id: "voice-recorder",
  name: "Voice Recorder",
  tagline: "Record audio and transcribe it on this device",
  category: "media",
  glyph: "●",
  icon: "mic",
  tint: "#be123c",
  keywords: ["voice","record","audio","memo","transcribe","whisper","speech","dictate","notes"],
  tag: "jg-app-voice-recorder",
  window: {"width":860,"height":880},
  i18n: {
    de: { name: 'Sprachaufnahme', tagline: 'Audio aufnehmen und auf diesem Gerät transkribieren' },
    es: { name: 'Grabadora de voz', tagline: 'Grabar audio y transcribirlo en este dispositivo' },
    zh: { name: '录音', tagline: '录制音频并在本机转写' },
  },
  load: () => import('./index.js'),
};
