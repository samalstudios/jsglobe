import { download, pickFile } from '../core/util.js';

const clean = (name) => name.trim().slice(0, 60);

export const createDesigns = (store, kind) => {
  const read = () => {
    const raw = store.read();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { open: typeof raw === 'string' ? raw : null, saved: {} };
    return { open: raw.open ?? null, saved: raw.saved ?? {} };
  };

  return {
    open: () => read().open,

    setOpen(name) {
      const state = read();
      state.open = name;
      store.write(state);
    },

    list: () =>
      Object.entries(read().saved)
        .map(([name, entry]) => ({ name, saved: entry.saved ?? 0 }))
        .sort((a, b) => b.saved - a.saved),

    get: (name) => read().saved[name]?.design ?? null,

    has: (name) => Boolean(read().saved[clean(name)]),

    save(name, design) {
      const key = clean(name);
      if (!key) return null;
      const state = read();
      state.saved[key] = { saved: Date.now(), design };
      state.open = key;
      store.write(state);
      return key;
    },

    remove(name) {
      const state = read();
      delete state.saved[name];
      if (state.open === name) state.open = null;
      store.write(state);
    },

    toFile(name, design) {
      const safe = name.replace(/[^\w\- ]+/g, '').trim() || kind;
      download(`${safe}.json`, JSON.stringify({ kind, name, design }, null, 2), 'application/json');
    },

    async fromFile() {
      const picked = await pickFile('application/json,.json');
      if (!picked) return null;
      let parsed;
      try {
        parsed = JSON.parse(picked.data);
      } catch {
        throw new Error('That file is not valid JSON.');
      }
      if (parsed?.kind !== kind) throw new Error('That file holds a different kind of design.');
      if (!parsed.design) throw new Error('That file has no design in it.');
      return { name: clean(parsed.name ?? picked.name.replace(/\.json$/i, '')) || 'Imported', design: parsed.design };
    },
  };
};
