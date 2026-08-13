import { storage } from './storage.js';
import { bus } from './bus.js';
import { workspaces } from './workspaces.js';

const key = () => workspaces.key('usage');

const read = () => storage.get(key(), {});

export const usage = {
  all: read,

  record(appId) {
    const data = read();
    const entry = data[appId] ?? { count: 0, last: 0 };
    data[appId] = { count: entry.count + 1, last: Date.now() };
    storage.set(key(), data);
    bus.emit('usage:change', data);
  },

  count: (appId) => read()[appId]?.count ?? 0,

  top(limit = 5, exclude = []) {
    return Object.entries(read())
      .filter(([appId]) => !exclude.includes(appId))
      .sort((a, b) => b[1].count - a[1].count || b[1].last - a[1].last)
      .slice(0, limit)
      .map(([appId]) => appId);
  },

  recents(limit = 4, exclude = []) {
    return Object.entries(read())
      .filter(([appId]) => !exclude.includes(appId))
      .sort((a, b) => b[1].last - a[1].last)
      .slice(0, limit)
      .map(([appId]) => appId);
  },

  clear() {
    storage.remove(key());
    bus.emit('usage:change', {});
  },
};
