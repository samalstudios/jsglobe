import { bus } from './bus.js';
import { settings } from './settings.js';

const state = { status: 'idle', message: '', pipeline: null, loading: null, model: null };

const setStatus = (status, message = '') => {
  Object.assign(state, { status, message });
  bus.emit('speech:status', { status, message, progress: state.progress ?? 0 });
};

export const WHISPER_MODELS = [
  { id: 'onnx-community/whisper-tiny.en', label: 'Whisper tiny (English)', size: '~40 MB' },
  { id: 'onnx-community/whisper-base', label: 'Whisper base (multilingual)', size: '~80 MB' },
  { id: 'onnx-community/whisper-small', label: 'Whisper small (multilingual)', size: '~250 MB' },
];

export const speech = {
  state: () => ({ status: state.status, message: state.message }),

  get engine() {
    return settings.get('speech.engine');
  },

  supportsBrowser() {
    return Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition);
  },

  reset() {
    state.pipeline = null;
    state.loading = null;
    setStatus('idle');
  },

  async whisper() {
    const model = settings.get('speech.model');
    if (state.pipeline && state.model === model) return state.pipeline;
    if (state.loading) return state.loading;

    state.loading = (async () => {
      setStatus('loading', 'Fetching the speech runtime');
      const module = await import(/* @vite-ignore */ settings.get('speech.moduleUrl'));
      const pipeline = module.pipeline ?? module.default?.pipeline;
      if (!pipeline) throw new Error('That module does not export a pipeline');

      const transcriber = await pipeline('automatic-speech-recognition', model, {
        device: navigator.gpu ? 'webgpu' : 'wasm',
        progress_callback: (report) => {
          if (report.status === 'progress' && report.total) {
            state.progress = Math.round((report.loaded / report.total) * 100);
            setStatus('loading', `Downloading ${report.file}`);
          }
        },
      });

      state.pipeline = transcriber;
      state.model = model;
      state.loading = null;
      setStatus('ready', 'Speech model ready');
      return transcriber;
    })();

    try {
      return await state.loading;
    } catch (error) {
      state.loading = null;
      setStatus('error', error.message);
      throw error;
    }
  },

  async toMono16k(blob) {
    const context = new (window.AudioContext ?? window.webkitAudioContext)();
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    await context.close();

    const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * 16000)), 16000);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return { audio: rendered.getChannelData(0), duration: decoded.duration };
  },

  async transcribe(blob, { language, onProgress } = {}) {
    const transcriber = await speech.whisper();
    setStatus('working', 'Transcribing');
    onProgress?.('Preparing audio');
    const { audio } = await speech.toMono16k(blob);

    onProgress?.('Running the model');
    const result = await transcriber(audio, {
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: true,
      ...(language && language !== 'auto' ? { language, task: 'transcribe' } : {}),
    });

    setStatus('ready', 'Speech model ready');
    return {
      text: (result.text ?? '').trim(),
      chunks: (result.chunks ?? []).map((chunk) => ({
        text: chunk.text.trim(),
        start: chunk.timestamp?.[0] ?? 0,
        end: chunk.timestamp?.[1] ?? 0,
      })),
    };
  },

  listen({ language = 'en-US', onPartial, onFinal, onEnd } = {}) {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) throw new Error('This browser has no speech recognition');

    const recognition = new Recognition();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;

    let settled = '';
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) settled += `${result[0].transcript.trim()} `;
        else interim += result[0].transcript;
      }
      onPartial?.(`${settled}${interim}`.trim());
    };
    recognition.onerror = (event) => onEnd?.(event.error);
    recognition.onend = () => {
      onFinal?.(settled.trim());
      onEnd?.();
    };

    recognition.start();
    return recognition;
  },
};

bus.on('settings:change', (detail) => {
  if (detail.changed?.startsWith('speech.') || detail.changed === '*') speech.reset();
});
