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
  load: () => import('./index.js'),
};
