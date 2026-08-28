import { JGApp, define, html, raw, styleSheet } from '../../core/app.js';
import { appText } from '../../core/i18n.js';
import strings from './i18n.js';
import { icon } from '../../ui/icons.js';
import { toast, download, debounce } from '../../core/util.js';
import { htmlToBlocks, blocksToHtml, blocksToText, blocksToMarkdown, outlineOf, countWords } from '../../lib/richtext.js';
import { layoutDocument, layoutToPdf } from '../../lib/doc-layout.js';
import { writeDocx } from '../../lib/docx.js';

const t = appText(strings);
const sheet = await styleSheet(import.meta.url);

const STYLES = [
  { value: 'p', label: () => t('doc-editor.body', 'Body text'), tag: 'p' },
  { value: 'h1', label: () => t('doc-editor.title', 'Title'), tag: 'h1' },
  { value: 'h2', label: () => t('doc-editor.heading1', 'Heading 1'), tag: 'h2' },
  { value: 'h3', label: () => t('doc-editor.heading2', 'Heading 2'), tag: 'h3' },
  { value: 'h4', label: () => t('doc-editor.heading3', 'Heading 3'), tag: 'h4' },
  { value: 'blockquote', label: () => t('doc-editor.quote', 'Quote'), tag: 'blockquote' },
  { value: 'pre', label: () => t('doc-editor.codeBlock', 'Code'), tag: 'pre' },
];

const FAMILIES = [
  { value: 'Helvetica Neue, Arial, sans-serif', label: 'Helvetica' },
  { value: 'Georgia, Times New Roman, serif', label: 'Times' },
  { value: 'Menlo, Consolas, monospace', label: 'Courier' },
];

const SIZES = [9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48];

const SWATCHES = ['#111111', '#5b6671', '#c02a2a', '#c2691b', '#1d7a45', '#1a5fb4', '#6c3fa8', '#a01f6f'];
const MARKERS = ['#fff3a3', '#c8f2d0', '#cfe4ff', '#ffd6d6', '#e8dcff', 'transparent'];

const CSS_FAMILY = {
  helvetica: 'Helvetica Neue, Arial, sans-serif',
  times: 'Georgia, Times New Roman, serif',
  courier: 'Menlo, Consolas, monospace',
};

const familyFor = (font) => {
  const base = String(font).replace(/(Bold|Italic|BoldItalic)$/, '');
  return CSS_FAMILY[base] ?? CSS_FAMILY.helvetica;
};

const STARTER = `<h1>Untitled document</h1>
<p>Start typing, or paste something in. Everything stays on this device.</p>
<p>Use the toolbar above, or the shortcuts: <b>Ctrl B</b> for bold, <b>Ctrl I</b> for italic, <b>Ctrl K</b> for a link, and <b>Ctrl Shift 8</b> for a list.</p>`;

class DocEditor extends JGApp {
  static appId = 'doc-editor';
  static settings = [
    { key: 'paper', label: t('doc-editor.paperSize', 'Paper size'), type: 'select', default: 'a4',
      options: [{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'Letter' }, { value: 'legal', label: 'Legal' }, { value: 'a5', label: 'A5' }] },
    { key: 'margin', label: t('doc-editor.margin', 'Margin in points'), type: 'select', default: '72',
      options: [{ value: '36', label: '36' }, { value: '54', label: '54' }, { value: '72', label: '72' }, { value: '96', label: '96' }] },
    { key: 'bodyFont', label: t('doc-editor.exportFont', 'Font used when exporting'), type: 'select', default: 'helvetica',
      options: [{ value: 'helvetica', label: 'Helvetica' }, { value: 'times', label: 'Times' }] },
  ];
  static styles = [...JGApp.styles, sheet];

  #blocks = [];
  #layout = null;
  #side = 'pages';
  #view = 'write';
  #name = 'Untitled document';

  renderApp() {
    this.paint(html`<div class="app">
      <div class="bar">
        <jg-input id="name" size="sm" value="${this.#name}" aria-label="${t('doc-editor.documentName', 'Document name')}"></jg-input>
        <div class="spring"></div>
        <jg-segment id="view"></jg-segment>
        <jg-button size="sm" variant="outline" id="export">${icon('download', 14)}${t('doc-editor.export', 'Export')}</jg-button>
      </div>

      <div class="tools" id="tools">
        <div class="cluster">
          <button class="tool" data-act="undo" title="${t('doc-editor.undo', 'Undo')} (Ctrl Z)">${icon('undo', 15)}</button>
          <button class="tool" data-act="redo" title="${t('doc-editor.redo', 'Redo')} (Ctrl Shift Z)">${icon('redo', 15)}</button>
        </div>
        <div class="cluster">
          <jg-select id="style" size="sm" value="p">${STYLES.map((entry) => html`<option value="${entry.value}">${entry.label()}</option>`)}</jg-select>
          <jg-select id="family" size="sm" value="Helvetica Neue, Arial, sans-serif">${FAMILIES.map((entry) => html`<option value="${entry.value}">${entry.label}</option>`)}</jg-select>
          <jg-select id="size" size="sm" value="11">${SIZES.map((value) => html`<option value="${value}">${value}</option>`)}</jg-select>
        </div>
        <div class="cluster">
          <button class="tool" data-act="bold" title="${t('doc-editor.bold', 'Bold')} (Ctrl B)">${icon('bold', 15)}</button>
          <button class="tool" data-act="italic" title="${t('doc-editor.italic', 'Italic')} (Ctrl I)">${icon('italic', 15)}</button>
          <button class="tool" data-act="underline" title="${t('doc-editor.underline', 'Underline')} (Ctrl U)">${icon('underline', 15)}</button>
          <button class="tool" data-act="strikeThrough" title="${t('doc-editor.strikethrough', 'Strikethrough')}">${icon('strikethrough', 15)}</button>
          <div class="pop">
            <button class="tool" data-pop="ink" title="${t('doc-editor.textColour', 'Text colour')}">${icon('palette', 15)}</button>
            <div class="sheet" data-for="ink">${SWATCHES.map((colour) => html`<button class="chip" data-ink="${colour}" style="background:${colour}" title="${colour}"></button>`)}</div>
          </div>
          <div class="pop">
            <button class="tool" data-pop="mark" title="${t('doc-editor.highlight', 'Highlight')}">${icon('highlight', 15)}</button>
            <div class="sheet" data-for="mark">${MARKERS.map((colour) => html`<button class="chip" data-mark="${colour}" style="background:${colour === 'transparent' ? 'var(--card)' : colour}" title="${colour}"></button>`)}</div>
          </div>
          <button class="tool" data-act="removeFormat" title="${t('doc-editor.clearFormatting', 'Clear formatting')} (Ctrl \\)">${icon('eraser', 15)}</button>
        </div>
        <div class="cluster">
          <button class="tool" data-act="justifyLeft" title="${t('doc-editor.alignLeft', 'Align left')}">${icon('alignLeft', 15)}</button>
          <button class="tool" data-act="justifyCenter" title="${t('doc-editor.centre', 'Centre')}">${icon('alignCenter', 15)}</button>
          <button class="tool" data-act="justifyRight" title="${t('doc-editor.alignRight', 'Align right')}">${icon('alignRight', 15)}</button>
          <button class="tool" data-act="justifyFull" title="${t('doc-editor.justify', 'Justify')}">${icon('alignJustify', 15)}</button>
        </div>
        <div class="cluster">
          <button class="tool" data-act="insertUnorderedList" title="${t('doc-editor.bulletList', 'Bulleted list')} (Ctrl Shift 8)">${icon('list', 15)}</button>
          <button class="tool" data-act="insertOrderedList" title="${t('doc-editor.numberedList', 'Numbered list')} (Ctrl Shift 7)">${icon('listOrdered', 15)}</button>
          <button class="tool" data-act="outdent" title="${t('doc-editor.decreaseIndent', 'Decrease indent')}">${icon('outdent', 15)}</button>
          <button class="tool" data-act="indent" title="${t('doc-editor.increaseIndent', 'Increase indent')}">${icon('indent', 15)}</button>
        </div>
        <div class="cluster">
          <button class="tool" data-act="link" title="${t('doc-editor.insertLink', 'Insert link')} (Ctrl K)">${icon('link', 15)}</button>
          <button class="tool" data-act="image" title="${t('doc-editor.insertPicture', 'Insert picture')}">${icon('image', 15)}</button>
          <button class="tool" data-act="table" title="${t('doc-editor.insertTable', 'Insert table')}">${icon('table', 15)}</button>
          <button class="tool" data-act="rule" title="${t('doc-editor.insertRule', 'Insert a line')}">${icon('minus', 15)}</button>
        </div>
        <div class="spring"></div>
        <div class="cluster">
          <button class="tool" data-act="find" title="${t('doc-editor.findAndReplace', 'Find and replace')} (Ctrl F)">${icon('search', 15)}</button>
          <button class="tool" data-act="side" title="${t('doc-editor.togglePanel', 'Show or hide the panel')}">${icon('sidebar', 15)}</button>
        </div>
      </div>

      <div class="find" id="find" hidden>
        <jg-input id="needle" size="sm" placeholder="${t('doc-editor.find', 'Find')}"></jg-input>
        <jg-input id="swap" size="sm" placeholder="${t('doc-editor.replaceWith', 'Replace with')}"></jg-input>
        <jg-button size="sm" variant="outline" id="replace-one">${t('doc-editor.replace', 'Replace')}</jg-button>
        <jg-button size="sm" variant="outline" id="replace-all">${t('doc-editor.replaceAll', 'Replace all')}</jg-button>
        <span class="hits" id="hits"></span>
        <button class="tool" id="close-find">${icon('close', 14)}</button>
      </div>

      <div class="body">
        <aside class="panel" id="panel">
          <div class="tabs">
            <button class="tab" data-side="pages" aria-pressed="true">${t('doc-editor.pages', 'Pages')}</button>
            <button class="tab" data-side="outline" aria-pressed="false">${t('doc-editor.outline', 'Outline')}</button>
          </div>
          <div class="thumbs" id="thumbs"></div>
          <div class="outline" id="outline" hidden></div>
        </aside>

        <div class="stage" id="stage">
          <div class="sheetwrap" id="sheetwrap">
            <div class="page" id="editor" contenteditable="true" spellcheck="true" role="textbox" aria-multiline="true"></div>
          </div>
          <div class="preview" id="preview" hidden></div>
        </div>
      </div>

      <div class="status">
        <span id="counts"></span>
        <div class="spring"></div>
        <span id="pages"></span>
      </div>

      <input type="file" id="picture" accept="image/*" hidden />
    </div>`);

    const editor = this.$('#editor');
    editor.innerHTML = STARTER;

    this.$('#view').items = [
      { value: 'write', label: t('doc-editor.write', 'Write') },
      { value: 'pages', label: t('doc-editor.pageView', 'Page view') },
    ];
    this.$('#view').value = this.#view;

    this.#wire();
    this.#sync();
  }

  #wire() {
    const editor = this.$('#editor');
    const settle = debounce(() => this.#sync(), 260);

    this.on(editor, 'input', settle);
    this.on(editor, 'keyup', () => this.#reflect());
    this.on(editor, 'mouseup', () => this.#reflect());
    this.on(editor, 'paste', (event) => {
      const text = event.clipboardData?.getData('text/plain');
      if (event.clipboardData?.types?.includes('text/html')) return;
      if (text === undefined) return;
      event.preventDefault();
      document.execCommand('insertText', false, text);
    });

    this.on(this.$('#tools'), 'click', (event) => {
      const pop = event.target.closest('[data-pop]');
      if (pop) {
        const open = pop.parentElement.classList.toggle('open');
        this.$$('.pop').forEach((node) => {
          if (node !== pop.parentElement) node.classList.remove('open');
        });
        if (open) event.stopPropagation();
        return;
      }
      const ink = event.target.closest('[data-ink]');
      if (ink) {
        this.#run('foreColor', ink.dataset.ink);
        ink.closest('.pop').classList.remove('open');
        return;
      }
      const mark = event.target.closest('[data-mark]');
      if (mark) {
        this.#run('hiliteColor', mark.dataset.mark === 'transparent' ? 'rgba(0,0,0,0)' : mark.dataset.mark);
        mark.closest('.pop').classList.remove('open');
        return;
      }
      const button = event.target.closest('[data-act]');
      if (button) this.#act(button.dataset.act);
    });

    this.listen(document, 'click', () => this.$$('.pop').forEach((node) => node.classList.remove('open')));

    this.on(this.$('#style'), 'change', (event) => {
      const entry = STYLES.find((item) => item.value === event.detail.value);
      this.#run('formatBlock', `<${entry?.tag ?? 'p'}>`);
    });
    this.on(this.$('#family'), 'change', (event) => this.#wrapStyle('fontFamily', event.detail.value));
    this.on(this.$('#size'), 'change', (event) => this.#wrapStyle('fontSize', `${event.detail.value}px`));

    this.on(this.$('#view'), 'change', (event) => {
      this.#view = event.detail.value;
      this.#showView();
    });
    this.on(this.$('#export'), 'click', () => this.#exportMenu());
    this.on(this.$('#name'), 'change', (event) => {
      this.#name = event.detail.value.trim() || 'Untitled document';
    });

    this.on(this.$('.tabs'), 'click', (event) => {
      const tab = event.target.closest('[data-side]');
      if (!tab) return;
      this.#side = tab.dataset.side;
      this.$$('.tab').forEach((node) => node.setAttribute('aria-pressed', String(node.dataset.side === this.#side)));
      this.$('#thumbs').hidden = this.#side !== 'pages';
      this.$('#outline').hidden = this.#side !== 'outline';
    });

    this.on(this.$('#outline'), 'click', (event) => {
      const entry = event.target.closest('[data-index]');
      if (!entry) return;
      const node = this.$('#editor').children[Number(entry.dataset.index)];
      node?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    this.on(this.$('#thumbs'), 'click', (event) => {
      const card = event.target.closest('[data-page]');
      if (!card) return;
      const which = Number(card.dataset.page);
      if (this.#view === 'pages') {
        this.$$('#preview canvas')[which]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      const stage = this.$('#stage');
      const share = this.#layout ? which / this.#layout.pages.length : 0;
      stage.scrollTo({ top: share * stage.scrollHeight, behavior: 'smooth' });
    });

    this.on(this.$('#picture'), 'change', async (event) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      const data = await new Promise((done) => {
        const reader = new FileReader();
        reader.onload = () => done(reader.result);
        reader.readAsDataURL(file);
      });
      this.#run('insertHTML', `<figure><img src="${data}" alt=""></figure><p><br></p>`);
    });

    this.on(this.$('#close-find'), 'click', () => this.#toggleFind(false));
    this.on(this.$('#needle'), 'input', () => this.#countHits());
    this.on(this.$('#replace-one'), 'click', () => this.#replace(false));
    this.on(this.$('#replace-all'), 'click', () => this.#replace(true));

    this.hotkeys((event) => {
      const meta = event.metaKey || event.ctrlKey;
      if (!meta) {
        if (event.key === 'Tab' && this.#inList()) {
          event.preventDefault();
          this.#act(event.shiftKey ? 'outdent' : 'indent');
        }
        return;
      }
      const key = event.key.toLowerCase();
      const map = { b: 'bold', i: 'italic', u: 'underline' };
      if (map[key] && !event.shiftKey) {
        event.preventDefault();
        this.#act(map[key]);
        return;
      }
      if (key === 'k') {
        event.preventDefault();
        this.#act('link');
        return;
      }
      if (key === 'f') {
        event.preventDefault();
        this.#toggleFind(true);
        return;
      }
      if (key === 's') {
        event.preventDefault();
        this.#savePdf();
        return;
      }
      if (key === '\\') {
        event.preventDefault();
        this.#act('removeFormat');
        return;
      }
      if (event.shiftKey && key === 'x') {
        event.preventDefault();
        this.#act('strikeThrough');
        return;
      }
      if (event.shiftKey && (key === '7' || key === '&')) {
        event.preventDefault();
        this.#act('insertOrderedList');
        return;
      }
      if (event.shiftKey && (key === '8' || key === '*')) {
        event.preventDefault();
        this.#act('insertUnorderedList');
        return;
      }
      if (event.altKey && '0123456'.includes(key)) {
        event.preventDefault();
        const tag = key === '0' ? 'p' : `h${Math.min(6, Number(key) + 1)}`;
        this.#run('formatBlock', `<${tag}>`);
      }
    });
  }

  #inList() {
    const node = this.getSelection?.() ?? window.getSelection();
    const anchor = node?.anchorNode;
    return Boolean(anchor && (anchor.parentElement?.closest('li') || anchor.nodeName === 'LI'));
  }

  #focus() {
    const editor = this.$('#editor');
    if (!this.shadowRoot.activeElement) editor.focus();
    return editor;
  }

  #run(command, value) {
    this.#focus();
    document.execCommand('styleWithCSS', false, command === 'foreColor' || command === 'hiliteColor');
    document.execCommand(command, false, value);
    this.#sync();
    this.#reflect();
  }

  #wrapStyle(property, value) {
    this.#focus();
    const selection = this.shadowRoot.getSelection?.() ?? window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const range = selection.getRangeAt(0);
    const span = document.createElement('span');
    span.style[property] = value;
    try {
      span.appendChild(range.extractContents());
      range.insertNode(span);
      selection.removeAllRanges();
      const next = document.createRange();
      next.selectNodeContents(span);
      selection.addRange(next);
    } catch {
      document.execCommand('insertHTML', false, span.outerHTML);
    }
    this.#sync();
  }

  #act(action) {
    if (action === 'undo' || action === 'redo') return this.#run(action);
    if (action === 'link') {
      const url = prompt(t('doc-editor.linkAddress', 'Link address'), 'https://');
      if (url) this.#run('createLink', url);
      return;
    }
    if (action === 'image') return this.$('#picture').click();
    if (action === 'rule') return this.#run('insertHTML', '<hr><p><br></p>');
    if (action === 'table') {
      const head = '<tr><th>A</th><th>B</th><th>C</th></tr>';
      const row = '<tr><td><br></td><td><br></td><td><br></td></tr>';
      return this.#run('insertHTML', `<table>${head}${row}${row}</table><p><br></p>`);
    }
    if (action === 'find') return this.#toggleFind(true);
    if (action === 'side') {
      this.$('#panel').classList.toggle('away');
      return;
    }
    this.#run(action);
  }

  #reflect() {
    const state = (command) => {
      try {
        return document.queryCommandState(command);
      } catch {
        return false;
      }
    };
    for (const button of this.$$('.tool[data-act]')) {
      const act = button.dataset.act;
      if (['bold', 'italic', 'underline', 'strikeThrough', 'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull', 'insertUnorderedList', 'insertOrderedList'].includes(act)) {
        button.setAttribute('aria-pressed', String(state(act)));
      }
    }
  }

  #toggleFind(show) {
    const bar = this.$('#find');
    bar.hidden = !show;
    if (show) this.$('#needle').select?.();
    else this.#focus();
  }

  #countHits() {
    const needle = this.$('#needle').value;
    const hits = this.$('#hits');
    if (!needle) {
      hits.textContent = '';
      return;
    }
    const text = this.$('#editor').textContent ?? '';
    const count = needle ? text.split(needle).length - 1 : 0;
    hits.textContent = t('doc-editor.matches', '{count} found', { count });
  }

  #replace(all) {
    const needle = this.$('#needle').value;
    const swap = this.$('#swap').value ?? '';
    if (!needle) return;
    const editor = this.$('#editor');
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let changed = 0;
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (!node.nodeValue.includes(needle)) continue;
      node.nodeValue = all ? node.nodeValue.split(needle).join(swap) : node.nodeValue.replace(needle, swap);
      changed += 1;
      if (!all) break;
    }
    if (changed) {
      this.#sync();
      this.#countHits();
      toast(t('doc-editor.replaced', 'Replaced {count}', { count: changed }));
    }
  }

  #paper() {
    return {
      size: this.config.get('paper', 'a4'),
      margin: Number(this.config.get('margin', '72')),
      font: this.config.get('bodyFont', 'helvetica'),
    };
  }

  #sync() {
    this.#blocks = htmlToBlocks(this.$('#editor'));
    this.#layout = layoutDocument(this.#blocks, this.#paper());
    this.#drawThumbs();
    this.#drawOutline();
    const counts = countWords(this.#blocks);
    this.$('#counts').textContent = t('doc-editor.counts', '{words} words · {characters} characters', counts);
    this.$('#pages').textContent = t('doc-editor.pageCount', '{count} pages', { count: this.#layout.pages.length });
    if (this.#view === 'pages') this.#drawPreview();
  }

  #paint(canvas, page, scale) {
    const context = canvas.getContext('2d');
    const style = getComputedStyle(this);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const ratio = canvas.width / this.#layout.width;
    context.scale(ratio, ratio);

    for (const item of page.items) {
      if (item.type === 'rule') {
        context.strokeStyle = '#c8cdd2';
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(item.x, item.y);
        context.lineTo(item.x + item.width, item.y);
        context.stroke();
        continue;
      }
      if (item.type === 'row') {
        context.strokeStyle = '#d0d5da';
        context.lineWidth = 0.6;
        context.strokeRect(item.x, item.y, item.width, item.height);
        continue;
      }
      if (item.type === 'image') {
        context.fillStyle = '#e9edf2';
        context.fillRect(item.x, item.y, item.width, item.height);
        continue;
      }
      if (item.type !== 'text') continue;
      const bold = /Bold/.test(item.font);
      const italic = /Italic/.test(item.font);
      if (item.highlight) {
        context.fillStyle = item.highlight;
        context.fillRect(item.x, item.y - item.size, context.measureText(item.text).width || item.size * item.text.length * 0.5, item.size * 1.2);
      }
      context.fillStyle = item.link ? '#1a5fb4' : item.color ?? '#111111';
      context.font = `${italic ? 'italic ' : ''}${bold ? '700 ' : ''}${item.size}px ${familyFor(item.font)}`;
      context.fillText(item.text, item.x, item.y);
    }
    void style;
    void scale;
  }

  #drawThumbs() {
    const host = this.$('#thumbs');
    if (!host || !this.#layout) return;
    const width = 132;
    const height = Math.round((this.#layout.height / this.#layout.width) * width);

    while (host.children.length > this.#layout.pages.length) host.lastElementChild.remove();
    while (host.children.length < this.#layout.pages.length) {
      const card = document.createElement('button');
      card.className = 'thumb';
      card.innerHTML = '<canvas></canvas><span></span>';
      host.append(card);
    }

    this.#layout.pages.forEach((page, index) => {
      const card = host.children[index];
      card.dataset.page = String(index);
      const canvas = card.querySelector('canvas');
      const ratio = window.devicePixelRatio || 1;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      this.#paint(canvas, page, ratio);
      card.querySelector('span').textContent = String(index + 1);
    });
  }

  #drawOutline() {
    const host = this.$('#outline');
    if (!host) return;
    const entries = outlineOf(this.#blocks);
    host.innerHTML = entries.length
      ? html`${entries.map((entry) => html`<button class="line" data-index="${entry.index}" style="padding-left:${8 + (entry.level - 1) * 12}px">${entry.text}</button>`)}`
      : html`<div class="hint">${t('doc-editor.noHeadings', 'Headings you add will appear here.')}</div>`;
  }

  #showView() {
    const write = this.#view === 'write';
    this.$('#sheetwrap').hidden = !write;
    this.$('#preview').hidden = write;
    if (!write) this.#drawPreview();
  }

  #drawPreview() {
    const host = this.$('#preview');
    if (!host || !this.#layout) return;
    host.innerHTML = '';
    const width = 760;
    const height = Math.round((this.#layout.height / this.#layout.width) * width);
    for (const page of this.#layout.pages) {
      const canvas = document.createElement('canvas');
      const ratio = window.devicePixelRatio || 1;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      this.#paint(canvas, page, ratio);
      host.append(canvas);
    }
  }

  async #exportMenu() {
    const choice = prompt(
      t('doc-editor.exportPrompt', 'Type a format: pdf, docx, html, md or txt'),
      'pdf',
    );
    if (!choice) return;
    const kind = choice.trim().toLowerCase();
    if (kind === 'pdf') return this.#savePdf();
    if (kind === 'docx' || kind === 'word') return this.#saveDocx();
    if (kind === 'html') {
      download(`${this.#name}.html`, `<!doctype html><meta charset="utf-8"><title>${this.#name}</title>\n${blocksToHtml(this.#blocks)}\n`, 'text/html');
      return;
    }
    if (kind === 'md' || kind === 'markdown') {
      download(`${this.#name}.md`, blocksToMarkdown(this.#blocks), 'text/markdown');
      return;
    }
    if (kind === 'txt' || kind === 'text') {
      download(`${this.#name}.txt`, blocksToText(this.#blocks), 'text/plain');
      return;
    }
    toast(t('doc-editor.unknownFormat', 'That format is not one of pdf, docx, html, md or txt'), 'danger');
  }

  #savePdf() {
    const paper = this.#paper();
    const layout = layoutDocument(this.#blocks, paper);
    const bytes = layoutToPdf(layout, { ...paper, title: this.#name, creator: 'Toolbox' });
    download(`${this.#name}.pdf`, bytes, 'application/pdf');
    toast(t('doc-editor.savedPdf', 'Saved as PDF'));
  }

  async #saveDocx() {
    const paper = this.#paper();
    const bytes = await writeDocx(this.#blocks, {
      title: this.#name,
      width: this.#layout.width,
      height: this.#layout.height,
      margin: paper.margin,
    });
    download(`${this.#name}.docx`, bytes, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    toast(t('doc-editor.savedWord', 'Saved as Word'));
  }

  renderWidget() {
    this.paint(html`<div class="app" style="padding:12px">
      <div class="stack tight">
        <div class="label">${t('doc-editor.documents', 'Documents')}</div>
        <div class="hint">${t('doc-editor.widgetBlurb', 'Write and export documents as PDF or Word.')}</div>
      </div>
    </div>`);
  }
}

define('jg-app-doc-editor', DocEditor);
