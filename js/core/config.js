import { storage } from './storage.js';
import { bus } from './bus.js';
import { workspaces } from './workspaces.js';
import { appSettings } from './app-settings.js';

const schemaDefaults = (appId) => appSettings.defaults(appId);

export function appConfig(appId) {
  const storeKey = () => workspaces.key(`apps/${appId}`);

  return {
    all() {
      return { ...schemaDefaults(appId), ...storage.get(storeKey(), {}) };
    },

    get(key, fallback) {
      const value = this.all()[key];
      return value === undefined ? fallback : value;
    },

    set(key, value) {
      const next = { ...this.all(), [key]: value };
      storage.set(storeKey(), next);
      bus.emit('config:change', { appId, key, value });
      return next;
    },

    patch(entries) {
      const next = { ...this.all(), ...entries };
      storage.set(storeKey(), next);
      bus.emit('config:change', { appId, key: '*', value: next });
      return next;
    },

    reset() {
      storage.remove(storeKey());
      bus.emit('config:change', { appId, key: '*', value: this.all() });
    },
  };
}

export function appState(appId) {
  const storeKey = () => workspaces.key(`state/${appId}`);
  return {
    read: (fallback = null) => storage.get(storeKey(), fallback),
    write: (value) => storage.set(storeKey(), value),
    clear: () => storage.remove(storeKey()),
  };
}
