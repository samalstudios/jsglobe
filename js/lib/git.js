// Reading a git repository straight from its files.
//
// Nothing here runs git. A repository is read through a small reader, so the
// same code works on a folder the user opened in the browser and on files in
// a test. Loose objects, packs with both kinds of delta, packed and loose refs,
// annotated tags and the index are all understood.
//
//   const repo = await openRepository(directoryReader(handle));
//   const { commits } = await repo.log({ limit: 100 });

import { inflateZlib } from './inflate.js';
import { ignores } from './gitignore.js';

const decoder = new TextDecoder();
const encoder = new TextEncoder();

export const TYPES = { 1: 'commit', 2: 'tree', 3: 'blob', 4: 'tag' };

export const toHex = (bytes, from = 0, to = bytes.length) => {
  let text = '';
  for (let index = from; index < to; index += 1) text += bytes[index].toString(16).padStart(2, '0');
  return text;
};

const fromHex = (text) => {
  const bytes = new Uint8Array(text.length / 2);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = parseInt(text.substr(index * 2, 2), 16);
  return bytes;
};

export const isSha = (text) => /^[0-9a-f]{40}$/.test(text ?? '');

export class GitError extends Error {}

// ---- readers -----------------------------------------------------------

/**
 * A reader over a FileSystemDirectoryHandle. Paths use forward slashes and are
 * relative to the handle.
 */
export const directoryReader = (root) => {
  const folders = new Map([['', root]]);
  const folder = async (path, create = false) => {
    if (folders.has(path)) return folders.get(path);
    const cut = path.lastIndexOf('/');
    const parent = await folder(cut < 0 ? '' : path.slice(0, cut), create);
    if (!parent) return null;
    try {
      const handle = await parent.getDirectoryHandle(path.slice(cut + 1), { create });
      folders.set(path, handle);
      return handle;
    } catch {
      return null;
    }
  };
  const split = (path) => {
    const cut = path.lastIndexOf('/');
    return [cut < 0 ? '' : path.slice(0, cut), path.slice(cut + 1)];
  };
  return {
    name: root.name,
    async file(path) {
      const [dir, name] = split(path);
      const parent = await folder(dir);
      if (!parent) return null;
      try {
        return await (await parent.getFileHandle(name)).getFile();
      } catch {
        return null;
      }
    },
    async list(path = '') {
      const handle = await folder(path);
      if (!handle) return null;
      const entries = [];
      for await (const entry of handle.values()) entries.push({ name: entry.name, kind: entry.kind });
      return entries;
    },
    async write(path, text) {
      const [dir, name] = split(path);
      const parent = await folder(dir, true);
      const stream = await (await parent.getFileHandle(name, { create: true })).createWritable();
      await stream.write(text);
      await stream.close();
    },
    async remove(path) {
      const [dir, name] = split(path);
      const parent = await folder(dir);
      if (parent) await parent.removeEntry(name);
    },
    async writable() {
      if (!root.queryPermission) return true;
      if ((await root.queryPermission({ mode: 'readwrite' })) === 'granted') return true;
      return (await root.requestPermission({ mode: 'readwrite' })) === 'granted';
    },
  };
};

/** A reader over a map of path to bytes or text, for tests and examples. */
export const memoryReader = (files) => {
  const blobs = new Map(Object.entries(files).map(([path, content]) => [path, new Blob([content])]));
  return {
    name: 'memory',
    async file(path) {
      return blobs.get(path) ?? null;
    },
    async list(path = '') {
      const prefix = path ? `${path}/` : '';
      const seen = new Map();
      for (const key of blobs.keys()) {
        if (!key.startsWith(prefix)) continue;
        const rest = key.slice(prefix.length);
        const cut = rest.indexOf('/');
        seen.set(cut < 0 ? rest : rest.slice(0, cut), cut < 0 ? 'file' : 'directory');
      }
      return seen.size || !path ? [...seen].map(([name, kind]) => ({ name, kind })) : null;
    },
    async write(path, text) {
      blobs.set(path, new Blob([text]));
    },
    async remove(path) {
      blobs.delete(path);
    },
    async writable() {
      return true;
    },
  };
};

/**
 * A read only reader over the files a directory input returns, for browsers
 * that cannot open folders directly. The chosen folder's own name is dropped.
 */
export const fileListReader = (fileList) => {
  const files = new Map();
  let name = 'repository';
  for (const file of fileList) {
    const parts = (file.webkitRelativePath || file.name).split('/');
    if (parts.length > 1) name = parts.shift();
    files.set(parts.join('/'), file);
  }
  const reader = memoryReader({});
  return {
    ...reader,
    name,
    async file(path) {
      return files.get(path) ?? null;
    },
    async list(path = '') {
      const prefix = path ? `${path}/` : '';
      const seen = new Map();
      for (const key of files.keys()) {
        if (!key.startsWith(prefix)) continue;
        const rest = key.slice(prefix.length);
        const cut = rest.indexOf('/');
        seen.set(cut < 0 ? rest : rest.slice(0, cut), cut < 0 ? 'file' : 'directory');
      }
      return seen.size || !path ? [...seen].map(([entry, kind]) => ({ name: entry, kind })) : null;
    },
    write: undefined,
    remove: undefined,
    async writable() {
      return false;
    },
  };
};

const bytesOf = async (blob) => (blob ? new Uint8Array(await blob.arrayBuffer()) : null);
const textOf = async (blob) => (blob ? blob.text() : null);

// a reader that looks inside a sub folder of another reader
const within = (reader, base) => {
  const join = (path) => (base ? (path ? `${base}/${path}` : base) : path);
  return {
    ...reader,
    file: (path) => reader.file(join(path)),
    list: (path = '') => reader.list(join(path)),
    write: (path, text) => reader.write(join(path), text),
    remove: (path) => reader.remove(join(path)),
  };
};

// ---- objects -----------------------------------------------------------

const person = (line = '') => {
  const match = /^(.*?) <(.*?)> (\d+) ([+-]\d{4})$/.exec(line);
  if (!match) return { name: line, email: '', time: 0, zone: '+0000' };
  return { name: match[1], email: match[2], time: Number(match[3]), zone: match[4] };
};

/** A commit's fields from its raw text. */
export const parseCommit = (data, sha = '') => {
  const text = typeof data === 'string' ? data : decoder.decode(data);
  const split = text.indexOf('\n\n');
  const head = split < 0 ? text : text.slice(0, split);
  const message = split < 0 ? '' : text.slice(split + 2);
  const commit = { sha, tree: '', parents: [], author: null, committer: null, message, signed: false };
  let key = '';
  for (const line of head.split('\n')) {
    if (line.startsWith(' ')) continue;
    const cut = line.indexOf(' ');
    key = line.slice(0, cut);
    const value = line.slice(cut + 1);
    if (key === 'tree') commit.tree = value;
    else if (key === 'parent') commit.parents.push(value);
    else if (key === 'author') commit.author = person(value);
    else if (key === 'committer') commit.committer = person(value);
    else if (key === 'gpgsig' || key === 'gpgsig-sha256') commit.signed = true;
  }
  commit.subject = message.split('\n', 1)[0];
  return commit;
};

/** An annotated tag's fields. */
export const parseTag = (data) => {
  const text = decoder.decode(data);
  const split = text.indexOf('\n\n');
  const tag = { object: '', type: '', name: '', tagger: null, message: split < 0 ? '' : text.slice(split + 2) };
  for (const line of (split < 0 ? text : text.slice(0, split)).split('\n')) {
    const cut = line.indexOf(' ');
    const key = line.slice(0, cut);
    const value = line.slice(cut + 1);
    if (key === 'object') tag.object = value;
    else if (key === 'type') tag.type = value;
    else if (key === 'tag') tag.name = value;
    else if (key === 'tagger') tag.tagger = person(value);
  }
  return tag;
};

/** A tree's entries: mode, name and object id, and whether each is a folder. */
export const parseTree = (data) => {
  const entries = [];
  let index = 0;
  while (index < data.length) {
    const space = data.indexOf(0x20, index);
    const nul = data.indexOf(0, space);
    const mode = decoder.decode(data.subarray(index, space));
    const name = decoder.decode(data.subarray(space + 1, nul));
    const sha = toHex(data, nul + 1, nul + 21);
    entries.push({ mode, name, sha, kind: mode === '40000' ? 'tree' : mode === '160000' ? 'commit' : 'blob' });
    index = nul + 21;
  }
  return entries;
};

/** Builds a new object from a base and a git delta. */
export const applyDelta = (base, delta) => {
  let index = 0;
  const varint = () => {
    let value = 0;
    let shift = 0;
    let byte;
    do {
      byte = delta[index++];
      value += (byte & 0x7f) * 2 ** shift;
      shift += 7;
    } while (byte & 0x80);
    return value;
  };
  const sourceSize = varint();
  if (sourceSize !== base.length) throw new GitError('A delta does not match its base');
  const output = new Uint8Array(varint());
  let length = 0;
  while (index < delta.length) {
    const op = delta[index++];
    if (op & 0x80) {
      let offset = 0;
      let size = 0;
      for (let bit = 0; bit < 4; bit += 1) if (op & (1 << bit)) offset += delta[index++] * 2 ** (8 * bit);
      for (let bit = 0; bit < 3; bit += 1) if (op & (0x10 << bit)) size += delta[index++] * 2 ** (8 * bit);
      if (size === 0) size = 0x10000;
      output.set(base.subarray(offset, offset + size), length);
      length += size;
    } else if (op) {
      output.set(delta.subarray(index, index + op), length);
      index += op;
      length += op;
    } else throw new GitError('A delta holds an unknown instruction');
  }
  if (length !== output.length) throw new GitError('A delta came out the wrong size');
  return output;
};

// ---- packs -------------------------------------------------------------

const readIndex = (bytes) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0) !== 0xff744f63 || view.getUint32(4) !== 2) throw new GitError('Only version 2 pack indexes are understood');
  const fanout = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) fanout[index] = view.getUint32(8 + index * 4);
  const count = fanout[255];
  const shaAt = 8 + 256 * 4;
  const offsetAt = shaAt + count * 20 + count * 4;
  const largeAt = offsetAt + count * 4;
  const offsetOf = (position) => {
    const value = view.getUint32(offsetAt + position * 4);
    if (!(value & 0x80000000)) return value;
    const large = largeAt + (value & 0x7fffffff) * 8;
    return view.getUint32(large) * 2 ** 32 + view.getUint32(large + 4);
  };
  const offsets = new Float64Array(count);
  for (let position = 0; position < count; position += 1) offsets[position] = offsetOf(position);
  const sorted = Float64Array.from(offsets).sort();
  return {
    count,
    find(sha) {
      const wanted = fromHex(sha);
      let low = wanted[0] ? fanout[wanted[0] - 1] : 0;
      let high = fanout[wanted[0]] - 1;
      while (low <= high) {
        const middle = (low + high) >> 1;
        let order = 0;
        for (let byte = 0; byte < 20 && !order; byte += 1) order = bytes[shaAt + middle * 20 + byte] - wanted[byte];
        if (!order) return offsets[middle];
        if (order < 0) low = middle + 1;
        else high = middle - 1;
      }
      return -1;
    },
    // where the object starting at offset ends, which is where the next begins
    endOf(offset, packSize) {
      let low = 0;
      let high = sorted.length - 1;
      while (low <= high) {
        const middle = (low + high) >> 1;
        if (sorted[middle] <= offset) low = middle + 1;
        else high = middle - 1;
      }
      return low < sorted.length ? sorted[low] : packSize - 20;
    },
    *shas() {
      for (let position = 0; position < count; position += 1) yield toHex(bytes, shaAt + position * 20, shaAt + position * 20 + 20);
    },
  };
};

// ---- index (the staging area) -------------------------------------------

/** The entries of .git/index: path, object id, mode, size and modification time. */
export const parseIndex = (bytes) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (decoder.decode(bytes.subarray(0, 4)) !== 'DIRC') throw new GitError('The index file is not valid');
  const version = view.getUint32(4);
  const count = view.getUint32(8);
  const entries = [];
  let at = 12;
  let previous = '';
  for (let index = 0; index < count; index += 1) {
    const start = at;
    const mtime = view.getUint32(start + 8);
    const mode = view.getUint32(start + 24);
    const size = view.getUint32(start + 36);
    const sha = toHex(bytes, start + 40, start + 60);
    const flags = view.getUint16(start + 60);
    at = start + 62;
    if (version >= 3 && flags & 0x4000) at += 2;
    let path;
    if (version === 4) {
      let strip = 0;
      let byte;
      let shift = 0;
      // the offset encoding git uses here adds one for each continuation byte
      byte = bytes[at++];
      strip = byte & 0x7f;
      while (byte & 0x80) {
        byte = bytes[at++];
        strip = ((strip + 1) << 7) | (byte & 0x7f);
        shift += 7;
      }
      const nul = bytes.indexOf(0, at);
      path = previous.slice(0, previous.length - strip) + decoder.decode(bytes.subarray(at, nul));
      at = nul + 1;
    } else {
      const nul = bytes.indexOf(0, at);
      path = decoder.decode(bytes.subarray(at, nul));
      at = start + Math.ceil((nul - start + 1) / 8) * 8;
    }
    previous = path;
    const stage = (flags >> 12) & 3;
    entries.push({ path, sha, mode: mode.toString(8), size, mtime, stage });
  }
  return { version, entries };
};

// ---- repository --------------------------------------------------------

const CACHE_LIMIT = 4000;

/**
 * Opens a repository. The reader may point at a working folder holding .git,
 * or at a bare repository or a .git folder itself.
 */
export const openRepository = async (reader) => {
  let git = reader;
  let worktree = null;
  const top = (await reader.list('')) ?? [];
  const dotGit = top.find((entry) => entry.name === '.git');
  if (dotGit?.kind === 'directory') {
    git = within(reader, '.git');
    worktree = reader;
  } else if (dotGit?.kind === 'file') {
    const pointer = (await textOf(await reader.file('.git'))) ?? '';
    throw new GitError(`This folder is a linked worktree or submodule whose data lives elsewhere (${pointer.trim()}). Open the main repository instead.`);
  } else if (!top.some((entry) => entry.name === 'HEAD') || !top.some((entry) => entry.name === 'objects')) {
    throw new GitError('This folder is not a git repository. Pick the folder that holds the .git folder.');
  }

  const cache = new Map();
  const remember = (sha, object) => {
    if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
    cache.set(sha, object);
    return object;
  };

  let packs = null;
  const loadPacks = async () => {
    if (packs) return packs;
    const names = ((await git.list('objects/pack')) ?? []).map((entry) => entry.name).filter((name) => name.endsWith('.idx'));
    packs = [];
    for (const name of names) {
      const pack = await git.file(`objects/pack/${name.replace(/\.idx$/, '.pack')}`);
      const index = await bytesOf(await git.file(`objects/pack/${name}`));
      if (!pack || !index) continue;
      try {
        packs.push({ name, pack, index: readIndex(index), bases: new Map() });
      } catch {}
    }
    return packs;
  };

  const readPacked = async (entry, offset) => {
    if (entry.bases.has(offset)) return entry.bases.get(offset);
    const end = entry.index.endOf(offset, entry.pack.size);
    const bytes = await bytesOf(entry.pack.slice(offset, end));
    let byte = bytes[0];
    const typeNumber = (byte >> 4) & 7;
    let size = byte & 15;
    let at = 1;
    let shift = 4;
    while (byte & 0x80) {
      byte = bytes[at++];
      size += (byte & 0x7f) * 2 ** shift;
      shift += 7;
    }
    let object;
    if (typeNumber === 6) {
      byte = bytes[at++];
      let back = byte & 0x7f;
      while (byte & 0x80) {
        byte = bytes[at++];
        back = (back + 1) * 128 + (byte & 0x7f);
      }
      const base = await readPacked(entry, offset - back);
      const { data } = inflateZlib(bytes, at, size);
      object = { type: base.type, data: applyDelta(base.data, data) };
    } else if (typeNumber === 7) {
      const baseSha = toHex(bytes, at, at + 20);
      at += 20;
      const base = await read(baseSha);
      if (!base) throw new GitError(`A delta's base ${baseSha} is missing`);
      const { data } = inflateZlib(bytes, at, size);
      object = { type: base.type, data: applyDelta(base.data, data) };
    } else if (TYPES[typeNumber]) {
      object = { type: TYPES[typeNumber], data: inflateZlib(bytes, at, size).data };
    } else throw new GitError(`Unknown object type ${typeNumber}`);
    // delta bases are asked for again and again, so keep a few of the small ones
    if (object.data.length < 512 * 1024) {
      if (entry.bases.size > 256) entry.bases.delete(entry.bases.keys().next().value);
      entry.bases.set(offset, object);
    }
    return object;
  };

  const read = async (sha) => {
    if (cache.has(sha)) return cache.get(sha);
    const loose = await git.file(`objects/${sha.slice(0, 2)}/${sha.slice(2)}`);
    if (loose) {
      const { data } = inflateZlib(await bytesOf(loose));
      const space = data.indexOf(0x20);
      const nul = data.indexOf(0, space);
      return remember(sha, { type: decoder.decode(data.subarray(0, space)), data: data.subarray(nul + 1) });
    }
    for (const entry of await loadPacks()) {
      const offset = entry.index.find(sha);
      if (offset >= 0) return remember(sha, await readPacked(entry, offset));
    }
    return null;
  };

  const readRefFile = async (path) => {
    const text = await textOf(await git.file(path));
    return text === null ? null : text.trim();
  };

  const packedRefs = async () => {
    const text = (await textOf(await git.file('packed-refs'))) ?? '';
    const refs = new Map();
    let last = null;
    for (const line of text.split('\n')) {
      if (!line || line.startsWith('#')) continue;
      if (line.startsWith('^')) {
        if (last) refs.get(last).peeled = line.slice(1).trim();
        continue;
      }
      const [sha, name] = line.trim().split(' ');
      if (isSha(sha) && name) {
        refs.set(name, { sha, peeled: null });
        last = name;
      }
    }
    return refs;
  };

  const looseRefs = async (path = 'refs', found = new Map()) => {
    for (const entry of (await git.list(path)) ?? []) {
      const full = `${path}/${entry.name}`;
      if (entry.kind === 'directory') await looseRefs(full, found);
      else found.set(full, await readRefFile(full));
    }
    return found;
  };

  const repo = {
    worktree: Boolean(worktree),
    name: reader.name,
    read,

    async object(sha) {
      const object = await read(sha);
      if (!object) throw new GitError(`Object ${sha} is missing`);
      return object;
    },

    async commit(sha) {
      const object = await repo.object(sha);
      if (object.type === 'tag') return repo.commit(parseTag(object.data).object);
      if (object.type !== 'commit') throw new GitError(`${sha} is a ${object.type}, not a commit`);
      if (!object.commit) object.commit = parseCommit(object.data, sha);
      return object.commit;
    },

    async tree(sha) {
      const object = await repo.object(sha);
      if (object.type !== 'tree') throw new GitError(`${sha} is not a tree`);
      if (!object.entries) object.entries = parseTree(object.data);
      return object.entries;
    },

    async blob(sha) {
      return (await repo.object(sha)).data;
    },

    /** What HEAD points at: a branch name and the commit, or a detached commit. */
    async head() {
      const text = await readRefFile('HEAD');
      if (!text) throw new GitError('HEAD is missing');
      if (text.startsWith('ref: ')) {
        const ref = text.slice(5).trim();
        return { ref, sha: await repo.resolve(ref) };
      }
      return { ref: null, sha: text };
    },

    /** The commit a ref name or id points at, or null. */
    async resolve(name, depth = 0) {
      if (isSha(name)) return name;
      if (depth > 8) return null;
      const candidates = name.startsWith('refs/') || name === 'HEAD' ? [name] : [name, `refs/heads/${name}`, `refs/tags/${name}`, `refs/remotes/${name}`];
      const packed = await packedRefs();
      for (const candidate of candidates) {
        const text = await readRefFile(candidate);
        if (text?.startsWith('ref: ')) return repo.resolve(text.slice(5).trim(), depth + 1);
        if (isSha(text)) return text;
        if (packed.has(candidate)) return packed.get(candidate).sha;
      }
      return null;
    },

    /** Every branch, remote branch, tag and stash, with the commit each points at. */
    async refs() {
      const packed = await packedRefs();
      const loose = await looseRefs();
      const names = new Set([...packed.keys(), ...loose.keys()]);
      const refs = [];
      for (const name of names) {
        let value = loose.get(name) ?? packed.get(name)?.sha;
        let symbolic = null;
        if (value?.startsWith('ref: ')) {
          symbolic = value.slice(5).trim();
          value = await repo.resolve(symbolic);
        }
        if (!isSha(value)) continue;
        let target = packed.get(name)?.peeled ?? null;
        let annotated = null;
        if (name.startsWith('refs/tags/') && !target) {
          const object = await read(value).catch(() => null);
          if (object?.type === 'tag') {
            annotated = parseTag(object.data);
            target = annotated.object;
          }
        }
        const kind = name.startsWith('refs/heads/') ? 'branch' : name.startsWith('refs/remotes/') ? 'remote' : name.startsWith('refs/tags/') ? 'tag' : name === 'refs/stash' ? 'stash' : 'other';
        const short = name.replace(/^refs\/(heads|remotes|tags)\//, '');
        refs.push({ name, short, kind, sha: value, commit: target ?? value, symbolic, annotated });
      }
      const order = { branch: 0, remote: 1, tag: 2, stash: 3, other: 4 };
      return refs.sort((a, b) => order[a.kind] - order[b.kind] || a.short.localeCompare(b.short, undefined, { numeric: true }));
    },

    /**
     * Commits reachable from the starting points, newest first by commit date,
     * a page at a time. Pass the returned cursor back for the next page.
     */
    async log({ from = [], limit = 200, cursor = null } = {}) {
      const state = cursor ?? { queue: [], seen: new Set() };
      const push = (commit) => {
        if (state.seen.has(commit.sha)) return;
        state.seen.add(commit.sha);
        const time = commit.committer?.time ?? 0;
        let low = 0;
        let high = state.queue.length;
        while (low < high) {
          const middle = (low + high) >> 1;
          if ((state.queue[middle].committer?.time ?? 0) >= time) low = middle + 1;
          else high = middle;
        }
        state.queue.splice(low, 0, commit);
      };
      if (!cursor) {
        for (const sha of from) {
          const commit = await repo.commit(sha).catch(() => null);
          if (commit) push(commit);
        }
      }
      const commits = [];
      while (state.queue.length && commits.length < limit) {
        // newest first, but never a commit while one of its children still waits,
        // which matters when clocks are off or commits share a second
        let pick = state.queue.findIndex((candidate) => !state.queue.some((other) => other !== candidate && other.parents.includes(candidate.sha)));
        if (pick < 0) pick = 0;
        const [commit] = state.queue.splice(pick, 1);
        commits.push(commit);
        for (const parent of commit.parents) {
          if (state.seen.has(parent)) continue;
          const next = await repo.commit(parent).catch(() => null);
          if (next) push(next);
          else state.seen.add(parent);
        }
      }
      return { commits, cursor: state.queue.length ? state : null };
    },

    /** Every file in a tree, flattened to path, id and mode. */
    async files(treeSha, prefix = '', found = new Map()) {
      for (const entry of await repo.tree(treeSha)) {
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.kind === 'tree') await repo.files(entry.sha, path, found);
        else found.set(path, { sha: entry.sha, mode: entry.mode });
      }
      return found;
    },

    /** The files that differ between two trees, walking only folders that changed. */
    async compareTrees(oldSha, newSha, prefix = '', changes = []) {
      if (oldSha === newSha) return changes;
      const before = new Map(oldSha ? (await repo.tree(oldSha)).map((entry) => [entry.name, entry]) : []);
      const after = new Map(newSha ? (await repo.tree(newSha)).map((entry) => [entry.name, entry]) : []);
      const names = [...new Set([...before.keys(), ...after.keys()])].sort();
      for (const name of names) {
        const a = before.get(name);
        const b = after.get(name);
        const path = prefix ? `${prefix}/${name}` : name;
        if (a && b && a.sha === b.sha && a.mode === b.mode) continue;
        const aTree = a?.kind === 'tree';
        const bTree = b?.kind === 'tree';
        if (aTree || bTree) {
          await repo.compareTrees(aTree ? a.sha : null, bTree ? b.sha : null, path, changes);
          if (a && !aTree) changes.push({ path, status: 'deleted', oldSha: a.sha, newSha: null, oldMode: a.mode, newMode: null });
          if (b && !bTree) changes.push({ path, status: 'added', oldSha: null, newSha: b.sha, oldMode: null, newMode: b.mode });
          continue;
        }
        changes.push({
          path,
          status: !a ? 'added' : !b ? 'deleted' : 'modified',
          oldSha: a?.sha ?? null,
          newSha: b?.sha ?? null,
          oldMode: a?.mode ?? null,
          newMode: b?.mode ?? null,
        });
      }
      return changes;
    },

    /** What a commit changed against its first parent. */
    async changes(sha) {
      const commit = await repo.commit(sha);
      const parent = commit.parents[0] ? await repo.commit(commit.parents[0]).catch(() => null) : null;
      const changes = await repo.compareTrees(parent?.tree ?? null, commit.tree);
      return renames(changes);
    },

    /** The staging area, or null for a bare repository. */
    async index() {
      const bytes = await bytesOf(await git.file('index'));
      return bytes ? parseIndex(bytes) : null;
    },

    /**
     * The working tree against the index and HEAD: staged changes, changes not
     * yet staged, and untracked files that .gitignore does not hide.
     */
    async status({ untrackedLimit = 500, onProgress = () => {} } = {}) {
      if (!worktree) return null;
      const head = await repo.head().catch(() => null);
      const committed = head?.sha ? await repo.files((await repo.commit(head.sha)).tree) : new Map();
      const index = (await repo.index()) ?? { entries: [] };
      const tracked = new Map(index.entries.filter((entry) => entry.stage === 0).map((entry) => [entry.path, entry]));
      const conflicts = [...new Set(index.entries.filter((entry) => entry.stage > 0).map((entry) => entry.path))];

      const staged = [];
      for (const [path, entry] of tracked) {
        const before = committed.get(path);
        if (!before) staged.push({ path, status: 'added', oldSha: null, newSha: entry.sha });
        else if (before.sha !== entry.sha) staged.push({ path, status: 'modified', oldSha: before.sha, newSha: entry.sha });
      }
      for (const [path, before] of committed) if (!tracked.has(path)) staged.push({ path, status: 'deleted', oldSha: before.sha, newSha: null });

      const unstaged = [];
      let checked = 0;
      for (const [path, entry] of tracked) {
        checked += 1;
        if (checked % 200 === 0) onProgress(checked, tracked.size);
        if (entry.mode === '160000') continue;
        const file = await worktree.file(path);
        if (!file) {
          unstaged.push({ path, status: 'deleted', oldSha: entry.sha, newSha: null });
          continue;
        }
        if (file.size === entry.size && Math.floor(file.lastModified / 1000) === entry.mtime) continue;
        if (file.size !== entry.size && !(entry.mode === '120000')) {
          unstaged.push({ path, status: 'modified', oldSha: entry.sha, newSha: null, file });
          continue;
        }
        if ((await hashBlob(await bytesOf(file))) !== entry.sha) unstaged.push({ path, status: 'modified', oldSha: entry.sha, newSha: null, file });
      }

      const rules = [];
      const addRules = async (text, base) => {
        for (const line of (text ?? '').split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          if (!base) rules.push(trimmed);
          else {
            const negated = trimmed.startsWith('!');
            const pattern = negated ? trimmed.slice(1) : trimmed;
            const anchored = pattern.replace(/^\//, '');
            const sign = negated ? '!' : '';
            rules.push(`${sign}/${base}/${anchored}`);
            // a pattern without a slash in it matches at any depth below its folder
            if (!pattern.replace(/\/$/, '').includes('/')) rules.push(`${sign}/${base}/**/${anchored}`);
          }
        }
      };
      await addRules(await textOf(await git.file('info/exclude')), '');
      const untracked = [];
      const trackedFolders = new Set();
      for (const path of tracked.keys()) {
        const parts = path.split('/');
        for (let depth = 1; depth < parts.length; depth += 1) trackedFolders.add(parts.slice(0, depth).join('/'));
      }
      const walk = async (dir) => {
        if (untracked.length >= untrackedLimit) return;
        const entries = (await worktree.list(dir)) ?? [];
        if (entries.some((entry) => entry.name === '.gitignore' && entry.kind === 'file')) {
          await addRules(await textOf(await worktree.file(dir ? `${dir}/.gitignore` : '.gitignore')), dir);
        }
        for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
          if (untracked.length >= untrackedLimit) return;
          if (!dir && entry.name === '.git') continue;
          const path = dir ? `${dir}/${entry.name}` : entry.name;
          const probe = entry.kind === 'directory' ? `${path}/` : path;
          if (entry.kind === 'directory') {
            if (trackedFolders.has(path)) await walk(path);
            else if (!ignores(rules, probe)) untracked.push({ path: `${path}/`, status: 'untracked', folder: true });
          } else if (!tracked.has(path) && !ignores(rules, path)) {
            untracked.push({ path, status: 'untracked' });
          }
        }
      };
      await walk('');

      return {
        branch: head?.ref?.replace(/^refs\/heads\//, '') ?? null,
        detached: head ? !head.ref : false,
        staged: staged.sort((a, b) => a.path.localeCompare(b.path)),
        unstaged: unstaged.sort((a, b) => a.path.localeCompare(b.path)),
        untracked,
        conflicts,
        untrackedCapped: untracked.length >= untrackedLimit,
      };
    },

    async canWrite() {
      return typeof git.write === 'function' && (await git.writable?.()) !== false;
    },

    /** Makes a branch or a lightweight tag point at a commit. */
    async createRef(kind, name, sha) {
      const problem = refNameProblem(name);
      if (problem) throw new GitError(problem);
      if (!isSha(sha)) throw new GitError('A commit is needed');
      const full = `refs/${kind === 'tag' ? 'tags' : 'heads'}/${name}`;
      if ((await repo.refs()).some((ref) => ref.name === full)) throw new GitError(`${name} already exists`);
      if (!(await repo.canWrite())) throw new GitError('Permission to change the repository was not given');
      await git.write(full, `${sha}\n`);
      return full;
    },

    /** Removes a branch or tag, loose or packed. The checked out branch is refused. */
    async deleteRef(full) {
      const head = await repo.head();
      if (head.ref === full) throw new GitError('The checked out branch cannot be deleted');
      if (!(await repo.canWrite())) throw new GitError('Permission to change the repository was not given');
      if ((await readRefFile(full)) !== null) await git.remove(full);
      const text = await textOf(await git.file('packed-refs'));
      if (text && text.split('\n').some((line) => line.endsWith(` ${full}`))) {
        const lines = text.split('\n');
        const kept = [];
        for (let index = 0; index < lines.length; index += 1) {
          if (lines[index].endsWith(` ${full}`)) {
            if (lines[index + 1]?.startsWith('^')) index += 1;
            continue;
          }
          kept.push(lines[index]);
        }
        await git.write('packed-refs', kept.join('\n'));
      }
    },
  };
  return repo;
};

// ---- ids, names and renames ---------------------------------------------

/** The id git gives a file's contents. */
export const hashBlob = async (bytes) => {
  const header = encoder.encode(`blob ${bytes.length}\0`);
  const whole = new Uint8Array(header.length + bytes.length);
  whole.set(header);
  whole.set(bytes, header.length);
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-1', whole)));
};

/** Why a branch or tag name is not allowed, or null when it is. */
export const refNameProblem = (name = '') => {
  if (!name) return 'A name is needed';
  if (/[\s~^:?*[\\\x00-\x1f\x7f]/.test(name)) return 'Names cannot contain spaces or any of ~ ^ : ? * [ \\';
  if (name.includes('..') || name.includes('@{') || name.includes('//')) return 'Names cannot contain .., @{ or //';
  if (name.startsWith('/') || name.endsWith('/') || name.endsWith('.') || name.endsWith('.lock') || name === '@') return 'That name is not allowed';
  if (name.split('/').some((part) => part.startsWith('.'))) return 'No part of a name can start with a dot';
  return null;
};

// an added and a deleted file with the same contents are a rename
const renames = (changes) => {
  const deleted = new Map(changes.filter((change) => change.status === 'deleted').map((change) => [change.oldSha, change]));
  const out = [];
  const used = new Set();
  for (const change of changes) {
    if (change.status === 'added' && deleted.has(change.newSha) && !used.has(change.newSha)) {
      const from = deleted.get(change.newSha);
      used.add(change.newSha);
      out.push({ ...change, status: 'renamed', from: from.path, oldSha: from.oldSha, oldMode: from.oldMode });
    } else out.push(change);
  }
  return out.filter((change) => !(change.status === 'deleted' && used.has(change.oldSha)));
};

// ---- text --------------------------------------------------------------

/** Whether bytes look like text rather than binary. */
export const isBinary = (bytes) => {
  const end = Math.min(bytes.length, 8000);
  for (let index = 0; index < end; index += 1) if (bytes[index] === 0) return true;
  return false;
};

export const decodeText = (bytes) => decoder.decode(bytes);

const splitLines = (text) => {
  if (!text) return [];
  const lines = text.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  return lines;
};

/**
 * A line diff between two texts as a list of kept, removed and added lines
 * with their line numbers. Very different large files fall back to showing
 * everything removed and added rather than taking long.
 */
export const diffLines = (before = '', after = '', { maxEdits = 4000 } = {}) => {
  const a = splitLines(before);
  const b = splitLines(after);
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }
  const middle = myers(a.slice(start, endA), b.slice(start, endB), maxEdits);
  const ops = [];
  for (let index = 0; index < start; index += 1) ops.push({ type: 'same', text: a[index], old: index + 1, new: index + 1 });
  let oldLine = start;
  let newLine = start;
  for (const op of middle) {
    if (op.type === 'same') ops.push({ type: 'same', text: op.text, old: ++oldLine, new: ++newLine });
    else if (op.type === 'removed') ops.push({ type: 'removed', text: op.text, old: ++oldLine, new: null });
    else ops.push({ type: 'added', text: op.text, old: null, new: ++newLine });
  }
  for (let index = endA; index < a.length; index += 1) ops.push({ type: 'same', text: a[index], old: ++oldLine, new: ++newLine });
  return ops;
};

const myers = (a, b, maxEdits) => {
  const n = a.length;
  const m = b.length;
  if (!n) return b.map((text) => ({ type: 'added', text }));
  if (!m) return a.map((text) => ({ type: 'removed', text }));
  const max = n + m;
  const offset = max;
  const v = new Int32Array(2 * max + 2);
  const trace = [];
  let found = -1;
  for (let d = 0; d <= Math.min(max, maxEdits); d += 1) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]) ? v[offset + k + 1] : v[offset + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x += 1;
        y += 1;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) {
        found = d;
        break;
      }
    }
    if (found >= 0) break;
  }
  if (found < 0) return [...a.map((text) => ({ type: 'removed', text })), ...b.map((text) => ({ type: 'added', text }))];
  const ops = [];
  let x = n;
  let y = m;
  for (let d = found; d > 0; d -= 1) {
    const row = trace[d];
    const k = x - y;
    const previousK = k === -d || (k !== d && row[offset + k - 1] < row[offset + k + 1]) ? k + 1 : k - 1;
    const previousX = row[offset + previousK];
    const previousY = previousX - previousK;
    while (x > previousX && y > previousY) {
      ops.push({ type: 'same', text: a[--x] });
      y -= 1;
    }
    if (x === previousX) ops.push({ type: 'added', text: b[--y] });
    else ops.push({ type: 'removed', text: a[--x] });
  }
  while (x > 0 && y > 0) {
    ops.push({ type: 'same', text: a[--x] });
    y -= 1;
  }
  return ops.reverse();
};

/** Groups a line diff into hunks with a few kept lines of context around each change. */
export const hunks = (ops, context = 3) => {
  const groups = [];
  let current = null;
  let lastChange = -Infinity;
  ops.forEach((op, index) => {
    if (op.type === 'same') return;
    if (current && index - lastChange <= context * 2 + 1) {
      for (let at = lastChange + 1; at <= index; at += 1) current.lines.push(ops[at]);
    } else {
      if (current) current.lines.push(...ops.slice(lastChange + 1, Math.min(ops.length, lastChange + 1 + context)));
      current = { lines: ops.slice(Math.max(0, index - context), index + 1) };
      groups.push(current);
    }
    lastChange = index;
  });
  if (current) current.lines.push(...ops.slice(lastChange + 1, Math.min(ops.length, lastChange + 1 + context)));
  return groups.map((group) => {
    const firstOld = group.lines.find((line) => line.old !== null)?.old ?? 0;
    const firstNew = group.lines.find((line) => line.new !== null)?.new ?? 0;
    return {
      oldStart: firstOld,
      newStart: firstNew,
      oldLines: group.lines.filter((line) => line.type !== 'added').length,
      newLines: group.lines.filter((line) => line.type !== 'removed').length,
      lines: group.lines,
    };
  });
};

// ---- graph -------------------------------------------------------------

/**
 * Lanes for drawing a commit graph. For each commit in order it gives the
 * column of its dot, the lanes coming in from above and going out below, so
 * a row can be drawn on its own.
 */
export const graphLayout = (commits) => {
  const lanes = [];
  const rows = [];
  let width = 1;
  for (const commit of commits) {
    const before = lanes.slice();
    let column = lanes.indexOf(commit.sha);
    if (column < 0) {
      column = lanes.indexOf(null);
      if (column < 0) column = lanes.length;
    }
    for (let index = 0; index < lanes.length; index += 1) if (lanes[index] === commit.sha) lanes[index] = null;
    const parentColumns = [];
    commit.parents.forEach((parent, order) => {
      const existing = lanes.indexOf(parent);
      // a parent already on its way down another lane is joined there
      if (existing >= 0) {
        parentColumns.push(existing);
        return;
      }
      let slot = order === 0 ? column : lanes.indexOf(null);
      if (order !== 0 && (slot < 0 || slot === column)) {
        slot = lanes.findIndex((value, index) => value === null && index !== column);
        if (slot < 0) slot = Math.max(lanes.length, column + 1);
      }
      lanes[slot] = parent;
      parentColumns.push(slot);
    });
    while (lanes.length && lanes[lanes.length - 1] === null) lanes.pop();
    const after = lanes.slice();
    width = Math.max(width, before.length, after.length, column + 1);
    rows.push({ sha: commit.sha, column, before, after, parents: parentColumns });
  }
  return { rows, width };
};

// ---- insights ----------------------------------------------------------
//
// The questions worth asking a history before reading any code: which files
// change the most, who wrote it and whether they are still here, where the bug
// fixes land, whether the pace is rising or falling, and how often the team is
// reverting or hot fixing.

const DAY = 86400;
const BUG_WORDS = /fix|bug|broken/i;
const FIRE_WORDS = /revert|hotfix|emergency|rollback/i;

// files that change with every release without anyone working on them
const NOISE = [
  /(^|\/)(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|composer\.lock|Gemfile\.lock|Cargo\.lock|poetry\.lock|Pipfile\.lock|uv\.lock|go\.sum|mix\.lock|pubspec\.lock|Podfile\.lock|packages\.lock\.json|flake\.lock)$/i,
  /(^|\/)(CHANGELOG|CHANGES|HISTORY|RELEASES?)(\.[a-z]+)?$/i,
  /(^|\/)(dist|build|out|vendor|node_modules|coverage|\.next|__snapshots__)\//i,
  /\.(min\.(js|css)|map|snap|lock)$/i,
  /(^|\/)(sitemap\.xml)$/i,
];

/** Whether a path is a lockfile, changelog, build output or other generated file. */
export const isNoisePath = (path) => NOISE.some((pattern) => pattern.test(path));

// the calendar month a commit was written in, in its author's own time zone
const monthOf = (time, zone = '+0000') => {
  const sign = zone.startsWith('-') ? -1 : 1;
  const offset = sign * (Number(zone.slice(1, 3)) * 3600 + Number(zone.slice(3, 5)) * 60);
  const date = new Date((time + offset) * 1000);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

/**
 * Walks the history from the given commits and notes, for the commits the
 * insights need, which files each one changed. Merges are walked but their
 * files are not counted, as git log --name-only leaves them out too.
 */
export const collectHistory = async (repo, { from = [], now = Date.now() / 1000, fileLimit = 4000, commitLimit = 50000, onProgress = () => {} } = {}) => {
  const commits = [];
  let cursor = null;
  do {
    const page = await repo.log({ from, limit: 1000, cursor });
    for (const commit of page.commits) {
      commits.push({
        sha: commit.sha,
        subject: commit.subject,
        message: commit.message,
        author: commit.author?.name ?? '',
        email: commit.author?.email ?? '',
        time: commit.author?.time ?? 0,
        zone: commit.author?.zone ?? '+0000',
        merge: commit.parents.length > 1,
        files: null,
      });
    }
    cursor = page.cursor;
    onProgress({ stage: 'commits', done: commits.length, total: null });
    await new Promise((resolve) => setTimeout(resolve, 0));
  } while (cursor && commits.length < commitLimit);

  const latest = commits.reduce((max, commit) => Math.max(max, commit.time), 0);
  // an idle project is judged on its last active year rather than an empty one
  const anchor = latest && now - latest > 365 * DAY ? latest : now;
  const wanted = commits.filter((commit) => !commit.merge && (commit.time >= anchor - 365 * DAY || BUG_WORDS.test(commit.message)));
  const counted = wanted.slice(0, fileLimit);
  for (let index = 0; index < counted.length; index += 1) {
    const commit = counted[index];
    try {
      commit.files = (await repo.changes(commit.sha)).map((change) => change.path);
    } catch {
      commit.files = [];
    }
    if (index % 25 === 0) {
      onProgress({ stage: 'files', done: index, total: counted.length });
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  return { commits, now, anchor, idle: anchor !== now, truncated: Boolean(cursor), filesCapped: wanted.length > counted.length, filesCounted: counted.length };
};

const topFiles = (commits, keep, limit) => {
  const counts = new Map();
  for (const commit of commits) for (const path of commit.files ?? []) if (keep(path)) counts.set(path, (counts.get(path) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([path, count]) => ({ path, count }));
};

/**
 * Turns a collected history into the five insights, with plain findings for
 * each. folder narrows the file lists to one part of the tree; noise hides
 * lockfiles, changelogs and generated files.
 */
export const analyseHistory = (history, { folder = '', noise = false, limit = 20 } = {}) => {
  const { commits, anchor } = history;
  const prefix = folder.replace(/^\/+|\/+$/g, '');
  const keep = (path) => (!prefix || path === prefix || path.startsWith(`${prefix}/`)) && (noise || !isNoisePath(path));
  const yearAgo = anchor - 365 * DAY;
  const halfYearAgo = anchor - 182 * DAY;
  const plain = commits.filter((commit) => !commit.merge);

  // what changes the most
  const churn = topFiles(plain.filter((commit) => commit.time >= yearAgo), keep, limit);

  // where bugs cluster
  const bugCommits = plain.filter((commit) => BUG_WORDS.test(commit.message));
  const bugs = topFiles(bugCommits, keep, limit);
  const bugPaths = new Map(bugs.map((file, index) => [file.path, index]));
  // the article's rule: the five most changed files that also show up among the bug fixes
  const risky = churn
    .slice(0, 5)
    .map((file, index) => ({ ...file, churnRank: index + 1, bugRank: bugPaths.has(file.path) ? bugPaths.get(file.path) + 1 : null, bugCount: bugs[bugPaths.get(file.path)]?.count ?? 0 }))
    .filter((file) => file.bugRank !== null);

  // who built this
  const tally = (list) => {
    const counts = new Map();
    for (const commit of list) {
      const entry = counts.get(commit.author) ?? { name: commit.author, email: commit.email, commits: 0, first: commit.time, last: commit.time };
      entry.commits += 1;
      entry.first = Math.min(entry.first, commit.time);
      entry.last = Math.max(entry.last, commit.time);
      counts.set(commit.author, entry);
    }
    return [...counts.values()].sort((a, b) => b.commits - a.commits || a.name.localeCompare(b.name));
  };
  const everyone = tally(plain);
  const recent = new Map(tally(plain.filter((commit) => commit.time >= halfYearAgo)).map((entry) => [entry.name, entry.commits]));
  const activeYear = new Set(plain.filter((commit) => commit.time >= yearAgo).map((commit) => commit.author));
  const total = plain.length;
  const top = everyone[0] ?? null;
  const spanDays = plain.length ? (Math.max(...plain.map((commit) => commit.time)) - Math.min(...plain.map((commit) => commit.time))) / DAY : 0;
  const people = {
    contributors: everyone.map((entry) => ({ ...entry, share: total ? entry.commits / total : 0, recent: recent.get(entry.name) ?? 0 })),
    total,
    topShare: top && total ? top.commits / total : 0,
    busFactorRisk: Boolean(top && total >= 10 && top.commits / total >= 0.6),
    topGone: Boolean(top && spanDays > 182 && !recent.get(top.name)),
    activeLastYear: activeYear.size,
    activeLastHalfYear: recent.size,
  };

  // accelerating or dying
  const byMonth = new Map();
  for (const commit of commits) {
    const key = monthOf(commit.time, commit.zone);
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
  }
  const keys = [...byMonth.keys()].sort();
  const months = [];
  if (keys.length) {
    let [year, month] = keys[0].split('-').map(Number);
    const last = monthOf(anchor);
    const end = keys[keys.length - 1] > last ? keys[keys.length - 1] : last;
    for (let guard = 0; guard < 1200; guard += 1) {
      const key = `${year}-${String(month).padStart(2, '0')}`;
      months.push({ month: key, count: byMonth.get(key) ?? 0 });
      if (key >= end) break;
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
  }
  // the month still under way would always look like a drop, so trends use whole months
  const partial = !history.idle && months.length > 0 && months[months.length - 1].month === monthOf(history.now);
  const counts = months.map((entry) => entry.count).slice(0, partial ? -1 : undefined);
  const drops = [];
  for (let index = 1; index < counts.length; index += 1) {
    if (counts[index - 1] >= 8 && counts[index] <= counts[index - 1] / 2) drops.push({ month: months[index].month, from: counts[index - 1], to: counts[index] });
  }
  const sum = (list) => list.reduce((acc, value) => acc + value, 0);
  const lastSix = sum(counts.slice(-6));
  const previousSix = sum(counts.slice(-12, -6));
  const change = counts.length >= 12 && previousSix > 0 ? lastSix / previousSix - 1 : null;
  const active = counts.filter((count) => count > 0).sort((a, b) => a - b);
  const median = active.length ? active[Math.floor(active.length / 2)] : 0;
  const spikes = counts.filter((count, index) => median > 0 && count >= Math.max(4, median * 2.5) && (counts[index + 1] ?? 0) <= median).length;
  const latest = commits.reduce((max, commit) => Math.max(max, commit.time), 0);
  const pace = {
    months,
    partial,
    drops: drops.slice(-5),
    lastSix,
    previousSix,
    change,
    trend: change === null ? 'young' : change <= -0.3 ? 'declining' : change >= 0.3 ? 'accelerating' : 'steady',
    spikes,
    bursty: spikes >= 3,
    quietDays: latest ? Math.floor((history.now - latest) / DAY) : null,
  };

  // how often the team is firefighting
  const fires = commits.filter((commit) => commit.time >= yearAgo && FIRE_WORDS.test(commit.subject));
  const firefighting = {
    commits: fires.map((commit) => ({ sha: commit.sha, subject: commit.subject, time: commit.time, author: commit.author })),
    count: fires.length,
    level: fires.length === 0 ? 'none' : fires.length <= 12 ? 'normal' : fires.length < 24 ? 'frequent' : 'constant',
  };

  return {
    churn,
    bugs,
    risky,
    bugCommits: bugCommits.length,
    people,
    pace,
    firefighting,
    idle: history.idle,
    anchor,
    commitCount: commits.length,
    truncated: history.truncated,
    filesCapped: history.filesCapped,
  };
};
