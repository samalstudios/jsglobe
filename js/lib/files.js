// Folders and files on the user's machine, behind one small interface.
//
// A folder opened with the File System Access API can be changed; a folder
// picked through a plain file input is a read only snapshot. Both come back as
// the same kind of node, so a file browser does not need to care which it has:
//
//   const root = fromDirectoryHandle(await showDirectoryPicker());
//   for (const node of await root.list()) console.log(node.name, node.kind);

// ---- kinds -------------------------------------------------------------

const GROUPS = {
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg', 'bmp', 'ico', 'heic', 'tif', 'tiff'],
  video: ['mp4', 'webm', 'mov', 'm4v', 'mkv', 'avi', 'ogv'],
  audio: ['mp3', 'wav', 'ogg', 'oga', 'm4a', 'flac', 'aac', 'opus', 'mid', 'midi'],
  pdf: ['pdf'],
  archive: ['zip', 'tar', 'gz', 'tgz', 'bz2', 'xz', '7z', 'rar'],
  font: ['ttf', 'otf', 'woff', 'woff2'],
  sheet: ['csv', 'tsv', 'xls', 'xlsx', 'ods', 'numbers'],
  document: ['doc', 'docx', 'odt', 'rtf', 'pages', 'key', 'ppt', 'pptx'],
  code: [
    'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'json', 'html', 'htm', 'css', 'scss', 'less', 'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift',
    'c', 'h', 'cc', 'cpp', 'hpp', 'cs', 'php', 'sh', 'bash', 'zsh', 'fish', 'ps1', 'sql', 'yaml', 'yml', 'toml', 'xml', 'vue', 'svelte',
    'lua', 'dart', 'r', 'pl', 'ex', 'exs', 'erl', 'hs', 'clj', 'scala', 'zig', 'nim', 'graphql', 'gql', 'proto', 'dockerfile', 'makefile',
  ],
  text: ['txt', 'md', 'markdown', 'log', 'ini', 'cfg', 'conf', 'env', 'gitignore', 'gitattributes', 'editorconfig', 'npmrc', 'lock', 'license', 'readme', 'srt', 'vtt'],
};

const KIND_OF = new Map(Object.entries(GROUPS).flatMap(([kind, list]) => list.map((extension) => [extension, kind])));

// the colouring each extension gets; the C family borrows the JavaScript rules,
// which read well enough for braces, strings and numbers
const LANGUAGE_OF = {
  js: 'javascript', mjs: 'javascript', cjs: 'javascript', jsx: 'javascript', ts: 'javascript', tsx: 'javascript',
  go: 'javascript', rs: 'javascript', java: 'javascript', kt: 'javascript', swift: 'javascript', c: 'javascript', h: 'javascript',
  cc: 'javascript', cpp: 'javascript', hpp: 'javascript', cs: 'javascript', php: 'javascript', dart: 'javascript', scala: 'javascript',
  json: 'json', html: 'html', htm: 'html', xml: 'html', svg: 'html', vue: 'html', svelte: 'html', css: 'css', scss: 'css', less: 'css',
  py: 'python', rb: 'python', sql: 'sql', yaml: 'yaml', yml: 'yaml', toml: 'yaml', sh: 'shell', bash: 'shell', zsh: 'shell', fish: 'shell',
  env: 'shell', dockerfile: 'shell', makefile: 'shell', md: 'markdown', markdown: 'markdown',
};

const MIME_OF = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', svg: 'image/svg+xml',
  bmp: 'image/bmp', ico: 'image/x-icon', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', m4v: 'video/mp4', ogv: 'video/ogg',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac', aac: 'audio/aac', opus: 'audio/opus',
  pdf: 'application/pdf', json: 'application/json', txt: 'text/plain', md: 'text/markdown', html: 'text/html', css: 'text/css', js: 'text/javascript',
  csv: 'text/csv', xml: 'application/xml', zip: 'application/zip',
};

/** The extension of a name in lower case, or the whole name for files such as Dockerfile. */
export const extensionOf = (name = '') => {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return name.toLowerCase();
  return name.slice(dot + 1).toLowerCase();
};

/** What sort of thing a file is: image, video, audio, pdf, code, text, archive and so on. */
export const kindOf = (name, type = '') => {
  const extension = extensionOf(name);
  if (KIND_OF.has(extension)) return KIND_OF.get(extension);
  if (type.startsWith('image/')) return 'image';
  if (type.startsWith('video/')) return 'video';
  if (type.startsWith('audio/')) return 'audio';
  if (type.startsWith('text/')) return 'text';
  return 'other';
};

/** The language to colour a file's text in, or plain. */
export const languageOf = (name) => LANGUAGE_OF[extensionOf(name)] ?? 'plain';

export const mimeOf = (name, fallback = 'application/octet-stream') => MIME_OF[extensionOf(name)] ?? fallback;

/** Whether a file can be shown and edited as text. */
export const isTextual = (name, type = '') => ['code', 'text', 'sheet'].includes(kindOf(name, type)) && !['xls', 'xlsx', 'ods', 'numbers'].includes(extensionOf(name));

// ---- names -------------------------------------------------------------

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** Sorts nodes with folders first, by name, size, date or kind. */
export const sortNodes = (nodes, by = 'name', descending = false) => {
  const sign = descending ? -1 : 1;
  const key = {
    name: (a, b) => collator.compare(a.name, b.name),
    size: (a, b) => (a.size ?? -1) - (b.size ?? -1) || collator.compare(a.name, b.name),
    modified: (a, b) => (a.modified ?? 0) - (b.modified ?? 0) || collator.compare(a.name, b.name),
    kind: (a, b) => collator.compare(a.kind === 'directory' ? '' : kindOf(a.name), b.kind === 'directory' ? '' : kindOf(b.name)) || collator.compare(a.name, b.name),
  }[by] ?? ((a, b) => collator.compare(a.name, b.name));
  return [...nodes].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
    return sign * key(a, b);
  });
};

const FORBIDDEN = /[\\/:*?"<>|\x00-\x1f]/;

/** Why a name cannot be used for a file or folder, or null when it can. */
export const nameProblem = (name) => {
  if (!name || !name.trim()) return 'A name is needed';
  if (name === '.' || name === '..') return 'That name is reserved';
  if (FORBIDDEN.test(name)) return 'Names cannot contain / \\ : * ? " < > |';
  if (name.length > 255) return 'That name is too long';
  return null;
};

/** A name not yet taken in a folder: "untitled folder", "untitled folder 2" and so on. */
export const freeName = (wanted, taken) => {
  const names = new Set([...taken].map((name) => name.toLowerCase()));
  if (!names.has(wanted.toLowerCase())) return wanted;
  const dot = wanted.lastIndexOf('.');
  const [stem, extension] = dot > 0 ? [wanted.slice(0, dot), wanted.slice(dot)] : [wanted, ''];
  for (let count = 2; ; count += 1) {
    const candidate = `${stem} ${count}${extension}`;
    if (!names.has(candidate.toLowerCase())) return candidate;
  }
};

// ---- nodes on disk -----------------------------------------------------

export const canOpenFolders = () => typeof globalThis.showDirectoryPicker === 'function';

const fileNode = (handle, parent) => ({
  kind: 'file',
  name: handle.name,
  handle,
  parent,
  writable: true,
  size: undefined,
  modified: undefined,
  async file() {
    const file = await handle.getFile();
    this.size = file.size;
    this.modified = file.lastModified;
    return file;
  },
  async write(data) {
    const stream = await handle.createWritable();
    await stream.write(data);
    await stream.close();
  },
});

const copyInto = async (source, target, name = source.name) => {
  if (source.kind === 'file') {
    const created = await target.getFileHandle(name, { create: true });
    const stream = await created.createWritable();
    await stream.write(await source.getFile());
    await stream.close();
    return;
  }
  const folder = await target.getDirectoryHandle(name, { create: true });
  for await (const child of source.values()) await copyInto(child, folder);
};

/** A folder opened through showDirectoryPicker, which can be read and changed. */
export const fromDirectoryHandle = (handle, parent = null) => ({
  kind: 'directory',
  name: handle.name,
  handle,
  parent,
  writable: true,
  async list() {
    const nodes = [];
    for await (const child of handle.values()) {
      nodes.push(child.kind === 'directory' ? fromDirectoryHandle(child, this) : fileNode(child, this));
    }
    // sizes and dates come from the files themselves, fetched together
    await Promise.all(nodes.filter((node) => node.kind === 'file').map((node) => node.file().catch(() => null)));
    return nodes;
  },
  async createFolder(name) {
    return fromDirectoryHandle(await handle.getDirectoryHandle(name, { create: true }), this);
  },
  async createFile(name, data = '') {
    const created = fileNode(await handle.getFileHandle(name, { create: true }), this);
    if (data !== null) await created.write(data);
    return created;
  },
  async remove(name) {
    await handle.removeEntry(name, { recursive: true });
  },
  async rename(node, name) {
    if (typeof node.handle.move === 'function') {
      try {
        await node.handle.move(name);
        return;
      } catch (error) {
        if (error?.name !== 'NotSupportedError' && error?.name !== 'TypeError') throw error;
      }
    }
    await copyInto(node.handle, handle, name);
    await handle.removeEntry(node.name, { recursive: true });
  },
  async has(name) {
    for await (const child of handle.keys()) if (child === name) return true;
    return false;
  },
  async permission(mode = 'readwrite') {
    if (!handle.queryPermission) return 'granted';
    if ((await handle.queryPermission({ mode })) === 'granted') return 'granted';
    return handle.requestPermission({ mode });
  },
});

/** A read only folder built from the files a directory file input returns. */
export const fromFileList = (files) => {
  const make = (name, parent) => ({ kind: 'directory', name, parent, writable: false, children: new Map() });
  const list = [...files];
  const rootName = list[0]?.webkitRelativePath?.split('/')[0] || 'Files';
  const root = make(rootName, null);
  for (const file of list) {
    const parts = (file.webkitRelativePath || file.name).split('/');
    if (parts.length > 1) parts.shift();
    let folder = root;
    for (const part of parts.slice(0, -1)) {
      if (!folder.children.has(part)) folder.children.set(part, make(part, folder));
      folder = folder.children.get(part);
    }
    const name = parts[parts.length - 1];
    folder.children.set(name, {
      kind: 'file',
      name,
      parent: folder,
      writable: false,
      size: file.size,
      modified: file.lastModified,
      file: async () => file,
    });
  }
  const finish = (folder) => {
    folder.list = async () => [...folder.children.values()];
    folder.children.forEach((child) => child.kind === 'directory' && finish(child));
    return folder;
  };
  return finish(root);
};

/** The folders from the root down to a node, root first. */
export const pathOf = (node) => {
  const path = [];
  for (let at = node; at; at = at.parent) path.unshift(at);
  return path;
};

/** Every file below a folder, with its path, depth first. Stops after limit files. */
export const walk = async (folder, { limit = 5000, prefix = '' } = {}) => {
  const found = [];
  const visit = async (node, path) => {
    for (const child of await node.list()) {
      if (found.length >= limit) return;
      const at = path ? `${path}/${child.name}` : child.name;
      if (child.kind === 'directory') await visit(child, at);
      else found.push({ path: at, node: child });
    }
  };
  await visit(folder, prefix);
  return found;
};
