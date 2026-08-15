import { bus } from './bus.js';
import { storage } from './storage.js';

const SCAN_KEY = 'jg:app-settings:known';

const schemas = new Map();

export const appSettings = {
  define(appId, fields) {
    if (!appId || !Array.isArray(fields) || !fields.length) return;
    schemas.set(appId, fields);
    const known = new Set(storage.get(SCAN_KEY, []));
    if (!known.has(appId)) {
      known.add(appId);
      storage.set(SCAN_KEY, [...known]);
    }
    bus.emit('app-settings:define', { appId, fields });
  },

  schema: (appId) => schemas.get(appId) ?? [],

  has: (appId) => schemas.has(appId),

  ids: () => [...schemas.keys()],

  known: () => [...new Set([...storage.get(SCAN_KEY, []), ...schemas.keys()])],

  defaults(appId) {
    return Object.fromEntries(this.schema(appId).map((field) => [field.key, field.default]));
  },

  forget(ids) {
    storage.set(SCAN_KEY, storage.get(SCAN_KEY, []).filter((id) => !ids.includes(id)));
  },
};
