import { storage } from './storage.js';
import { bus } from './bus.js';
import { workspaces } from './workspaces.js';
import { registry } from './registry.js';
import { uid } from './util.js';

const PAGE_SIZE = 32;
const FOLDER = 'folder:';

const DEFAULT_DOCK = ['json-formatter', 'hash-text', 'base64-converter', 'uuid-generator', 'settings'];

const FAVOURITES = [
  'physics-lab',
  'logic-lab',
  'circuit-lab',
  'paint',
  'molecule-viewer',
  'periodic-table',
  'pdf-studio',
  'poster-studio',
  'csv-studio',
  'svg-editor',
  'function-plotter',
  'exif-editor',
  'ai-chat',
  'ai-code',
  'json-formatter',
  'hash-text',
  'base64-converter',
  'uuid-generator',
  'jwt-parser',
  'regex-tester',
  'url-parser',
  'color-converter',
  'case-converter',
  'date-converter',
  'text-diff',
  'markdown-preview',
  'crontab-generator',
  'sql-formatter',
  'encryption',
  'math-evaluator',
  'unit-converter',
  'settings',
];

const DEFAULT_WIDGETS = [];

export const isFolder = (entry) => typeof entry === 'string' && entry.startsWith(FOLDER);
export const folderId = (entry) => entry.slice(FOLDER.length);
export const folderRef = (id) => `${FOLDER}${id}`;

const buildDefault = () => {
  const known = registry.all({ includeSystem: true }).map((app) => app.id);
  const favourites = FAVOURITES.filter((id) => known.includes(id));
  const rest = known.filter((id) => !favourites.includes(id));
  const pages = [favourites];
  for (let i = 0; i < rest.length; i += PAGE_SIZE) pages.push(rest.slice(i, i + PAGE_SIZE));

  return {
    pages: pages.filter((page) => page.length),
    folders: {},
    dock: DEFAULT_DOCK.filter((id) => known.includes(id)),
    widgets: DEFAULT_WIDGETS.map((widget) => ({ uid: uid().slice(0, 8), ...widget })),
    hidden: [],
  };
};

let cache = null;

const key = () => workspaces.key('layout');

const load = () => {
  const stored = storage.get(key(), null);
  return reconcile(stored ? { ...buildDefault(), ...stored } : buildDefault());
};

function reconcile(state) {
  const known = new Set(registry.all({ includeSystem: true }).map((app) => app.id));
  const folders = { ...(state.folders ?? {}) };

  Object.keys(folders).forEach((id) => {
    folders[id] = { ...folders[id], items: folders[id].items.filter((appId) => known.has(appId)) };
    if (!folders[id].items.length) delete folders[id];
  });

  const pages = state.pages.map((page) =>
    page.filter((entry) => (isFolder(entry) ? Boolean(folders[folderId(entry)]) : known.has(entry))),
  );

  const placed = new Set([
    ...pages.flat().filter((entry) => !isFolder(entry)),
    ...Object.values(folders).flatMap((folder) => folder.items),
  ]);

  const missing = [...known].filter((id) => !placed.has(id) && !state.hidden.includes(id));
  if (missing.length) {
    const last = pages[pages.length - 1] ?? [];
    if (last.length + missing.length <= PAGE_SIZE) pages[pages.length - 1] = [...last, ...missing];
    else pages.push(missing);
  }

  cache = {
    ...state,
    folders,
    pages: pages.filter((page, index) => page.length > 0 || index === 0),
    dock: state.dock.filter((id) => known.has(id)),
    widgets: state.widgets.filter((widget) => known.has(widget.appId)),
  };
  return cache;
}

const persist = () => {
  storage.set(key(), cache);
  bus.emit('layout:change', layout.state());
};

const mutate = (fn) => {
  const state = cache ?? load();
  cache = fn(structuredClone(state)) ?? state;
  persist();
};

bus.on('workspace:switch', () => {
  cache = null;
  bus.emit('layout:change', layout.state());
});

export const layout = {
  state() {
    return structuredClone(cache ?? load());
  },

  pages: () => layout.state().pages,

  dock: () => layout.state().dock,

  widgets: () => layout.state().widgets,

  folders: () => layout.state().folders,

  folder: (id) => layout.state().folders[id] ?? null,

  folderOf(appId) {
    const folders = layout.state().folders;
    return Object.values(folders).find((folder) => folder.items.includes(appId)) ?? null;
  },

  move(entry, pageIndex, position) {
    mutate((state) => {
      const pages = state.pages.map((page) => page.filter((item) => item !== entry));
      while (pages.length <= pageIndex) pages.push([]);
      const target = pages[pageIndex];
      target.splice(Math.min(position, target.length), 0, entry);
      state.pages = pages.filter((page, index) => page.length > 0 || index === 0);
      return state;
    });
  },

  addPage() {
    mutate((state) => {
      state.pages.push([]);
      return state;
    });
  },

  get grouped() {
    return Object.keys(layout.state().folders).length > 0;
  },

  groupByCategory() {
    mutate((state) => {
      const known = registry.all({ includeSystem: true }).map((app) => app.id);
      const favourites = FAVOURITES.filter((id) => known.includes(id) && !state.hidden.includes(id));
      const folders = {};
      const entries = [];

      registry.categories().forEach((category) => {
        const items = registry
          .byCategory(category.id)
          .map((app) => app.id)
          .filter((id) => !favourites.includes(id) && !state.hidden.includes(id));
        if (!items.length) return;
        folders[category.id] = { id: category.id, name: category.name, tint: category.tint, items };
        entries.push(folderRef(category.id));
      });

      const loose = known.filter(
        (id) => !state.hidden.includes(id) && !favourites.includes(id) && !Object.values(folders).some((folder) => folder.items.includes(id)),
      );

      state.folders = folders;
      state.pages = [[...favourites, ...loose], entries].filter((page) => page.length);
      return state;
    });
  },

  ungroupAll() {
    mutate((state) => {
      const items = Object.values(state.folders).flatMap((folder) => folder.items);
      state.folders = {};
      state.pages = state.pages.map((page) => page.filter((entry) => !isFolder(entry)));
      const pages = state.pages.filter((page) => page.length);
      const flat = [...pages.flat(), ...items];
      const rebuilt = [];
      for (let i = 0; i < flat.length; i += PAGE_SIZE) rebuilt.push(flat.slice(i, i + PAGE_SIZE));
      state.pages = rebuilt.length ? rebuilt : [[]];
      return state;
    });
  },

  createFolder(name, items = [], tint = '#6f7cff') {
    const id = uid().slice(0, 6);
    mutate((state) => {
      state.folders[id] = { id, name: name || 'Folder', tint, items };
      state.pages = state.pages.map((page) => page.filter((entry) => !items.includes(entry)));
      state.pages[0] = [folderRef(id), ...(state.pages[0] ?? [])];
      return state;
    });
    return id;
  },

  renameFolder(id, name) {
    mutate((state) => {
      if (state.folders[id]) state.folders[id].name = name;
      return state;
    });
  },

  dissolveFolder(id) {
    mutate((state) => {
      const folder = state.folders[id];
      if (!folder) return state;
      delete state.folders[id];
      state.pages = state.pages.map((page) =>
        page.flatMap((entry) => (entry === folderRef(id) ? folder.items : [entry])),
      );
      return state;
    });
  },

  addToFolder(id, appId) {
    mutate((state) => {
      Object.values(state.folders).forEach((folder) => {
        folder.items = folder.items.filter((item) => item !== appId);
      });
      if (!state.folders[id]) return state;
      state.folders[id].items = [...state.folders[id].items, appId];
      state.pages = state.pages.map((page) => page.filter((entry) => entry !== appId));
      return state;
    });
  },

  removeFromFolder(id, appId) {
    mutate((state) => {
      const folder = state.folders[id];
      if (!folder) return state;
      folder.items = folder.items.filter((item) => item !== appId);
      state.pages[0] = [appId, ...(state.pages[0] ?? [])];
      if (!folder.items.length) {
        delete state.folders[id];
        state.pages = state.pages.map((page) => page.filter((entry) => entry !== folderRef(id)));
      }
      return state;
    });
  },

  toggleDock(appId) {
    let pinned = false;
    mutate((state) => {
      state.dock = state.dock.includes(appId)
        ? state.dock.filter((id) => id !== appId)
        : [...state.dock, appId].slice(-8);
      pinned = state.dock.includes(appId);
      return state;
    });
    return pinned;
  },

  reorderDock(appId, position) {
    mutate((state) => {
      const dock = state.dock.filter((id) => id !== appId);
      dock.splice(Math.min(position, dock.length), 0, appId);
      state.dock = dock;
      return state;
    });
  },

  hide(appId) {
    mutate((state) => {
      state.hidden = [...new Set([...state.hidden, appId])];
      state.pages = state.pages.map((page) => page.filter((entry) => entry !== appId));
      state.dock = state.dock.filter((id) => id !== appId);
      Object.values(state.folders).forEach((folder) => {
        folder.items = folder.items.filter((item) => item !== appId);
      });
      return state;
    });
  },

  restore(appId) {
    mutate((state) => {
      state.hidden = state.hidden.filter((id) => id !== appId);
      return state;
    });
  },

  addWidget(appId, size = 'small') {
    mutate((state) => {
      state.widgets.push({ uid: uid().slice(0, 8), appId, size });
      return state;
    });
  },

  removeWidget(widgetUid) {
    mutate((state) => {
      state.widgets = state.widgets.filter((widget) => widget.uid !== widgetUid);
      return state;
    });
  },

  resizeWidget(widgetUid, size) {
    mutate((state) => {
      state.widgets = state.widgets.map((widget) => (widget.uid === widgetUid ? { ...widget, size } : widget));
      return state;
    });
  },

  reset() {
    cache = buildDefault();
    persist();
  },
};
