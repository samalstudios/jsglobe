import { workspaces } from './workspaces.js';

const DATABASE = 'jsglobe';
const STORE = 'blobs';

let handle = null;

const open = () =>
  new Promise((resolve, reject) => {
    if (handle) return resolve(handle);
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: 'id' }).createIndex('scope', 'scope');
      }
    };
    request.onsuccess = () => {
      handle = request.result;
      resolve(handle);
    };
    request.onerror = () => reject(request.error);
  });

const run = async (mode, work) => {
  const database = await open();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, mode);
    const store = transaction.objectStore(STORE);
    const request = work(store);
    transaction.oncomplete = () => resolve(request?.result);
    transaction.onerror = () => reject(transaction.error);
  });
};

export const blobs = {
  scope: (appId) => `${workspaces.activeId}:${appId}`,

  async put(appId, record) {
    await run('readwrite', (store) => store.put({ ...record, scope: blobs.scope(appId) }));
    return record;
  },

  async get(id) {
    return run('readonly', (store) => store.get(id));
  },

  async list(appId) {
    const scope = blobs.scope(appId);
    const all = await run('readonly', (store) => store.getAll());
    return (all ?? []).filter((record) => record.scope === scope).sort((a, b) => b.created - a.created);
  },

  async remove(id) {
    return run('readwrite', (store) => store.delete(id));
  },

  async clear(appId) {
    const records = await blobs.list(appId);
    await Promise.all(records.map((record) => blobs.remove(record.id)));
  },
};
