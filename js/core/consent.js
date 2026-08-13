import { storage } from './storage.js';
import { bus } from './bus.js';

const KEY = 'privacy/consent';
const VERSION = 1;

export const consent = {
  get record() {
    return storage.get(KEY, null);
  },

  get state() {
    const record = consent.record;
    if (!record || record.version !== VERSION) return 'unknown';
    return record.analytics ? 'granted' : 'denied';
  },

  get decided() {
    return consent.state !== 'unknown';
  },

  get granted() {
    return consent.state === 'granted';
  },

  set(analytics) {
    storage.set(KEY, { version: VERSION, analytics: Boolean(analytics), at: new Date().toISOString() });
    bus.emit('consent:change', { state: consent.state });
  },

  reset() {
    storage.remove(KEY);
    bus.emit('consent:change', { state: consent.state });
  },
};
