import { storage } from './storage.js';
import { bus } from './bus.js';
import { uid } from './util.js';

const LIST_KEY = 'workspaces';
const ACTIVE_KEY = 'workspaces/active';

const seed = () => [{ id: 'personal', name: 'Personal', kind: 'personal', tint: '#6f7cff', created: Date.now() }];

let list = storage.get(LIST_KEY, null) ?? seed();
let activeId = storage.get(ACTIVE_KEY, list[0].id);

if (!list.some((item) => item.id === activeId)) activeId = list[0].id;

const persist = () => {
  storage.set(LIST_KEY, list);
  storage.set(ACTIVE_KEY, activeId);
};

persist();

export const workspaces = {
  all: () => list.map((item) => ({ ...item })),

  active: () => ({ ...(list.find((item) => item.id === activeId) ?? list[0]) }),

  get activeId() {
    return activeId;
  },

  key(suffix) {
    return `ws/${activeId}/${suffix}`;
  },

  keyFor(id, suffix) {
    return `ws/${id}/${suffix}`;
  },

  create({ name, kind = 'personal', tint = '#6f7cff' }) {
    const workspace = { id: uid().slice(0, 8), name: name.trim() || 'Untitled', kind, tint, created: Date.now() };
    list = [...list, workspace];
    persist();
    bus.emit('workspaces:change', workspaces.all());
    return workspace;
  },

  update(id, patch) {
    list = list.map((item) => (item.id === id ? { ...item, ...patch } : item));
    persist();
    bus.emit('workspaces:change', workspaces.all());
  },

  remove(id) {
    if (list.length === 1) return false;
    storage.clear(`ws/${id}/`);
    list = list.filter((item) => item.id !== id);
    if (activeId === id) activeId = list[0].id;
    persist();
    bus.emit('workspaces:change', workspaces.all());
    bus.emit('workspace:switch', workspaces.active());
    return true;
  },

  switchTo(id) {
    if (id === activeId || !list.some((item) => item.id === id)) return;
    activeId = id;
    persist();
    bus.emit('workspace:switch', workspaces.active());
  },

  duplicate(id, name) {
    const source = list.find((item) => item.id === id);
    if (!source) return null;
    const copy = workspaces.create({ name: name || `${source.name} copy`, kind: source.kind, tint: source.tint });
    const data = storage.snapshot(`ws/${id}/`);
    Object.entries(data).forEach(([key, value]) => {
      storage.set(key.replace(`ws/${id}/`, `ws/${copy.id}/`), value);
    });
    return copy;
  },

  export(id = activeId) {
    const workspace = list.find((item) => item.id === id);
    return {
      format: 'jsglobe.workspace',
      version: 1,
      exported: new Date().toISOString(),
      workspace: { name: workspace.name, kind: workspace.kind, tint: workspace.tint },
      data: Object.fromEntries(
        Object.entries(storage.snapshot(`ws/${id}/`)).map(([key, value]) => [key.replace(`ws/${id}/`, ''), value]),
      ),
    };
  },

  import(payload, { name } = {}) {
    if (payload?.format !== 'jsglobe.workspace') throw new Error('Unrecognised workspace file');
    const created = workspaces.create({
      name: name || payload.workspace?.name || 'Imported',
      kind: payload.workspace?.kind || 'personal',
      tint: payload.workspace?.tint,
    });
    Object.entries(payload.data ?? {}).forEach(([key, value]) => {
      storage.set(`ws/${created.id}/${key}`, value);
    });
    return created;
  },
};
