import { bus } from './bus.js';
import { settings } from './settings.js';

const state = { status: 'idle', message: '', ffmpeg: null, loading: null };

const setStatus = (status, message = '') => {
  Object.assign(state, { status, message });
  bus.emit('media:status', { status, message });
};

const toBlobUrl = async (url, type) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not fetch ${url} (${response.status})`);
  return URL.createObjectURL(new Blob([await response.arrayBuffer()], { type }));
};

export const media = {
  state: () => ({ status: state.status, message: state.message }),

  get moduleUrl() {
    return settings.get('media.moduleUrl');
  },

  get coreUrl() {
    return settings.get('media.coreUrl');
  },

  reset() {
    state.ffmpeg = null;
    state.loading = null;
    setStatus('idle');
  },

  async engine({ onLog } = {}) {
    if (state.ffmpeg) return state.ffmpeg;
    if (state.loading) return state.loading;

    state.loading = (async () => {
      setStatus('loading', 'Fetching the encoder');
      const module = await import(/* @vite-ignore */ media.moduleUrl);
      const FFmpeg = module.FFmpeg ?? module.default?.FFmpeg;
      if (!FFmpeg) throw new Error('That module does not export FFmpeg');

      const ffmpeg = new FFmpeg();
      ffmpeg.on('log', ({ message }) => onLog?.(message));

      const base = media.coreUrl.replace(/\/+$/, '');
      setStatus('loading', 'Loading the WebAssembly core');
      await ffmpeg.load({
        coreURL: await toBlobUrl(`${base}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobUrl(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
      });

      state.ffmpeg = ffmpeg;
      state.loading = null;
      setStatus('ready', 'Encoder ready');
      return ffmpeg;
    })();

    try {
      return await state.loading;
    } catch (error) {
      state.loading = null;
      setStatus('error', error.message);
      throw error;
    }
  },

  async run({ file, args, output, onProgress, onLog }) {
    const ffmpeg = await media.engine({ onLog });
    const input = `input${file.name.match(/\.[^.]+$/)?.[0] ?? ''}`;

    const listener = ({ progress }) => onProgress?.(Math.min(100, Math.round(progress * 100)));
    ffmpeg.on('progress', listener);

    try {
      setStatus('working', 'Transcoding');
      await ffmpeg.writeFile(input, new Uint8Array(await file.arrayBuffer()));
      await ffmpeg.exec(['-i', input, ...args, output]);
      const data = await ffmpeg.readFile(output);
      await ffmpeg.deleteFile(input).catch(() => {});
      await ffmpeg.deleteFile(output).catch(() => {});
      setStatus('ready', 'Done');
      return new Blob([data.buffer ?? data], { type: '' });
    } catch (error) {
      setStatus('error', error.message);
      throw error;
    } finally {
      ffmpeg.off?.('progress', listener);
    }
  },
};

bus.on('settings:change', (detail) => {
  if (detail.changed?.startsWith('media.') || detail.changed === '*') media.reset();
});
