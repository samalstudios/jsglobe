import { JGApp, define, html, raw, styleSheet } from '../../core/app.js';
import { appText } from '../../core/i18n.js';
import strings from './i18n.js';
import { icon } from '../../ui/icons.js';
import { toast, download, debounce, pickFile } from '../../core/util.js';
import { createDesigns } from '../../lib/designs.js';
import { toJpeg } from '../../lib/raster.js';
import { readZip } from '../../core/zip.js';
import { htmlToBlocks, blocksToHtml, blocksToText, blocksToMarkdown, markdownToHtml, outlineOf, countWords } from '../../lib/richtext.js';
import { layoutDocument, layoutToPdf } from '../../lib/doc-layout.js';
import { writeDocx, docxToHtml } from '../../lib/docx.js';

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
  { value: 'Helvetica Neue, Helvetica, Arial, sans-serif', label: 'Helvetica' },
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  { value: 'Verdana, Geneva, sans-serif', label: 'Verdana' },
  { value: 'Tahoma, Geneva, sans-serif', label: 'Tahoma' },
  { value: 'Trebuchet MS, Helvetica, sans-serif', label: 'Trebuchet' },
  { value: 'Calibri, Candara, Segoe UI, sans-serif', label: 'Calibri' },
  { value: 'Times New Roman, Times, serif', label: 'Times New Roman' },
  { value: 'Georgia, Times New Roman, serif', label: 'Georgia' },
  { value: 'Garamond, Baskerville, serif', label: 'Garamond' },
  { value: 'Palatino, Palatino Linotype, Book Antiqua, serif', label: 'Palatino' },
  { value: 'Cambria, Georgia, serif', label: 'Cambria' },
  { value: 'Courier New, Courier, monospace', label: 'Courier New' },
  { value: 'Menlo, Consolas, monospace', label: 'Consolas' },
];

const SIZES = [9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48];

const SWATCHES = ['#111111', '#5b6671', '#c02a2a', '#c2691b', '#1d7a45', '#1a5fb4', '#6c3fa8', '#a01f6f'];
const MARKERS = ['#fff3a3', '#c8f2d0', '#cfe4ff', '#ffd6d6', '#e8dcff', 'transparent'];

const CSS_FAMILY = {
  helvetica: 'Helvetica Neue, Arial, sans-serif',
  times: 'Georgia, Times New Roman, serif',
  courier: 'Menlo, Consolas, monospace',
};

const EXPORT_NOTE = () => t('doc-editor.fontNote', 'Word keeps the font you pick. PDF uses the nearest of Helvetica, Times or Courier, which is what a PDF carries without embedding.');

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
  #zoom = 1;
  #files = createDesigns(this.store, 'documents');
  #hits = [];
  #hit = -1;
  #fade = null;
  #range = null;

  renderApp() {
    this.paint(html`<div class="app">
      <div class="bar">
        <jg-input id="name" size="sm" value="${this.#name}" aria-label="${t('doc-editor.documentName', 'Document name')}"></jg-input>
        <span class="saved" id="saved"></span>
        <div class="spring"></div>
        <jg-segment id="view"></jg-segment>
        <jg-button size="sm" variant="ghost" id="library">${icon('folder', 14)}${t('doc-editor.documents', 'Documents')}</jg-button>
        <jg-button size="sm" variant="outline" id="open">${icon('upload', 14)}${t('doc-editor.open', 'Open')}</jg-button>
        <jg-button size="sm" id="export">${icon('download', 14)}${t('doc-editor.export', 'Export')}</jg-button>
      </div>

      <div class="tools" id="tools">
        <div class="cluster">
          <button class="tool" data-act="undo" title="${t('doc-editor.undo', 'Undo')} (Ctrl Z)">${icon('undo', 15)}</button>
          <button class="tool" data-act="redo" title="${t('doc-editor.redo', 'Redo')} (Ctrl Shift Z)">${icon('redo', 15)}</button>
        </div>
        <div class="cluster">
          <jg-select id="style" size="sm" value="p">${STYLES.map((entry) => html`<option value="${entry.value}">${entry.label()}</option>`)}</jg-select>
          <jg-select id="family" size="sm" value="Helvetica Neue, Helvetica, Arial, sans-serif" title="${EXPORT_NOTE()}">${FAMILIES.map((entry) => html`<option value="${entry.value}">${entry.label}</option>`)}</jg-select>
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
          <button class="tool" data-act="superscript" title="${t('doc-editor.superscript', 'Superscript')}">${icon('chevronUp', 15)}</button>
          <button class="tool" data-act="subscript" title="${t('doc-editor.subscript', 'Subscript')}">${icon('chevronDown', 15)}</button>
          <button class="tool" data-act="case" title="${t('doc-editor.changeCase', 'Change the case')}">${icon('type', 15)}</button>
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
          <jg-select id="spacing" size="sm" value="1.6" title="${t('doc-editor.lineSpacing', 'Line spacing')}">
            <option value="1.15">1.15</option>
            <option value="1.4">1.4</option>
            <option value="1.6">1.6</option>
            <option value="2">2.0</option>
          </jg-select>
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
        <button class="tool" id="find-prev" title="${t('doc-editor.previous', 'Previous')}">${icon('chevronUp', 14)}</button>
        <button class="tool" id="find-next" title="${t('doc-editor.next', 'Next')}">${icon('chevronDown', 14)}</button>
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

      <jg-dialog id="library-box" title-text="${t('doc-editor.documents', 'Documents')}" sub="${t('doc-editor.everythingStaysHere', 'Everything is kept in this browser only.')}">
        <div class="row tight">
          <jg-button size="sm" id="new-doc">${t('doc-editor.newDocument', 'New document')}</jg-button>
          <jg-button size="sm" variant="outline" id="save-doc">${t('doc-editor.saveACopy', 'Save a copy')}</jg-button>
        </div>
        <div class="files" id="files"></div>
      </jg-dialog>

      <jg-dialog id="link-box" title-text="${t('doc-editor.insertLink', 'Insert link')}">
        <jg-field label="${t('doc-editor.linkAddress', 'Link address')}"><jg-input id="link-url" placeholder="https://" autofocus></jg-input></jg-field>
        <jg-field label="${t('doc-editor.linkText', 'Text to show')}" hint="${t('doc-editor.leaveEmptyToKeep', 'Leave empty to keep what is selected')}"><jg-input id="link-text"></jg-input></jg-field>
        <div class="row end">
          <jg-button size="sm" variant="outline" id="link-cancel">${t('doc-editor.cancel', 'Cancel')}</jg-button>
          <jg-button size="sm" id="link-apply">${t('doc-editor.insert', 'Insert')}</jg-button>
        </div>
      </jg-dialog>

      <jg-dialog id="export-box" title-text="${t('doc-editor.export', 'Export')}" sub="${t('doc-editor.chooseAFormat', 'Choose a format. The file is built on this device.')}">
        <div class="formats">
          <button class="format" data-kind="pdf"><b>PDF</b><span>${t('doc-editor.pdfHint', 'Laid out exactly as the page view shows')}</span></button>
          <button class="format" data-kind="docx"><b>Word</b><span>${t('doc-editor.docxHint', 'A .docx that Word and Pages both open')}</span></button>
          <button class="format" data-kind="html"><b>HTML</b><span>${t('doc-editor.htmlHint', 'A single page with the formatting kept')}</span></button>
          <button class="format" data-kind="md"><b>Markdown</b><span>${t('doc-editor.mdHint', 'Headings, lists, links and emphasis')}</span></button>
          <button class="format" data-kind="txt"><b>${t('doc-editor.plainText', 'Plain text')}</b><span>${t('doc-editor.txtHint', 'Just the words')}</span></button>
          <button class="format" data-kind="print"><b>${t('doc-editor.print', 'Print')}</b><span>${t('doc-editor.printHint', 'Send the pages to a printer')}</span></button>
        </div>
        <div class="row wrap">
          <jg-switch id="numbers"></jg-switch><span class="hint">${t('doc-editor.pageNumbers', 'Number the pages')}</span>
          <jg-input id="footer" size="sm" placeholder="${t('doc-editor.footerText', 'Footer text, optional')}"></jg-input>
        </div>
      </jg-dialog>
    </div>`);

    const editor = this.$('#editor');
    editor.innerHTML = STARTER;

    this.$('#view').items = [
      { value: 'write', label: t('doc-editor.write', 'Write') },
      { value: 'pages', label: t('doc-editor.pageView', 'Page view') },
    ];
    this.$('#view').value = this.#view;

    this.#wire();
    this.#restore();
    this.#sync();
  }

  #restore() {
    const saved = this.store.read();
    const open = saved?.current;
    if (open?.html) {
      this.$('#editor').innerHTML = open.html;
      this.#name = open.name ?? this.#name;
      this.$('#name').value = this.#name;
    }
  }

  #keep() {
    const state = this.store.read() ?? {};
    state.current = { name: this.#name, html: this.$('#editor').innerHTML, at: Date.now() };
    this.store.write(state);
    const stamp = this.$('#saved');
    if (stamp) {
      stamp.textContent = t('doc-editor.savedJustNow', 'Saved');
      stamp.classList.add('show');
      clearTimeout(this.#fade);
      this.#fade = setTimeout(() => stamp.classList.remove('show'), 1600);
    }
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
    this.on(this.$('#spacing'), 'change', (event) => {
      this.$('#editor').style.lineHeight = event.detail.value;
      this.#sync();
    });

    this.on(this.$('#view'), 'change', (event) => {
      this.#view = event.detail.value;
      this.#showView();
    });
    this.on(this.$('#export'), 'click', () => this.$('#export-box').open());
    this.on(this.$('#open'), 'click', () => this.#openFile());
    this.on(this.$('#library'), 'click', () => {
      this.#paintFiles();
      this.$('#library-box').open();
    });

    this.on(this.$('#export-box'), 'click', (event) => {
      const choice = event.target.closest('[data-kind]');
      if (choice) this.#exportAs(choice.dataset.kind);
    });

    this.on(this.$('#files'), 'click', (event) => {
      const open = event.target.closest('[data-open]');
      if (open) {
        const design = this.#files.get(open.dataset.open);
        if (!design) return;
        this.$('#editor').innerHTML = design.html ?? '';
        this.#name = open.dataset.open;
        this.$('#name').value = this.#name;
        this.$('#library-box').close();
        this.#sync();
        return;
      }
      const drop = event.target.closest('[data-drop]');
      if (drop) {
        this.#files.remove(drop.dataset.drop);
        this.#paintFiles();
      }
    });

    this.on(this.$('#new-doc'), 'click', () => {
      this.$('#editor').innerHTML = '<h1><br></h1><p><br></p>';
      this.#name = t('doc-editor.untitled', 'Untitled document');
      this.$('#name').value = this.#name;
      this.$('#library-box').close();
      this.#sync();
    });

    this.on(this.$('#save-doc'), 'click', () => {
      this.#files.save(this.#name, { html: this.$('#editor').innerHTML });
      this.#paintFiles();
      toast(t('doc-editor.copySaved', 'Saved a copy of {name}', { name: this.#name }));
    });

    this.on(this.$('#link-cancel'), 'click', () => this.$('#link-box').close());
    this.on(this.$('#link-apply'), 'click', () => this.#applyLink());
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
    this.on(this.$('#needle'), 'keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      this.#gotoHit(event.shiftKey ? -1 : 1);
    });
    this.on(this.$('#find-next'), 'click', () => this.#gotoHit(1));
    this.on(this.$('#find-prev'), 'click', () => this.#gotoHit(-1));
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
      if (key === 'z') {
        event.preventDefault();
        this.#act(event.shiftKey ? 'redo' : 'undo');
        return;
      }
      if (key === 'y') {
        event.preventDefault();
        this.#act('redo');
        return;
      }
      if (key === 'p') {
        event.preventDefault();
        this.#savePdf(true, false, '');
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
      const selection = (this.shadowRoot.getSelection?.() ?? window.getSelection())?.toString() ?? '';
      this.#range = this.#snapRange();
      this.$('#link-text').value = selection;
      this.$('#link-url').value = 'https://';
      this.$('#link-box').open();
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
    if (action === 'case') return this.#changeCase();
    if (action === 'side') {
      this.$('#panel').classList.toggle('away');
      return;
    }
    this.#run(action);
  }

  #changeCase() {
    const selection = this.shadowRoot.getSelection?.() ?? window.getSelection();
    const text = selection?.toString() ?? '';
    if (!text.trim()) {
      toast(t('doc-editor.selectSomeText', 'Select some text first'), 'danger');
      return;
    }
    const upper = text.toUpperCase();
    const lower = text.toLowerCase();
    const title = lower.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
    const next = text === lower ? title : text === title ? upper : lower;
    this.#run('insertText', next);
  }

  #snapRange() {
    const selection = this.shadowRoot.getSelection?.() ?? window.getSelection();
    return selection && selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
  }

  #applyLink() {
    const url = this.$('#link-url').value.trim();
    if (!url) return;
    const label = this.$('#link-text').value.trim();
    this.$('#link-box').close();
    this.#focus();
    if (this.#range) {
      const selection = this.shadowRoot.getSelection?.() ?? window.getSelection();
      selection.removeAllRanges();
      selection.addRange(this.#range);
    }
    const safe = url.replace(/"/g, '%22');
    const text = label || (this.#range && !this.#range.collapsed ? null : url);
    if (text) this.#run('insertHTML', `<a href="${safe}">${text.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</a>`);
    else this.#run('createLink', url);
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

  #findAll() {
    const needle = this.$('#needle').value;
    this.#hits = [];
    this.#hit = -1;
    if (!needle) return;
    const editor = this.$('#editor');
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    const lower = needle.toLowerCase();
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.nodeValue.toLowerCase();
      let at = text.indexOf(lower);
      while (at !== -1) {
        const range = document.createRange();
        range.setStart(node, at);
        range.setEnd(node, at + needle.length);
        this.#hits.push(range);
        at = text.indexOf(lower, at + needle.length);
      }
    }
  }

  #countHits() {
    this.#findAll();
    this.#showHits();
  }

  #showHits() {
    const hits = this.$('#hits');
    if (!hits) return;
    if (!this.$('#needle').value) {
      hits.textContent = '';
      return;
    }
    hits.textContent = this.#hits.length
      ? t('doc-editor.matchAt', '{at} of {count}', { at: this.#hit + 1 || 1, count: this.#hits.length })
      : t('doc-editor.noMatches', 'Nothing found');
  }

  #gotoHit(step) {
    if (!this.#hits.length) this.#findAll();
    if (!this.#hits.length) {
      this.#showHits();
      return;
    }
    this.#hit = (this.#hit + step + this.#hits.length) % this.#hits.length;
    const range = this.#hits[this.#hit];
    const selection = this.shadowRoot.getSelection?.() ?? window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    const holder = range.startContainer.parentElement;
    holder?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    this.#showHits();
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
      this.#hits = [];
      this.#hit = -1;
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
    this.#keep();
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

  async #withPictures() {
    const blocks = this.#blocks.map((block) => ({ ...block }));
    for (const block of blocks) {
      if (block.type !== 'image' || !block.src || block.jpeg) continue;
      try {
        block.jpeg = await toJpeg(block.src, { maxWidth: 1400 });
      } catch {
        block.jpeg = null;
      }
    }
    return blocks;
  }

  async #exportAs(kind) {
    this.$('#export-box')?.close();
    const numbers = this.$('#numbers')?.checked;
    const footer = this.$('#footer')?.value?.trim() ?? '';

    if (kind === 'pdf' || kind === 'print') return this.#savePdf(kind === 'print', numbers, footer);
    if (kind === 'docx') return this.#saveDocx();
    if (kind === 'html') {
      const body = blocksToHtml(this.#blocks);
      download(
        `${this.#name}.html`,
        `<!doctype html>\n<meta charset="utf-8">\n<title>${this.#name}</title>\n<style>body{max-width:44rem;margin:3rem auto;padding:0 1.2rem;font:16px/1.65 Georgia,serif;color:#111}img{max-width:100%}table{border-collapse:collapse}td,th{border:1px solid #d5dae0;padding:6px 9px}</style>\n${body}\n`,
        'text/html',
      );
      toast(t('doc-editor.savedHtml', 'Saved as HTML'));
      return;
    }
    if (kind === 'md') {
      download(`${this.#name}.md`, blocksToMarkdown(this.#blocks), 'text/markdown');
      toast(t('doc-editor.savedMarkdown', 'Saved as Markdown'));
      return;
    }
    if (kind === 'txt') {
      download(`${this.#name}.txt`, blocksToText(this.#blocks), 'text/plain');
      toast(t('doc-editor.savedText', 'Saved as text'));
    }
  }

  async #savePdf(toPrinter = false, numbers = false, footer = '') {
    const paper = this.#paper();
    const blocks = await this.#withPictures();
    const layout = layoutDocument(blocks, paper);
    const bytes = layoutToPdf(layout, {
      ...paper,
      title: this.#name,
      creator: 'Toolbox',
      numbers,
      footer,
    });
    if (toPrinter) {
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const frame = document.createElement('iframe');
      frame.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0';
      frame.src = url;
      frame.onload = () => {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
        setTimeout(() => {
          frame.remove();
          URL.revokeObjectURL(url);
        }, 60000);
      };
      document.body.append(frame);
      return;
    }
    download(`${this.#name}.pdf`, bytes, 'application/pdf');
    toast(t('doc-editor.savedPdf', 'Saved as PDF'));
  }

  async #saveDocx() {
    const paper = this.#paper();
    const blocks = await this.#withPictures();
    const bytes = await writeDocx(blocks, {
      title: this.#name,
      width: this.#layout.width,
      height: this.#layout.height,
      margin: paper.margin,
    });
    download(`${this.#name}.docx`, bytes, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    toast(t('doc-editor.savedWord', 'Saved as Word'));
  }

  async #openFile() {
    const picked = await pickFile('.txt,.md,.markdown,.html,.htm,.docx', false);
    if (!picked) return;
    const name = picked.name.replace(/\.[^.]+$/, '');
    try {
      if (/\.docx$/i.test(picked.name)) {
        const zip = await readZip(picked.data);
        const xml = await zip.text('word/document.xml');
        if (!xml) throw new Error('empty');
        this.$('#editor').innerHTML = docxToHtml(xml);
      } else {
        const text = typeof picked.data === 'string' ? picked.data : new TextDecoder().decode(picked.data);
        if (/\.html?$/i.test(picked.name)) {
          const body = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(text);
          this.$('#editor').innerHTML = (body ? body[1] : text).replace(/<script[\s\S]*?<\/script>/gi, '');
        } else if (/\.(md|markdown)$/i.test(picked.name)) {
          this.$('#editor').innerHTML = markdownToHtml(text);
        } else {
          this.$('#editor').innerHTML = text
            .split(/\n{2,}/)
            .map((piece) => `<p>${piece.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])).replace(/\n/g, '<br>')}</p>`)
            .join('');
        }
      }
      this.#name = name || this.#name;
      this.$('#name').value = this.#name;
      this.#sync();
      toast(t('doc-editor.opened', 'Opened {name}', { name: picked.name }));
    } catch {
      toast(t('doc-editor.couldNotOpen', 'That file could not be opened'), 'danger');
    }
  }

  #paintFiles() {
    const host = this.$('#files');
    if (!host) return;
    const saved = this.#files.list();
    host.innerHTML = saved.length
      ? html`${saved.map((entry) => html`<div class="file"><button class="open" data-open="${entry.name}">${entry.name}</button><button class="drop" data-drop="${entry.name}" title="${t('doc-editor.delete', 'Delete')}">${icon('eraser', 13)}</button></div>`)}`
      : html`<div class="hint">${t('doc-editor.nothingSavedYet', 'Documents you save a copy of will be listed here.')}</div>`;
  }

  renderWidget() {
    this.paint(html`<div class="app" style="padding:12px">
      <div class="stack tight">
        <div class="label">${t('doc-editor.documentsStudio', 'Documents Studio')}</div>
        <div class="hint">${t('doc-editor.widgetBlurb', 'Write and export documents as PDF or Word.')}</div>
      </div>
    </div>`);
  }
}

define('jg-app-doc-editor', DocEditor);
