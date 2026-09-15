import { storage } from './storage.js';
import { bus } from './bus.js';
import { workspaces } from './workspaces.js';
import { wallpaperCss } from './wallpapers.js';

export const defaults = {
  'appearance.theme': 'auto',
  'appearance.wallpaper': 'horizon',
  'appearance.ring': '#8a1c3b',
  'appearance.density': 'cozy',
  'appearance.iconTint': 'category',
  'appearance.icons': 'skeuomorphic',
  'appearance.motion': true,
  'home.iconSize': 'medium',
  'home.labels': true,
  'home.dock': true,
  'dock.position': 'left',
  'dock.scope': 'search',
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
  'ai.embedModel': 'snowflake-arctic-embed-s-q0f32-MLC-b4',
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

// Settings are saved as the choices that differ from the defaults, so a better
// default reaches everyone who never picked otherwise. Older saves held every
// value; the one time they are read, the icon style is dropped (the styles
// themselves changed) along with values equal to a default that has since
// changed.
const VERSION = 2;
const DISCARDED = ['appearance.icons'];
const RETIRED_DEFAULTS = { 'appearance.wallpaper': 'grid' };

const save = (values) => {
  const choices = Object.fromEntries(Object.entries(values).filter(([key, value]) => key !== 'version' && value !== defaults[key]));
  storage.set(workspaces.key('settings'), { ...choices, version: VERSION });
};

const load = () => {
  const stored = { ...storage.get(workspaces.key('settings'), {}) };
  if ((stored.version ?? 1) < VERSION) {
    for (const key of DISCARDED) delete stored[key];
    for (const [key, retired] of Object.entries(RETIRED_DEFAULTS)) if (stored[key] === retired) delete stored[key];
    save({ ...defaults, ...stored });
  }
  delete stored.version;
  cache = { ...defaults, ...stored };
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
    save(next);
    bus.emit('settings:change', { ...next, changed: path });
  },

  patch(entries) {
    const next = { ...(cache ?? load()), ...entries };
    cache = next;
    save(next);
    bus.emit('settings:change', { ...next, changed: '*' });
  },

  reset() {
    cache = { ...defaults };
    save(cache);
    bus.emit('settings:change', { ...cache, changed: '*' });
  },
};

// the theme in use: the one chosen, or the system's when following it
export const resolvedTheme = () => {
  const theme = settings.get('appearance.theme');
  return theme === 'auto' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : theme;
};

export function applyTheme() {
  const root = document.documentElement;
  const resolved = resolvedTheme();
  root.dataset.theme = resolved;
  root.dataset.wallpaper = settings.get('appearance.wallpaper');
  root.style.setProperty('--wallpaper', wallpaperCss(settings.get('appearance.wallpaper'), resolved));
  root.dataset.icons = settings.get('appearance.icons');
  root.dataset.density = settings.get('appearance.density');
  root.dataset.motion = settings.get('appearance.motion') ? 'on' : 'off';
  root.style.setProperty('--ring', settings.get('appearance.ring'));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', settings.get('appearance.ring'));
}

export function watchTheme() {
  applyTheme();
  bus.on('settings:change', applyTheme);
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (settings.get('appearance.theme') !== 'auto') return;
    applyTheme();
    // icons and other drawings follow the theme, so the interface repaints
    bus.emit('settings:change', { ...settings.all(), changed: 'appearance.theme' });
  });
}
