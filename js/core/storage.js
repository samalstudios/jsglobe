const PREFIX = 'jsglobe/v1/';

const memory = new Map();

const backend = (() => {
  try {
    const probe = `${PREFIX}probe`;
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return {
      getItem: (key) => (memory.has(key) ? memory.get(key) : null),
      setItem: (key, value) => memory.set(key, value),
      removeItem: (key) => memory.delete(key),
      key: (index) => [...memory.keys()][index] ?? null,
      get length() {
        return memory.size;
      },
    };
  }
})();

export const storage = {
  get(key, fallback = null) {
    const value = backend.getItem(PREFIX + key);
    if (value === null) return fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  },

  set(key, value) {
    try {
      backend.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      return false;
    }
    return true;
  },

  remove(key) {
    backend.removeItem(PREFIX + key);
  },

  keys(prefix = '') {
    const scope = PREFIX + prefix;
    const found = [];
    for (let i = 0; i < backend.length; i += 1) {
      const key = backend.key(i);
      if (key && key.startsWith(scope)) found.push(key.slice(PREFIX.length));
    }
    return found;
  },

  clear(prefix = '') {
    storage.keys(prefix).forEach((key) => storage.remove(key));
  },

  snapshot(prefix = '') {
    return Object.fromEntries(storage.keys(prefix).map((key) => [key, storage.get(key)]));
  },

  restore(entries) {
    Object.entries(entries).forEach(([key, value]) => storage.set(key, value));
  },
};
