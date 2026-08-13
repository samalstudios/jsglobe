import { storage } from './storage.js';
import { bus } from './bus.js';
import { workspaces } from './workspaces.js';
import { wallpaperCss } from './wallpapers.js';

export const defaults = {
  'appearance.theme': 'auto',
  'appearance.wallpaper': 'grid',
  'appearance.ring': '#8a1c3b',
  'appearance.density': 'cozy',
  'appearance.iconTint': 'category',
  'appearance.motion': true,
  'home.iconSize': 'medium',
  'home.labels': true,
  'home.dock': true,
  'dock.position': 'left',
  'dock.autoHide': true,
  'dock.mode': 'auto',
  'dock.recents': true,
  'home.widgets': false,
  'home.searchPage': true,
  'home.mostUsed': true,
  'home.groups': false,
  'home.columns': 'auto',
  'behavior.openMode': 'window',
  'behavior.singleWindow': false,
  'behavior.autoRun': true,
  'behavior.spotlightHotkey': true,
  'ai.provider': 'webllm',
  'ai.model': 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
  'ai.moduleUrl': 'https://esm.run/@mlc-ai/web-llm',
  'ai.endpoint': 'http://localhost:11434/v1',
  'ai.apiKey': '',
  'ai.temperature': 0.7,
  'ai.maxTokens': 1024,
  'speech.engine': 'whisper',
  'speech.moduleUrl': 'https://esm.run/@huggingface/transformers',
  'speech.model': 'onnx-community/whisper-base',
  'media.moduleUrl': 'https://esm.run/@ffmpeg/ffmpeg@0.12.10',
  'media.coreUrl': 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd',
};

let cache = null;

const load = () => {
  cache = { ...defaults, ...storage.get(workspaces.key('settings'), {}) };
  return cache;
};

bus.on('workspace:switch', () => {
  cache = null;
  bus.emit('settings:change', settings.all());
});

export const settings = {
  all() {
    return { ...(cache ?? load()) };
  },

  get(path, fallback) {
    const value = (cache ?? load())[path];
    return value === undefined ? (fallback !== undefined ? fallback : defaults[path]) : value;
  },

  set(path, value) {
    const next = { ...(cache ?? load()), [path]: value };
    cache = next;
    storage.set(workspaces.key('settings'), next);
    bus.emit('settings:change', { ...next, changed: path });
  },

  patch(entries) {
    const next = { ...(cache ?? load()), ...entries };
    cache = next;
    storage.set(workspaces.key('settings'), next);
    bus.emit('settings:change', { ...next, changed: '*' });
  },

  reset() {
    cache = { ...defaults };
    storage.set(workspaces.key('settings'), {});
    bus.emit('settings:change', { ...cache, changed: '*' });
  },
};

export function applyTheme() {
  const root = document.documentElement;
  const theme = settings.get('appearance.theme');
  const resolved =
    theme === 'auto' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : theme;
  root.dataset.theme = resolved;
  root.dataset.wallpaper = settings.get('appearance.wallpaper');
  root.style.setProperty('--wallpaper', wallpaperCss(settings.get('appearance.wallpaper'), resolved));
  root.dataset.density = settings.get('appearance.density');
  root.dataset.motion = settings.get('appearance.motion') ? 'on' : 'off';
  root.style.setProperty('--ring', settings.get('appearance.ring'));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', settings.get('appearance.ring'));
}

export function watchTheme() {
  applyTheme();
  bus.on('settings:change', applyTheme);
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (settings.get('appearance.theme') === 'auto') applyTheme();
  });
}
