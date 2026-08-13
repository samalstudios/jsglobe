import { bus } from './bus.js';
import { settings } from './settings.js';

export const MODELS = [
  { id: 'Llama-3.2-1B-Instruct-q4f32_1-MLC', label: 'Llama 3.2 1B', size: '~0.9 GB', note: 'Fastest, good for short tasks' },
  { id: 'Llama-3.2-3B-Instruct-q4f32_1-MLC', label: 'Llama 3.2 3B', size: '~2.2 GB', note: 'Balanced quality and speed' },
  { id: 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC', label: 'Qwen 2.5 1.5B', size: '~1.2 GB', note: 'Strong at code and structure' },
  { id: 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC', label: 'Qwen 2.5 Coder 1.5B', size: '~1.1 GB', note: 'Tuned for programming' },
  { id: 'Phi-3.5-mini-instruct-q4f16_1-MLC', label: 'Phi 3.5 Mini', size: '~2.1 GB', note: 'Good reasoning for its size' },
  { id: 'gemma-2-2b-it-q4f16_1-MLC', label: 'Gemma 2 2B', size: '~1.6 GB', note: 'Well rounded assistant' },
];

const state = {
  status: 'idle',
  progress: 0,
  message: '',
  model: null,
  engine: null,
  loading: null,
};

const setStatus = (status, patch = {}) => {
  Object.assign(state, { status }, patch);
  bus.emit('ai:status', ai.state());
};

async function endpointChat(messages, { onDelta, signal, temperature, maxTokens }) {
  const base = settings.get('ai.endpoint').replace(/\/+$/, '');
  const key = settings.get('ai.apiKey');
  setStatus('generating', { message: 'Contacting local server' });

  try {
    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify({
        model: settings.get('ai.model'),
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      }),
    });

    if (!response.ok) throw new Error(`Server responded ${response.status}`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const payload = line.replace(/^data:\s*/, '').trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const delta = JSON.parse(payload).choices?.[0]?.delta?.content ?? '';
          if (!delta) continue;
          text += delta;
          onDelta?.(delta, text);
        } catch {
          continue;
        }
      }
    }

    setStatus('ready', { message: 'Connected' });
    return text;
  } catch (error) {
    setStatus('error', { message: error.message });
    throw error;
  }
}

export const ai = {
  models: MODELS,

  state: () => ({ status: state.status, progress: state.progress, message: state.message, model: state.model }),

  get provider() {
    return settings.get('ai.provider');
  },

  get model() {
    return settings.get('ai.model');
  },

  isEnabled() {
    return ai.provider !== 'off';
  },

  supportsWebGpu() {
    return Boolean(navigator.gpu);
  },

  describe() {
    if (ai.provider === 'off') return 'AI features are turned off.';
    if (ai.provider === 'endpoint') return `Local server at ${settings.get('ai.endpoint')}`;
    const model = MODELS.find((item) => item.id === ai.model);
    return `${model?.label ?? ai.model} running in this browser`;
  },

  reset() {
    state.engine = null;
    state.loading = null;
    setStatus('idle', { progress: 0, message: '', model: null });
  },

  async engine() {
    if (state.engine && state.model === ai.model) return state.engine;
    if (state.loading) return state.loading;

    if (!ai.supportsWebGpu()) {
      setStatus('error', { message: 'This browser has no WebGPU support. Use Chrome or Edge 121+, or switch to a local server in Settings.' });
      throw new Error('WebGPU unavailable');
    }

    const moduleUrl = settings.get('ai.moduleUrl');
    const model = ai.model;

    state.loading = (async () => {
      setStatus('loading', { progress: 0, message: 'Fetching runtime', model });
      const webllm = await import(/* @vite-ignore */ moduleUrl);
      const create = webllm.CreateMLCEngine ?? webllm.default?.CreateMLCEngine;
      if (!create) throw new Error('The module at that URL is not WebLLM');

      const engine = await create(model, {
        initProgressCallback: (report) => {
          setStatus('loading', {
            progress: Math.round((report.progress ?? 0) * 100),
            message: report.text ?? 'Loading model',
            model,
          });
        },
      });

      state.engine = engine;
      state.model = model;
      state.loading = null;
      setStatus('ready', { progress: 100, message: 'Model ready', model });
      return engine;
    })();

    try {
      return await state.loading;
    } catch (error) {
      state.loading = null;
      setStatus('error', { message: error.message });
      throw error;
    }
  },

  async chat(messages, { onDelta, signal } = {}) {
    const temperature = Number(settings.get('ai.temperature'));
    const maxTokens = Number(settings.get('ai.maxTokens'));

    if (ai.provider === 'endpoint') {
      return endpointChat(messages, { onDelta, signal, temperature, maxTokens });
    }

    const engine = await ai.engine();
    setStatus('generating', { message: 'Generating' });
    let text = '';
    try {
      const stream = await engine.chat.completions.create({
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      });
      for await (const chunk of stream) {
        if (signal?.aborted) break;
        const delta = chunk.choices?.[0]?.delta?.content ?? '';
        if (!delta) continue;
        text += delta;
        onDelta?.(delta, text);
      }
    } finally {
      setStatus('ready', { message: 'Model ready' });
    }
    return text;
  },

  async complete(system, user, options = {}) {
    return ai.chat(
      [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      options,
    );
  },
};

bus.on('settings:change', (detail) => {
  if (detail.changed === 'ai.model' || detail.changed === 'ai.provider' || detail.changed === '*') ai.reset();
});
