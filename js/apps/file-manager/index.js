import { JGApp, define, html, raw, styleSheet } from '../../core/app.js';
import { appWords } from '../../core/i18n.js';
import { blobs } from '../../core/blobs.js';
import { download, formatBytes, toast, uid } from '../../core/util.js';
import { confirm } from '../../ui/jg-dialog.js';
import {
  canOpenFolders, fromDirectoryHandle, fromFileList, sortNodes, kindOf, extensionOf, languageOf, isTextual, mimeOf, nameProblem, freeName, pathOf,
} from '../../lib/files.js';
import { highlight } from '../../lib/syntax.js';

const t = await appWords('file-manager', (lang) => import(`./i18n/${lang}.js`));

const sheet = await styleSheet(import.meta.url);

const EDITABLE_LIMIT = 2 * 1024 * 1024;
const THUMBNAIL_LIMIT = 160;

const GLYPHS = {
  back: '<path d="m14.5 6-6 6 6 6"/>',
  forward: '<path d="m9.5 6 6 6-6 6"/>',
  up: '<path d="M12 18.5V6M6.5 11.5 12 6l5.5 5.5"/>',
  folderPlus: '<path d="M3.5 7.5a2 2 0 0 1 2-2h3.3l2.2 2.4h7.5a2 2 0 0 1 2 2v7.6a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z"/><path d="M12 11v5M9.5 13.5h5"/>',
  filePlus: '<path d="M13.5 3.5H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9Z"/><path d="M13.5 3.5V9H19M12 12v5M9.5 14.5h5"/>',
  upload: '<path d="M12 15V4.5M7.5 9 12 4.5 16.5 9M5 15.5v2.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2.5"/>',
  download: '<path d="M12 4.5V15M7.5 10.5 12 15l4.5-4.5M5 15.5v2.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2.5"/>',
  trash: '<path d="M4.5 7h15M9.5 7V5.2a1.2 1.2 0 0 1 1.2-1.2h2.6a1.2 1.2 0 0 1 1.2 1.2V7M6.5 7l.8 11.3a2 2 0 0 0 2 1.7h5.4a2 2 0 0 0 2-1.7L17.5 7M10.2 10.5v6M13.8 10.5v6"/>',
  rename: '<path d="M4.5 19.5h4l10-10a2.1 2.1 0 0 0-3-3l-10 10Z"/><path d="m13.5 8.5 3 3"/>',
  refresh: '<path d="M19 12a7 7 0 1 1-2.1-5"/><path d="M19.2 4.5V8h-3.5"/>',
  list: '<path d="M8.5 7h11M8.5 12h11M8.5 17h11"/><circle cx="4.8" cy="7" r=".9" fill="currentColor"/><circle cx="4.8" cy="12" r=".9" fill="currentColor"/><circle cx="4.8" cy="17" r=".9" fill="currentColor"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>',
  open: '<path d="M13.5 4.5h6v6M19.5 4.5l-8 8M17 14v4a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2V9.5a2 2 0 0 1 2-2h4"/>',
  search: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 4.5 4.5"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>',
  close: '<path d="m7 7 10 10M17 7 7 17"/>',
};

const glyph = (name, size = 16) =>
  raw(`<svg class="glyph" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLYPHS[name]}</svg>`);

// badge colours on a document icon, one per kind of file
const KIND_TINT = {
  image: '#34a853', video: '#8e44ef', audio: '#ff2d55', pdf: '#e5383b', archive: '#8d6e63', font: '#5856d6',
  sheet: '#1e8e3e', document: '#2b6de5', code: '#f29900', text: '#8e8e93', other: '#8e8e93',
};

const folderIcon = (size) =>
  raw(`<svg class="kind-icon" viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true">
    <path d="M4 10.5a3.5 3.5 0 0 1 3.5-3.5h8.2c1 0 1.9.4 2.6 1.1L20.5 10H32.5A3.5 3.5 0 0 1 36 13.5v2H4Z" fill="#3a9bea"/>
    <path d="M4 14.5A2.5 2.5 0 0 1 6.5 12h27a2.5 2.5 0 0 1 2.5 2.5V30a3.5 3.5 0 0 1-3.5 3.5h-25A3.5 3.5 0 0 1 4 30Z" fill="#6cc0ff"/>
    <path d="M4 14.5A2.5 2.5 0 0 1 6.5 12h27a2.5 2.5 0 0 1 2.5 2.5v1H4Z" fill="#fff" opacity=".35"/>
  </svg>`);

const fileIcon = (name, size) => {
  const kind = kindOf(name);
  const tint = KIND_TINT[kind];
  const label = extensionOf(name).slice(0, 4).toUpperCase();
  const showLabel = label && name.includes('.') && size >= 28;
  return raw(`<svg class="kind-icon" viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true">
    <path d="M9.5 3.5h14.2L32 11.8V34a2.5 2.5 0 0 1-2.5 2.5h-20A2.5 2.5 0 0 1 7 34V6a2.5 2.5 0 0 1 2.5-2.5Z" fill="var(--doc-paper)" stroke="var(--doc-edge)" stroke-width="1"/>
    <path d="M23.5 3.5V10a2 2 0 0 0 2 2H32" fill="var(--doc-fold)" stroke="var(--doc-edge)" stroke-width="1" stroke-linejoin="round"/>
    ${showLabel
      ? `<rect x="5" y="21" width="${Math.max(16, label.length * 5.4 + 6)}" height="10" rx="2.5" fill="${tint}"/><text x="${5 + Math.max(16, label.length * 5.4 + 6) / 2}" y="28.6" text-anchor="middle" font-family="-apple-system, system-ui, sans-serif" font-size="7.4" font-weight="700" fill="#fff">${label.replace(/[<>&"]/g, '')}</text>`
      : `<rect x="12" y="19" width="15" height="2.4" rx="1.2" fill="${tint}" opacity=".75"/><rect x="12" y="24" width="12" height="2.4" rx="1.2" fill="${tint}" opacity=".45"/>`}
  </svg>`);
};

const iconFor = (node, size = 20) => (node.kind === 'directory' ? folderIcon(size) : fileIcon(node.name, size));

const kindLabel = (node) => {
  if (node.kind === 'directory') return t('file-manager.folder', 'Folder');
  const kind = kindOf(node.name);
  const labels = {
    image: t('file-manager.image', 'Image'),
    video: t('file-manager.video', 'Video'),
    audio: t('file-manager.audio', 'Audio'),
    pdf: t('file-manager.pdfDocument', 'PDF document'),
    archive: t('file-manager.archive', 'Archive'),
    font: t('file-manager.font', 'Font'),
    sheet: t('file-manager.spreadsheet', 'Spreadsheet'),
    document: t('file-manager.document', 'Document'),
    code: t('file-manager.sourceCode', 'Source code'),
    text: t('file-manager.plainText', 'Text'),
  };
  return labels[kind] ?? (extensionOf(node.name) && node.name.includes('.') ? `${extensionOf(node.name).toUpperCase()} ${t('file-manager.file', 'file')}` : t('file-manager.document', 'Document'));
};

const when = (time) => (time ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(time) : '—');

class FileManager extends JGApp {
  static appId = 'file-manager';
  static styles = [...JGApp.styles, sheet];

  #root = null;
  #folder = null;
  #nodes = [];
  #visible = [];
  #selected = new Set();
  #anchor = null;
  #back = [];
  #forward = [];
  #filter = '';
  #urls = new Set();
  #thumbs = new Set();
  #editing = null;
  #dirty = false;
  #recents = [];
  #expanded = new Set();
  #listings = new WeakMap();

  get #prefs() {
    return { view: 'list', sort: 'name', descending: false, hidden: false, ...this.store.read({}) };
  }

  #setPrefs(patch) {
    this.store.write({ ...this.#prefs, ...patch });
  }

  renderApp() {
    this.paint(html`<div class="fm" id="fm">
      <aside class="sidebar">
        <jg-button id="open" size="sm">${t('file-manager.openFolder', 'Open folder…')}</jg-button>
        <input id="picker" type="file" webkitdirectory multiple hidden />
        <div class="group" id="recent-group" hidden>
          <div class="group-title">${t('file-manager.recent', 'Recent')}</div>
          <div class="places" id="recents"></div>
        </div>
        <div class="group grow-group" id="tree-group" hidden>
          <div class="group-title">${t('file-manager.folders', 'Folders')}</div>
          <div class="tree" id="tree" role="tree"></div>
        </div>
      </aside>

      <section class="main" id="main">
        <div class="toolbar">
          <div class="nav">
            <button class="tool" id="back" title="${t('file-manager.back', 'Back')}" disabled>${glyph('back')}</button>
            <button class="tool" id="forward" title="${t('file-manager.forward', 'Forward')}" disabled>${glyph('forward')}</button>
            <button class="tool" id="up" title="${t('file-manager.enclosingFolder', 'Enclosing folder')}" disabled>${glyph('up')}</button>
          </div>
          <nav class="crumbs" id="crumbs"></nav>
          <span class="spring"></span>
          <div class="nav">
            <button class="tool" id="new-folder" title="${t('file-manager.newFolder', 'New folder')}" disabled>${glyph('folderPlus')}</button>
            <button class="tool" id="new-file" title="${t('file-manager.newTextFile', 'New text file')}" disabled>${glyph('filePlus')}</button>
            <button class="tool" id="import" title="${t('file-manager.addFiles', 'Add files')}" disabled>${glyph('upload')}</button>
            <input id="import-picker" type="file" multiple hidden />
          </div>
          <div class="nav">
            <button class="tool" id="view-list" title="${t('file-manager.asList', 'As list')}">${glyph('list')}</button>
            <button class="tool" id="view-grid" title="${t('file-manager.asIcons', 'As icons')}">${glyph('grid')}</button>
          </div>
          <label class="search">${glyph('search', 14)}<input id="filter" type="search" placeholder="${t('file-manager.search', 'Search')}" /></label>
        </div>

        <div class="listing" id="listing" tabindex="0"></div>

        <footer class="statusbar">
          <span id="summary"></span>
          <span class="spring"></span>
          <label class="hidden-toggle"><input type="checkbox" id="show-hidden" /> ${t('file-manager.showHiddenFiles', 'Show hidden files')}</label>
          <button class="tool small" id="refresh" title="${t('file-manager.refresh', 'Refresh')}" disabled>${glyph('refresh', 14)}</button>
        </footer>
        <div class="drop-veil" id="veil">${t('file-manager.dropToCopyHere', 'Drop to copy into this folder')}</div>
      </section>

      <aside class="inspector" id="inspector" hidden></aside>
    </div>`);

    this.on(this.$('#open'), 'click', () => this.#pickFolder());
    this.on(this.$('#picker'), 'change', (event) => {
      if (event.target.files.length) this.#openRoot(fromFileList(event.target.files));
      event.target.value = '';
    });
    this.on(this.$('#back'), 'click', () => this.#history(-1));
    this.on(this.$('#forward'), 'click', () => this.#history(1));
    this.on(this.$('#up'), 'click', () => this.#folder?.parent && this.#go(this.#folder.parent));
    this.on(this.$('#new-folder'), 'click', () => this.#create('directory'));
    this.on(this.$('#new-file'), 'click', () => this.#create('file'));
    this.on(this.$('#import'), 'click', () => this.$('#import-picker').click());
    this.on(this.$('#import-picker'), 'change', async (event) => {
      await this.#copyFiles([...event.target.files]);
      event.target.value = '';
    });
    this.on(this.$('#view-list'), 'click', () => this.#setView('list'));
    this.on(this.$('#view-grid'), 'click', () => this.#setView('grid'));
    this.on(this.$('#filter'), 'input', (event) => {
      this.#filter = event.target.value.trim().toLowerCase();
      this.#paintListing();
    });
    this.on(this.$('#show-hidden'), 'change', (event) => {
      this.#setPrefs({ hidden: event.target.checked });
      this.#paintListing();
    });
    this.on(this.$('#refresh'), 'click', () => this.#reload());
    this.on(this.$('#listing'), 'keydown', (event) => this.#keys(event));
    this.#dropZone();

    this.$('#show-hidden').checked = this.#prefs.hidden;
    this.#paintViewButtons();
    this.#loadRecents();

    if (this.#root) this.#go(this.#folder ?? this.#root, { remember: false });
    else this.#paintWelcome();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.#releaseUrls();
    this.#releaseThumbs();
  }

  // ---- opening ---------------------------------------------------------

  async #pickFolder() {
    if (!canOpenFolders()) {
      this.$('#picker').click();
      return;
    }
    let handle;
    try {
      handle = await window.showDirectoryPicker({ mode: 'readwrite', id: 'file-manager' });
    } catch (error) {
      if (error?.name !== 'AbortError') toast(error.message, 'error');
      return;
    }
    await this.#remember(handle);
    this.#openRoot(fromDirectoryHandle(handle));
  }

  async #openRecent(record) {
    const node = fromDirectoryHandle(record.handle);
    try {
      if ((await node.permission('readwrite')) !== 'granted') {
        toast(t('file-manager.permissionWasNotGiven', 'Permission to open the folder was not given'), 'error');
        return;
      }
    } catch (error) {
      toast(error.message, 'error');
      return;
    }
    await this.#remember(record.handle);
    this.#openRoot(node);
  }

  #openRoot(root) {
    this.#root = root;
    this.#back = [];
    this.#forward = [];
    this.#expanded = new Set([root]);
    this.#listings = new WeakMap();
    this.$('#tree-group').hidden = false;
    this.#go(root, { remember: false });
  }

  async #loadRecents() {
    if (!canOpenFolders()) return;
    try {
      this.#recents = (await blobs.list('file-manager')).filter((record) => record.handle).slice(0, 8);
    } catch {
      this.#recents = [];
    }
    this.#paintRecents();
  }

  async #remember(handle) {
    try {
      const records = await blobs.list('file-manager');
      for (const record of records) {
        if (record.handle && (await record.handle.isSameEntry(handle))) await blobs.remove(record.id);
      }
      await blobs.put('file-manager', { id: uid(), name: handle.name, handle, created: Date.now() });
      const extra = (await blobs.list('file-manager')).slice(8);
      await Promise.all(extra.map((record) => blobs.remove(record.id)));
    } catch {}
    this.#loadRecents();
  }

  #paintRecents() {
    const group = this.$('#recent-group');
    if (!group) return;
    group.hidden = !this.#recents.length;
    this.$('#recents').innerHTML = this.#recents
      .map((record) => html`<div class="place-row">
        <button class="place" data-recent="${record.id}" title="${record.name}">${folderIcon(16)}<span>${record.name}</span></button>
        <button class="forget" data-forget="${record.id}" title="${t('file-manager.removeFromRecent', 'Remove from recent')}">${glyph('close', 12)}</button>
      </div>`)
      .join('');
    this.bind('[data-recent]', 'click', (event) => {
      const record = this.#recents.find((item) => item.id === event.currentTarget.dataset.recent);
      if (record) this.#openRecent(record);
    });
    this.bind('[data-forget]', 'click', async (event) => {
      await blobs.remove(event.currentTarget.dataset.forget);
      this.#loadRecents();
    });
  }

  #paintWelcome() {
    const supported = canOpenFolders();
    this.$('#listing').innerHTML = html`<div class="welcome">
      ${folderIcon(84)}
      <div class="welcome-title">${t('file-manager.openAFolderToBegin', 'Open a folder to begin')}</div>
      <p>${supported
        ? t('file-manager.browseChangeAndPreview', 'Browse, preview and organise the files in a folder on this computer. Nothing leaves your device.')
        : t('file-manager.thisBrowserCanOnlyRead', 'This browser can look inside a folder but cannot change it. Use a Chromium based browser such as Chrome or Edge to create, rename and delete files.')}</p>
      <jg-button id="welcome-open">${t('file-manager.openFolder', 'Open folder…')}</jg-button>
    </div>`;
    this.on(this.$('#welcome-open'), 'click', () => this.#pickFolder());
    this.$('#summary').textContent = '';
  }

  // ---- navigation ------------------------------------------------------

  async #go(folder, { remember = true } = {}) {
    if (!(await this.#leaveEditor())) return;
    if (remember && this.#folder && this.#folder !== folder) {
      this.#back.push(this.#folder);
      this.#forward = [];
    }
    this.#folder = folder;
    this.#selected.clear();
    this.#anchor = null;
    this.#filter = '';
    const filter = this.$('#filter');
    if (filter) filter.value = '';
    this.#expanded.add(folder);
    pathOf(folder).forEach((step) => this.#expanded.add(step));
    await this.#reload();
  }

  async #history(step) {
    const from = step < 0 ? this.#back : this.#forward;
    const to = step < 0 ? this.#forward : this.#back;
    const target = from.pop();
    if (!target) return;
    to.push(this.#folder);
    await this.#go(target, { remember: false });
  }

  async #reload() {
    const folder = this.#folder;
    if (!folder) return;
    this.$('#listing').setAttribute('aria-busy', 'true');
    try {
      const nodes = await folder.list();
      if (this.#folder !== folder) return;
      this.#nodes = nodes;
      this.#listings.set(folder, nodes.filter((node) => node.kind === 'directory'));
    } catch (error) {
      toast(error.message, 'error');
      this.#nodes = [];
    }
    this.$('#listing').removeAttribute('aria-busy');
    const names = new Set(this.#nodes.map((node) => node.name));
    this.#selected = new Set([...this.#selected].filter((node) => names.has(node.name) && this.#nodes.includes(node)));
    this.#paintChrome();
    this.#paintListing();
    this.#paintTree();
    this.#paintInspector();
  }

  #paintChrome() {
    const folder = this.#folder;
    const writable = Boolean(folder?.writable);
    this.$('#back').disabled = !this.#back.length;
    this.$('#forward').disabled = !this.#forward.length;
    this.$('#up').disabled = !folder?.parent;
    this.$('#new-folder').disabled = !writable;
    this.$('#new-file').disabled = !writable;
    this.$('#import').disabled = !writable;
    this.$('#refresh').disabled = !folder;
    const path = folder ? pathOf(folder) : [];
    this.$('#crumbs').innerHTML = path
      .map((step, index) => html`${index ? html`<span class="crumb-gap">›</span>` : ''}<button class="crumb" data-depth="${index}" ${index === path.length - 1 ? raw('aria-current="page"') : ''}>${index === 0 ? folderIcon(15) : ''}<span>${step.name}</span></button>`)
      .join('');
    this.$$('[data-depth]').forEach((node) => this.on(node, 'click', () => this.#go(path[Number(node.dataset.depth)])));
    this.setTitle(folder ? folder.name : '');
  }

  #setView(view) {
    this.#setPrefs({ view });
    this.#paintViewButtons();
    this.#paintListing();
  }

  #paintViewButtons() {
    const { view } = this.#prefs;
    this.$('#view-list').setAttribute('aria-pressed', String(view === 'list'));
    this.$('#view-grid').setAttribute('aria-pressed', String(view === 'grid'));
  }

  // ---- listing ---------------------------------------------------------

  #paintListing() {
    const listing = this.$('#listing');
    if (!this.#folder) return this.#paintWelcome();
    const { view, sort, descending, hidden } = this.#prefs;
    this.#releaseThumbs();
    this.#visible = sortNodes(
      this.#nodes.filter((node) => (hidden || !node.name.startsWith('.')) && (!this.#filter || node.name.toLowerCase().includes(this.#filter))),
      sort,
      descending,
    );
    listing.dataset.view = view;

    if (!this.#visible.length) {
      listing.innerHTML = html`<div class="empty-folder">${this.#filter ? t('file-manager.noItemsMatch', 'No items match') : t('file-manager.thisFolderIsEmpty', 'This folder is empty')}</div>`;
      this.#paintSummary();
      return;
    }

    const arrow = (column) => (sort === column ? raw(`<span class="sort-arrow">${descending ? '▾' : '▴'}</span>`) : '');
    if (view === 'grid') {
      listing.innerHTML = html`<div class="grid" role="grid">${this.#visible.map((node, index) => html`<div class="tile" role="gridcell" data-index="${index}" aria-selected="${String(this.#selected.has(node))}" draggable="false">
        <div class="thumb" data-thumb="${index}">${iconFor(node, 56)}</div>
        <div class="tile-name" title="${node.name}">${node.name}</div>
      </div>`)}</div>`;
      this.#loadThumbnails();
    } else {
      listing.innerHTML = html`<div class="table" role="grid">
        <div class="thead" role="row">
          <button class="th name" data-sort="name">${t('file-manager.name', 'Name')}${arrow('name')}</button>
          <button class="th size" data-sort="size">${t('file-manager.size', 'Size')}${arrow('size')}</button>
          <button class="th date" data-sort="modified">${t('file-manager.dateModified', 'Date modified')}${arrow('modified')}</button>
          <button class="th kind" data-sort="kind">${t('file-manager.kind', 'Kind')}${arrow('kind')}</button>
        </div>
        ${this.#visible.map((node, index) => html`<div class="tr" role="row" data-index="${index}" aria-selected="${String(this.#selected.has(node))}">
          <span class="td name">${iconFor(node, 18)}<span class="label">${node.name}</span></span>
          <span class="td size">${node.kind === 'directory' ? '—' : formatBytes(node.size ?? 0)}</span>
          <span class="td date">${when(node.modified)}</span>
          <span class="td kind">${kindLabel(node)}</span>
        </div>`)}
      </div>`;
      this.bind('[data-sort]', 'click', (event) => {
        const column = event.currentTarget.dataset.sort;
        const prefs = this.#prefs;
        this.#setPrefs({ sort: column, descending: prefs.sort === column ? !prefs.descending : false });
        this.#paintListing();
      });
    }

    this.bind('[data-index]', 'click', (event) => this.#click(event));
    this.bind('[data-index]', 'dblclick', (event) => this.#open(this.#visible[Number(event.currentTarget.dataset.index)]));
    this.on(listing, 'click', (event) => {
      if (event.target === listing || event.target.classList.contains('grid') || event.target.classList.contains('table')) {
        this.#selected.clear();
        this.#paintSelection();
      }
    });
    this.#paintSummary();
  }

  #click(event) {
    const index = Number(event.currentTarget.dataset.index);
    const node = this.#visible[index];
    if (event.shiftKey && this.#anchor !== null) {
      const [from, to] = [Math.min(this.#anchor, index), Math.max(this.#anchor, index)];
      if (!(event.metaKey || event.ctrlKey)) this.#selected.clear();
      this.#visible.slice(from, to + 1).forEach((item) => this.#selected.add(item));
    } else if (event.metaKey || event.ctrlKey) {
      if (this.#selected.has(node)) this.#selected.delete(node);
      else this.#selected.add(node);
      this.#anchor = index;
    } else {
      this.#selected = new Set([node]);
      this.#anchor = index;
    }
    this.#paintSelection();
  }

  #paintSelection() {
    this.$$('[data-index]').forEach((row) => row.setAttribute('aria-selected', String(this.#selected.has(this.#visible[Number(row.dataset.index)]))));
    this.#paintSummary();
    this.#paintInspector();
  }

  #paintSummary() {
    const summary = this.$('#summary');
    if (!summary) return;
    const count = this.#visible.length;
    const chosen = [...this.#selected];
    const bytes = chosen.reduce((total, node) => total + (node.size ?? 0), 0);
    summary.textContent = chosen.length
      ? t('file-manager.selectedOfItems', '{selected} of {count} selected, {size}', { selected: chosen.length, count, size: formatBytes(bytes) })
      : t('file-manager.itemsCount', '{count} items', { count });
    if (this.#folder && !this.#folder.writable) summary.textContent += ` · ${t('file-manager.readOnly', 'Read only')}`;
  }

  async #loadThumbnails() {
    const tiles = this.$$('[data-thumb]').slice(0, THUMBNAIL_LIMIT);
    const folder = this.#folder;
    for (const holder of tiles) {
      const node = this.#visible[Number(holder.dataset.thumb)];
      if (!node || node.kind !== 'file' || kindOf(node.name) !== 'image' || (node.size ?? 0) > 25 * 1024 * 1024) continue;
      try {
        const file = await node.file();
        if (this.#folder !== folder || !holder.isConnected) return;
        const url = URL.createObjectURL(file);
        this.#thumbs.add(url);
        holder.innerHTML = html`<img class="picture" src="${url}" alt="" loading="lazy" decoding="async" />`;
      } catch {}
    }
  }

  #releaseThumbs() {
    this.#thumbs.forEach((url) => URL.revokeObjectURL(url));
    this.#thumbs.clear();
  }

  #keys(event) {
    const typing = event.composedPath()[0]?.tagName === 'INPUT';
    if (typing) return;
    const modifier = event.metaKey || event.ctrlKey;
    const chosen = [...this.#selected];
    const last = chosen.length ? this.#visible.indexOf(chosen[chosen.length - 1]) : -1;
    const columns = this.#prefs.view === 'grid' ? Math.max(1, Math.floor(this.$('.grid')?.clientWidth / 112) || 1) : 1;
    const move = (step) => {
      event.preventDefault();
      if (!this.#visible.length) return;
      const next = Math.min(this.#visible.length - 1, Math.max(0, last < 0 ? 0 : last + step));
      this.#selected = new Set([this.#visible[next]]);
      this.#anchor = next;
      this.#paintSelection();
      this.$(`[data-index="${next}"]`)?.scrollIntoView({ block: 'nearest' });
    };
    if (event.key === 'ArrowUp' && modifier) {
      event.preventDefault();
      if (this.#folder?.parent) this.#go(this.#folder.parent);
    } else if (event.key === 'ArrowDown' && modifier) {
      event.preventDefault();
      if (chosen.length === 1) this.#open(chosen[0]);
    } else if (event.key === 'ArrowDown') move(columns);
    else if (event.key === 'ArrowUp') move(-columns);
    else if (event.key === 'ArrowRight' && columns > 1) move(1);
    else if (event.key === 'ArrowLeft' && columns > 1) move(-1);
    else if (event.key === 'Enter' && chosen.length === 1) {
      event.preventDefault();
      if (this.#folder?.writable) this.#startRename(chosen[0]);
    } else if ((event.key === 'Backspace' && modifier) || event.key === 'Delete') {
      event.preventDefault();
      this.#remove(chosen);
    } else if (event.key === 'a' && modifier) {
      event.preventDefault();
      this.#selected = new Set(this.#visible);
      this.#paintSelection();
    } else if (event.key === 'F2' && chosen.length === 1) {
      this.#startRename(chosen[0]);
    }
  }

  #open(node) {
    if (!node) return;
    if (node.kind === 'directory') this.#go(node);
    else {
      this.#selected = new Set([node]);
      this.#paintSelection();
    }
  }

  // ---- tree ------------------------------------------------------------

  async #paintTree() {
    const tree = this.$('#tree');
    if (!tree || !this.#root) return;
    const rows = [];
    const visit = async (folder, depth) => {
      const open = this.#expanded.has(folder);
      let children = this.#listings.get(folder);
      if (open && !children) {
        try {
          children = (await folder.list()).filter((node) => node.kind === 'directory');
        } catch {
          children = [];
        }
        this.#listings.set(folder, children);
      }
      rows.push({ folder, depth, open, leaf: children ? !children.length : false });
      if (open && children) {
        for (const child of sortNodes(children).filter((node) => this.#prefs.hidden || !node.name.startsWith('.'))) await visit(child, depth + 1);
      }
    };
    await visit(this.#root, 0);
    tree.innerHTML = rows
      .map((row, index) => html`<div class="branch" role="treeitem" aria-expanded="${String(row.open)}" aria-current="${String(row.folder === this.#folder)}" style="--depth:${row.depth}">
        <button class="twisty" data-twisty="${index}" ${row.leaf ? raw('data-leaf') : ''} aria-label="${row.open ? t('file-manager.collapse', 'Collapse') : t('file-manager.expand', 'Expand')}"><svg viewBox="0 0 10 10" width="9" height="9"><path d="M3.5 2 6.5 5 3.5 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <button class="branch-name" data-branch="${index}">${folderIcon(16)}<span>${row.folder.name}</span></button>
      </div>`)
      .join('');
    this.bind('[data-twisty]', 'click', (event) => {
      const { folder } = rows[Number(event.currentTarget.dataset.twisty)];
      if (this.#expanded.has(folder)) this.#expanded.delete(folder);
      else this.#expanded.add(folder);
      this.#paintTree();
    });
    this.bind('[data-branch]', 'click', (event) => this.#go(rows[Number(event.currentTarget.dataset.branch)].folder));
  }

  // ---- inspector -------------------------------------------------------

  #releaseUrls() {
    this.#urls.forEach((url) => URL.revokeObjectURL(url));
    this.#urls.clear();
  }

  async #leaveEditor() {
    if (!this.#dirty || !this.#editing) return true;
    const keep = await confirm({
      title: t('file-manager.saveChangesTo', 'Save changes to {name}?', { name: this.#editing.name }),
      message: t('file-manager.yourChangesAreLost', 'Your changes are lost if you do not save them.'),
      confirmLabel: t('file-manager.save', 'Save'),
      cancelLabel: t('file-manager.discard', 'Discard'),
    });
    if (keep) await this.#save();
    this.#dirty = false;
    return true;
  }

  async #paintInspector() {
    const inspector = this.$('#inspector');
    const chosen = [...this.#selected];
    const node = chosen.length === 1 ? chosen[0] : null;
    if (this.#editing && node !== this.#editing) {
      await this.#leaveEditor();
      this.#editing = null;
    }
    if (node && node === this.#editing) return;
    this.#releaseUrls();
    if (!chosen.length) {
      inspector.hidden = true;
      inspector.innerHTML = '';
      return;
    }
    inspector.hidden = false;
    const writable = Boolean(this.#folder?.writable);

    if (!node) {
      const bytes = chosen.reduce((total, item) => total + (item.size ?? 0), 0);
      inspector.innerHTML = html`<div class="inspector-body">
        <div class="stacked-icons">${chosen.slice(0, 3).map((item) => iconFor(item, 64))}</div>
        <div class="inspector-title">${t('file-manager.itemsSelected', '{count} items selected', { count: chosen.length })}</div>
        <div class="facts"><div>${t('file-manager.size', 'Size')}</div><div>${formatBytes(bytes)}</div></div>
        <div class="actions">
          <jg-button size="sm" variant="outline" id="download-all">${glyph('download', 14)} ${t('file-manager.download', 'Download')}</jg-button>
          ${writable ? html`<jg-button size="sm" variant="destructive" id="delete">${glyph('trash', 14)} ${t('file-manager.moveToDelete', 'Delete')}</jg-button>` : ''}
        </div>
      </div>`;
      this.on(inspector.querySelector('#download-all'), 'click', () => this.#download(chosen));
      this.on(inspector.querySelector('#delete'), 'click', () => this.#remove(chosen));
      return;
    }

    const isFolder = node.kind === 'directory';
    inspector.innerHTML = html`<div class="inspector-body">
      <div class="preview" id="preview">${iconFor(node, 96)}</div>
      <div class="inspector-title" title="${node.name}">${node.name}</div>
      <div class="inspector-kind">${kindLabel(node)}</div>
      <div class="facts" id="facts">
        ${isFolder ? '' : html`<div>${t('file-manager.size', 'Size')}</div><div>${formatBytes(node.size ?? 0)}</div>`}
        ${node.modified ? html`<div>${t('file-manager.modified', 'Modified')}</div><div>${when(node.modified)}</div>` : ''}
      </div>
      <div class="actions">
        ${isFolder ? html`<jg-button size="sm" id="enter">${glyph('open', 14)} ${t('file-manager.open', 'Open')}</jg-button>` : html`<jg-button size="sm" variant="outline" id="new-tab">${glyph('open', 14)} ${t('file-manager.openInNewTab', 'Open in new tab')}</jg-button>
          <jg-button size="sm" variant="outline" id="download">${glyph('download', 14)} ${t('file-manager.download', 'Download')}</jg-button>`}
        ${writable ? html`<jg-button size="sm" variant="ghost" id="rename">${glyph('rename', 14)} ${t('file-manager.rename', 'Rename')}</jg-button>
          <jg-button size="sm" variant="ghost" id="delete" class="danger">${glyph('trash', 14)} ${t('file-manager.moveToDelete', 'Delete')}</jg-button>` : ''}
      </div>
    </div>`;
    this.on(inspector.querySelector('#enter'), 'click', () => this.#go(node));
    this.on(inspector.querySelector('#download'), 'click', () => this.#download([node]));
    this.on(inspector.querySelector('#new-tab'), 'click', async () => {
      const file = await node.file();
      const url = URL.createObjectURL(file.type ? file : new Blob([file], { type: mimeOf(node.name) }));
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    });
    this.on(inspector.querySelector('#rename'), 'click', () => this.#startRename(node));
    this.on(inspector.querySelector('#delete'), 'click', () => this.#remove([node]));

    if (isFolder) {
      try {
        const count = (await node.list()).length;
        if (this.#selected.has(node) && inspector.querySelector('#facts')) {
          inspector.querySelector('#facts').insertAdjacentHTML('afterbegin', String(html`<div>${t('file-manager.contains', 'Contains')}</div><div>${t('file-manager.itemsCount', '{count} items', { count })}</div>`));
        }
      } catch {}
      return;
    }
    await this.#preview(node);
  }

  async #preview(node) {
    const holder = this.$('#preview');
    let file;
    try {
      file = await node.file();
    } catch (error) {
      toast(error.message, 'error');
      return;
    }
    if (!this.#selected.has(node) || !holder?.isConnected) return;
    const kind = kindOf(node.name, file.type);
    const typed = file.type ? file : new Blob([file], { type: mimeOf(node.name) });
    const url = () => {
      const made = URL.createObjectURL(typed);
      this.#urls.add(made);
      return made;
    };
    if (kind === 'image') {
      holder.innerHTML = html`<img class="picture" alt="" src="${url()}" />`;
      const image = holder.querySelector('img');
      image.addEventListener('load', () => {
        this.$('#facts')?.insertAdjacentHTML('beforeend', String(html`<div>${t('file-manager.dimensions', 'Dimensions')}</div><div>${image.naturalWidth} × ${image.naturalHeight}</div>`));
      }, { once: true });
    } else if (kind === 'video') {
      holder.innerHTML = html`<video controls playsinline src="${url()}"></video>`;
    } else if (kind === 'audio') {
      holder.innerHTML = html`${iconFor(node, 72)}<audio controls src="${url()}"></audio>`;
    } else if (kind === 'pdf') {
      holder.classList.add('tall');
      holder.innerHTML = html`<iframe title="${node.name}" src="${url()}"></iframe>`;
    } else if (kind === 'font') {
      try {
        const family = `preview-${uid().slice(0, 8)}`;
        const face = new FontFace(family, await file.arrayBuffer());
        await face.load();
        this.shadowRoot.fonts?.add?.(face);
        document.fonts.add(face);
        holder.innerHTML = html`<div class="font-sample" style="font-family:'${family}'">Aa<small>The quick brown fox jumps over the lazy dog 0123456789</small></div>`;
      } catch {}
    } else if (isTextual(node.name, file.type) && file.size <= EDITABLE_LIMIT) {
      const text = await file.text();
      if (!this.#selected.has(node)) return;
      const writable = Boolean(this.#folder?.writable);
      holder.classList.add('tall', 'text');
      holder.innerHTML = writable
        ? html`<jg-code id="editor" grow language="${languageOf(node.name)}"></jg-code>`
        : html`<pre class="code-view">${raw(highlight(text.slice(0, 200000), languageOf(node.name)))}</pre>`;
      if (writable) {
        const editor = holder.querySelector('#editor');
        editor.value = text;
        this.#editing = node;
        this.#dirty = false;
        const actions = this.$('.actions');
        actions?.insertAdjacentHTML('afterbegin', String(html`<jg-button size="sm" id="save" disabled>${t('file-manager.save', 'Save')}</jg-button>`));
        this.on(this.$('#save'), 'click', () => this.#save());
        this.on(editor, 'input', () => {
          this.#dirty = editor.value !== text;
          this.$('#save')?.toggleAttribute('disabled', !this.#dirty);
        });
        this.on(editor, 'keydown', (event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 's') {
            event.preventDefault();
            this.#save();
          }
        });
      }
    }
  }

  async #save() {
    const node = this.#editing;
    const editor = this.$('#editor');
    if (!node || !editor) return;
    try {
      await node.write(editor.value);
      await node.file();
      this.#dirty = false;
      this.$('#save')?.setAttribute('disabled', '');
      toast(t('file-manager.savedName', 'Saved {name}', { name: node.name }), 'success');
      const row = this.#visible.indexOf(node);
      const size = this.$(`.tr[data-index="${row}"] .size`);
      if (size) size.textContent = formatBytes(node.size ?? 0);
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  // ---- changes ---------------------------------------------------------

  async #create(kind) {
    const folder = this.#folder;
    if (!folder?.writable) return;
    const taken = this.#nodes.map((node) => node.name);
    try {
      const name = kind === 'directory'
        ? freeName(t('file-manager.untitledFolder', 'untitled folder'), taken)
        : freeName(t('file-manager.untitledTxt', 'untitled.txt'), taken);
      const created = kind === 'directory' ? await folder.createFolder(name) : await folder.createFile(name, '');
      this.#listings.delete(folder);
      await this.#reload();
      const fresh = this.#nodes.find((node) => node.name === created.name);
      if (fresh) {
        this.#selected = new Set([fresh]);
        this.#paintSelection();
        this.#startRename(fresh);
      }
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  #startRename(node) {
    if (!this.#folder?.writable) return;
    const index = this.#visible.indexOf(node);
    const label = this.$(`[data-index="${index}"] .label, [data-index="${index}"] .tile-name`);
    if (!label) return;
    const input = document.createElement('input');
    input.className = 'rename';
    input.value = node.name;
    label.replaceWith(input);
    input.focus();
    const dot = node.kind === 'file' ? node.name.lastIndexOf('.') : -1;
    input.setSelectionRange(0, dot > 0 ? dot : node.name.length);
    let done = false;
    const finish = async (commit) => {
      if (done) return;
      done = true;
      const name = input.value.trim();
      if (!commit || name === node.name) {
        input.replaceWith(label);
        this.$('#listing').focus();
        return;
      }
      const problem = nameProblem(name);
      const clash = this.#nodes.some((other) => other !== node && other.name.toLowerCase() === name.toLowerCase());
      if (problem || clash) {
        toast(clash ? t('file-manager.theNameIsTaken', 'The name “{name}” is already taken', { name }) : problem, 'error');
        input.replaceWith(label);
        return;
      }
      try {
        await this.#folder.rename(node, name);
        this.#listings.delete(this.#folder);
        await this.#reload();
        const renamed = this.#nodes.find((item) => item.name === name);
        if (renamed) {
          this.#selected = new Set([renamed]);
          this.#paintSelection();
        }
      } catch (error) {
        toast(error.message, 'error');
        input.replaceWith(label);
      }
      this.$('#listing').focus();
    };
    input.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Enter') finish(true);
      if (event.key === 'Escape') finish(false);
    });
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('click', (event) => event.stopPropagation());
    input.addEventListener('dblclick', (event) => event.stopPropagation());
  }

  async #remove(nodes) {
    const folder = this.#folder;
    if (!folder?.writable || !nodes.length) return;
    const ok = await confirm({
      title: nodes.length === 1
        ? t('file-manager.deleteName', 'Delete “{name}”?', { name: nodes[0].name })
        : t('file-manager.deleteItems', 'Delete {count} items?', { count: nodes.length }),
      message: t('file-manager.thisCannotBeUndone', 'They are removed from your computer straight away, not moved to the trash. This cannot be undone.'),
      confirmLabel: t('file-manager.moveToDelete', 'Delete'),
      danger: true,
    });
    if (!ok) return;
    if (nodes.includes(this.#editing)) {
      this.#editing = null;
      this.#dirty = false;
    }
    for (const node of nodes) {
      try {
        await folder.remove(node.name);
      } catch (error) {
        toast(`${node.name}: ${error.message}`, 'error');
      }
    }
    this.#selected.clear();
    this.#listings.delete(folder);
    await this.#reload();
  }

  async #download(nodes) {
    for (const node of nodes.filter((item) => item.kind === 'file')) {
      try {
        download(node.name, await node.file());
      } catch (error) {
        toast(error.message, 'error');
      }
    }
    if (nodes.some((item) => item.kind === 'directory')) toast(t('file-manager.foldersAreNotDownloaded', 'Folders are skipped; download the files inside them'));
  }

  async #copyFiles(files, target = this.#folder) {
    if (!target?.writable || !files.length) return;
    let copied = 0;
    for (const file of files) {
      try {
        const names = (await target.list()).map((node) => node.name);
        await target.createFile(freeName(file.name, names), file);
        copied += 1;
      } catch (error) {
        toast(`${file.name}: ${error.message}`, 'error');
      }
    }
    if (copied) toast(t('file-manager.copiedFiles', 'Copied {count} files', { count: copied }), 'success');
    if (target === this.#folder) await this.#reload();
  }

  async #copyHandle(handle, target) {
    if (handle.kind === 'file') {
      const names = (await target.list()).map((node) => node.name);
      await target.createFile(freeName(handle.name, names), await handle.getFile());
      return 1;
    }
    const names = (await target.list()).map((node) => node.name);
    const folder = await target.createFolder(freeName(handle.name, names));
    let count = 0;
    for await (const child of handle.values()) count += await this.#copyHandle(child, folder);
    return count;
  }

  #dropZone() {
    const main = this.$('#main');
    const veil = this.$('#veil');
    let depth = 0;
    const accepts = (event) => this.#folder?.writable && [...(event.dataTransfer?.types ?? [])].includes('Files');
    this.on(main, 'dragenter', (event) => {
      if (!accepts(event)) return;
      event.preventDefault();
      depth += 1;
      veil.classList.add('on');
    });
    this.on(main, 'dragover', (event) => {
      if (!accepts(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    });
    this.on(main, 'dragleave', () => {
      depth = Math.max(0, depth - 1);
      if (!depth) veil.classList.remove('on');
    });
    this.on(main, 'drop', async (event) => {
      if (!accepts(event)) return;
      event.preventDefault();
      depth = 0;
      veil.classList.remove('on');
      const items = [...event.dataTransfer.items].filter((item) => item.kind === 'file');
      const target = this.#folder;
      if (items.length && typeof items[0].getAsFileSystemHandle === 'function') {
        const handles = (await Promise.all(items.map((item) => item.getAsFileSystemHandle().catch(() => null)))).filter(Boolean);
        let copied = 0;
        for (const handle of handles) {
          try {
            copied += await this.#copyHandle(handle, target);
          } catch (error) {
            toast(`${handle.name}: ${error.message}`, 'error');
          }
        }
        if (copied) toast(t('file-manager.copiedFiles', 'Copied {count} files', { count: copied }), 'success');
        this.#listings.delete(target);
        if (target === this.#folder) await this.#reload();
        return;
      }
      await this.#copyFiles([...event.dataTransfer.files], target);
    });
  }
}

define('jg-app-file-manager', FileManager);
