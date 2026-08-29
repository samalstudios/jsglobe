import { JGApp, define, html, raw, styleSheet } from '../../core/app.js';
import { appText } from '../../core/i18n.js';
import strings from './i18n.js';
import { icon } from '../../ui/icons.js';
import { toast, download, debounce, pickFile } from '../../core/util.js';
import { createDesigns } from '../../lib/designs.js';
import { toJpeg } from '../../lib/raster.js';
import { drawChart } from '../../lib/chart.js';
import { highlight, LANGUAGES, TOKEN_COLOURS } from '../../lib/syntax.js';
import { SAMPLES as FORMULAS } from '../../lib/formula.js';
import { readZip } from '../../core/zip.js';
import { htmlToBlocks, blockNodes, blocksToHtml, blocksToText, blocksToMarkdown, markdownToHtml, outlineOf, countWords } from '../../lib/richtext.js';
import { layoutDocument, layoutToPdf, BLOCK_STYLE } from '../../lib/doc-layout.js';
import { writeDocx, docxToHtml } from '../../lib/docx.js';

const t = appText(strings);
const sheet = await styleSheet(import.meta.url);

const STYLES = [
  { value: 'p', label: () => t('doc-editor.body', 'Body text'), tag: 'p', style: 'font-size:13px' },
  { value: 'h1', label: () => t('doc-editor.title', 'Title'), tag: 'h1', style: 'font-size:19px;font-weight:650' },
  { value: 'h2', label: () => t('doc-editor.heading1', 'Heading 1'), tag: 'h2', style: 'font-size:16px;font-weight:650' },
  { value: 'h3', label: () => t('doc-editor.heading2', 'Heading 2'), tag: 'h3', style: 'font-size:14px;font-weight:650' },
  { value: 'h4', label: () => t('doc-editor.heading3', 'Heading 3'), tag: 'h4', style: 'font-size:13px;font-weight:650' },
  { value: 'blockquote', label: () => t('doc-editor.quote', 'Quote'), tag: 'blockquote', style: 'font-style:italic' },
  { value: 'pre', label: () => t('doc-editor.codeBlock', 'Code'), tag: 'pre', style: 'font-family:Menlo,monospace;font-size:12px' },
];

const SIZES = [9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48];

const GAP = 26;

const BLOCKS = [
  { value: 'contents', label: () => t('doc-editor.tableOfContents', 'Table of contents'), hint: () => t('doc-editor.builtFromHeadings', 'From the headings') },
  { value: 'indexBlock', label: () => t('doc-editor.indexPage', 'Index'), hint: () => t('doc-editor.builtFromMarks', 'From marked words') },
  { value: 'references', label: () => t('doc-editor.references', 'References'), hint: () => t('doc-editor.builtFromCitations', 'From the citations') },
  { value: 'codeBlock', label: () => t('doc-editor.insertCodeBlock', 'Code block') },
  { value: 'chart', label: () => t('doc-editor.chart', 'Chart') },
  { value: 'formula', label: () => t('doc-editor.formula', 'Formula') },
  { value: 'footnote', label: () => t('doc-editor.footnote', 'Footnote') },
  { value: 'cite', label: () => t('doc-editor.addACitation', 'Citation') },
  { value: 'markIndex', label: () => t('doc-editor.markForIndex', 'Mark for the index') },
  { value: 'checklist', label: () => t('doc-editor.checklist', 'Checklist') },
];

const MARKS = [
  { id: 'page', label: () => t('doc-editor.pageNumber', 'Page number') },
  { id: 'pages', label: () => t('doc-editor.pageCountMark', 'Page count') },
  { id: 'title', label: () => t('doc-editor.documentName', 'Document name') },
  { id: 'date', label: () => t('doc-editor.today', 'Today') },
];

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

const MENUS = [
  {
    id: 'file',
    label: () => t('doc-editor.menuFile', 'File'),
    items: [
      { act: 'newDoc', label: () => t('doc-editor.newDocument', 'New document') },
      { act: 'openFile', label: () => t('doc-editor.importAFile', 'Import a file'), keys: '' },
      { act: 'library', label: () => t('doc-editor.documents', 'Documents') },
      { act: 'saveCopy', label: () => t('doc-editor.saveACopy', 'Save a copy') },
      { act: 'rename', label: () => t('doc-editor.rename', 'Rename') },
      { rule: true },
      { act: 'exportFile', label: () => t('doc-editor.export', 'Export'), keys: 'Ctrl S' },
      { act: 'printNow', label: () => t('doc-editor.print', 'Print'), keys: 'Ctrl P' },
    ],
  },
  {
    id: 'edit',
    label: () => t('doc-editor.menuEdit', 'Edit'),
    items: [
      { act: 'undo', label: () => t('doc-editor.undo', 'Undo'), keys: 'Ctrl Z' },
      { act: 'redo', label: () => t('doc-editor.redo', 'Redo'), keys: 'Ctrl Shift Z' },
      { rule: true },
      { act: 'find', label: () => t('doc-editor.findAndReplace', 'Find and replace'), keys: 'Ctrl F' },
      { act: 'removeFormat', label: () => t('doc-editor.clearFormatting', 'Clear formatting'), keys: 'Ctrl \\' },
    ],
  },
  {
    id: 'insert',
    label: () => t('doc-editor.menuInsert', 'Insert'),
    items: [
      { act: 'link', label: () => t('doc-editor.insertLink', 'Insert link'), keys: 'Ctrl K' },
      { act: 'image', label: () => t('doc-editor.insertPicture', 'Insert picture') },
      { act: 'table', label: () => t('doc-editor.insertTable', 'Insert table') },
      { act: 'rule', label: () => t('doc-editor.insertRule', 'Insert a line') },
      { act: 'pageBreak', label: () => t('doc-editor.pageBreak', 'Page break'), keys: 'Alt Enter' },
      { act: 'today', label: () => t('doc-editor.insertDate', 'Insert today') },
      { rule: true },
      { act: 'contents', label: () => t('doc-editor.tableOfContents', 'Table of contents') },
      { act: 'indexBlock', label: () => t('doc-editor.indexPage', 'Index') },
      { act: 'references', label: () => t('doc-editor.references', 'References') },
      { act: 'cite', label: () => t('doc-editor.addACitation', 'Add a citation') },
      { act: 'markIndex', label: () => t('doc-editor.markForIndex', 'Mark for the index') },
      { rule: true },
      { act: 'codeBlock', label: () => t('doc-editor.insertCodeBlock', 'Code block') },
      { act: 'chart', label: () => t('doc-editor.chart', 'Chart') },
      { act: 'formula', label: () => t('doc-editor.formula', 'Formula') },
      { act: 'footnote', label: () => t('doc-editor.footnote', 'Footnote') },
    ],
  },
  {
    id: 'format',
    label: () => t('doc-editor.menuFormat', 'Format'),
    items: [
      { act: 'bold', label: () => t('doc-editor.bold', 'Bold'), keys: 'Ctrl B' },
      { act: 'italic', label: () => t('doc-editor.italic', 'Italic'), keys: 'Ctrl I' },
      { act: 'underline', label: () => t('doc-editor.underline', 'Underline'), keys: 'Ctrl U' },
      { act: 'strikeThrough', label: () => t('doc-editor.strikethrough', 'Strikethrough'), keys: 'Ctrl Shift X' },
      { rule: true },
      { act: 'case', label: () => t('doc-editor.changeCase', 'Change the case') },
      { act: 'runningHead', label: () => t('doc-editor.headerAndFooter', 'Header and footer') },
      { act: 'pageSetup', label: () => t('doc-editor.pageSetup', 'Page setup') },
    ],
  },
  {
    id: 'view',
    label: () => t('doc-editor.menuView', 'View'),
    items: [
      { act: 'zoomIn', label: () => t('doc-editor.zoomIn', 'Zoom in') },
      { act: 'zoomOut', label: () => t('doc-editor.zoomOut', 'Zoom out') },
      { act: 'side', label: () => t('doc-editor.togglePanel', 'Show or hide the panel') },
      { act: 'ruler', label: () => t('doc-editor.toggleRuler', 'Show or hide the ruler') },
    ],
  },
];

const STARTER = `<h1>Untitled document</h1>
<p>Start typing, or paste something in. Everything stays on this device.</p>
<p>Use the toolbar above, or the shortcuts: <b>Ctrl B</b> for bold, <b>Ctrl I</b> for italic, <b>Ctrl K</b> for a link, and <b>Ctrl Shift 8</b> for a list.</p>`;

class DocEditor extends JGApp {
  static appId = 'doc-editor';
  static settings = [
    { key: 'paper', label: t('doc-editor.paperSize', 'Paper size'), type: 'select', default: 'a4',
      options: [{ value: 'a4', label: 'A4' }, { value: 'letter', label: 'Letter' }, { value: 'legal', label: 'Legal' }, { value: 'a5', label: 'A5' }] },
    { key: 'margin', label: t('doc-editor.margin', 'Margin in points'), type: 'text', default: '72' },
    { key: 'bodyFont', label: t('doc-editor.exportFont', 'Font used when exporting'), type: 'select', default: 'helvetica',
      options: [{ value: 'helvetica', label: 'Helvetica' }, { value: 'times', label: 'Times' }] },
  ];
  static styles = [...JGApp.styles, sheet];

  #blocks = [];
  #layout = null;

  #scale = 1;

  #ruler = false;
  #side = 'pages';
  #name = 'Untitled document';
  #zoom = 1;
  #files = createDesigns(this.store, 'documents');
  #hits = [];
  #hit = -1;
  #fade = null;
  #eye = null;
  #stamp = 0;
  #range = null;
  #lastRange = null;
  #header = '';
  #footer = '';
  #numbers = false;
  #editingRunner = null;
  #spacing = 1.6;
  #columns = 1;

  renderApp() {
    this.paint(html`<div class="app">
      <div class="menu" id="menu">
        ${MENUS.map((group) => html`<div class="pop">
          <button class="crumb" data-pop="${group.id}">${group.label()}</button>
          <div class="sheet menulist" data-for="${group.id}">
            ${group.items.map((item) => (item.rule
              ? html`<div class="rule"></div>`
              : html`<button class="entry" data-act="${item.act}">${item.label()}<em>${item.keys ?? ''}</em></button>`))}
          </div>
        </div>`)}
      </div>

      <div class="tools" id="tools">
        <div class="line">
          <div class="cluster">
            <button class="tool" data-act="library" title="${t('doc-editor.documents', 'Documents')}">${icon('folder', 16)}</button>
            <button class="tool" data-act="openFile" title="${t('doc-editor.importAFile', 'Import a file')}">${icon('upload', 16)}</button>
            <button class="tool" data-act="exportFile" title="${t('doc-editor.export', 'Export')} (Ctrl S)">${icon('download', 16)}</button>
          </div>
          <div class="cluster">
            <button class="tool" data-act="undo" title="${t('doc-editor.undo', 'Undo')} (Ctrl Z)">${icon('undo', 16)}</button>
            <button class="tool" data-act="redo" title="${t('doc-editor.redo', 'Redo')} (Ctrl Shift Z)">${icon('redo', 16)}</button>
            <button class="tool" data-act="printNow" title="${t('doc-editor.print', 'Print')} (Ctrl P)">${icon('printer', 16)}</button>
          </div>
          <div class="cluster">
            <jg-selector id="style" value="p"></jg-selector>
            <jg-font-selector id="family" value="Helvetica Neue, Helvetica, Arial, sans-serif" title="${EXPORT_NOTE()}"></jg-font-selector>
            <jg-size-selector id="size" value="11"></jg-size-selector>
          </div>
          <div class="cluster">
            <button class="tool" data-act="bold" title="${t('doc-editor.bold', 'Bold')} (Ctrl B)">${icon('bold', 16)}</button>
            <button class="tool" data-act="italic" title="${t('doc-editor.italic', 'Italic')} (Ctrl I)">${icon('italic', 16)}</button>
            <button class="tool" data-act="underline" title="${t('doc-editor.underline', 'Underline')} (Ctrl U)">${icon('underline', 16)}</button>
            <button class="tool" data-act="strikeThrough" title="${t('doc-editor.strikethrough', 'Strikethrough')} (Ctrl Shift X)">${icon('strikethrough', 16)}</button>
            <button class="tool" data-act="superscript" title="${t('doc-editor.superscript', 'Superscript')}">${icon('superscript', 16)}</button>
            <button class="tool" data-act="subscript" title="${t('doc-editor.subscript', 'Subscript')}">${icon('subscript', 16)}</button>
          </div>
          <div class="cluster">
            <jg-color-picker id="ink" value="#111111" label="${t('doc-editor.textColour', 'Text colour')}">${icon('textColour', 16)}</jg-color-picker>
            <jg-color-picker id="mark" value="#fff3a3" clearable label="${t('doc-editor.highlight', 'Highlight')}">${icon('highlight', 16)}</jg-color-picker>
            <button class="tool" data-act="case" title="${t('doc-editor.changeCase', 'Change the case')}">${icon('letterCase', 16)}</button>
            <button class="tool" data-act="removeFormat" title="${t('doc-editor.clearFormatting', 'Clear formatting')} (Ctrl \\)">${icon('eraser', 16)}</button>
          </div>
          <div class="spring"></div>
          <div class="cluster">
            <button class="tool" data-act="find" title="${t('doc-editor.findAndReplace', 'Find and replace')} (Ctrl F)">${icon('search', 16)}</button>
            <button class="tool" data-act="side" title="${t('doc-editor.togglePanel', 'Show or hide the panel')}">${icon('sidebar', 16)}</button>
          </div>
        </div>

        <div class="line">
          <div class="cluster">
            <button class="tool" data-act="justifyLeft" title="${t('doc-editor.alignLeft', 'Align left')}">${icon('alignLeft', 16)}</button>
            <button class="tool" data-act="justifyCenter" title="${t('doc-editor.centre', 'Centre')}">${icon('alignCenter', 16)}</button>
            <button class="tool" data-act="justifyRight" title="${t('doc-editor.alignRight', 'Align right')}">${icon('alignRight', 16)}</button>
            <button class="tool" data-act="justifyFull" title="${t('doc-editor.justify', 'Justify')}">${icon('alignJustify', 16)}</button>
          </div>
          <div class="cluster">
            <button class="tool" data-act="insertUnorderedList" title="${t('doc-editor.bulletList', 'Bulleted list')} (Ctrl Shift 8)">${icon('list', 16)}</button>
            <button class="tool" data-act="insertOrderedList" title="${t('doc-editor.numberedList', 'Numbered list')} (Ctrl Shift 7)">${icon('listOrdered', 16)}</button>
            <button class="tool" data-act="checklist" title="${t('doc-editor.checklist', 'Checklist')}">${icon('checkSquare', 16)}</button>
            <button class="tool" data-act="outdent" title="${t('doc-editor.decreaseIndent', 'Decrease indent')}">${icon('outdent', 16)}</button>
            <button class="tool" data-act="indent" title="${t('doc-editor.increaseIndent', 'Increase indent')}">${icon('indent', 16)}</button>
            <jg-select id="spacing" size="sm" value="1.6" title="${t('doc-editor.lineSpacing', 'Line spacing')}">
              <option value="1.15">1.15</option>
              <option value="1.3">1.3</option>
              <option value="1.6">1.6</option>
              <option value="1.8">1.8</option>
              <option value="2">2.0</option>
              <option value="2.5">2.5</option>
            </jg-select>
            <jg-select id="columns" size="sm" value="1" title="${t('doc-editor.columns', 'Columns')}">
              <option value="1">${t('doc-editor.oneColumn', '1 column')}</option>
              <option value="2">${t('doc-editor.twoColumns', '2 columns')}</option>
              <option value="3">${t('doc-editor.threeColumns', '3 columns')}</option>
            </jg-select>
          </div>
          <div class="cluster">
            <button class="tool" data-act="link" title="${t('doc-editor.insertLink', 'Insert link')} (Ctrl K)">${icon('link', 16)}</button>
            <button class="tool" data-act="image" title="${t('doc-editor.insertPicture', 'Insert picture')}">${icon('image', 16)}</button>
            <button class="tool" data-act="table" title="${t('doc-editor.insertTable', 'Insert table')}">${icon('table', 16)}</button>
            <button class="tool" data-act="rule" title="${t('doc-editor.insertRule', 'Insert a line')}">${icon('minus', 16)}</button>
            <button class="tool" data-act="pageBreak" title="${t('doc-editor.pageBreak', 'Page break')} (Alt Enter)">${icon('pageBreak', 16)}</button>
            <button class="tool" data-act="today" title="${t('doc-editor.insertDate', 'Insert today')}">${icon('calendar', 16)}</button>
            <jg-lookup id="blocks" style="width:132px" placeholder="${t('doc-editor.addBlock', 'Add a block')}"
              hunt="${t('doc-editor.findABlock', 'Find a block')}"></jg-lookup>
          </div>
          <div class="cluster">
            <button class="tool" data-act="runningHead" title="${t('doc-editor.headerAndFooter', 'Header and footer')}">${icon('heading', 16)}</button>
          </div>
          <div class="spring"></div>
          <div class="cluster zoomer">
            <button class="tool" data-act="zoomOut" title="${t('doc-editor.zoomOut', 'Zoom out')}">${icon('minus', 15)}</button>
            <span id="zoomat">100%</span>
            <button class="tool" data-act="zoomIn" title="${t('doc-editor.zoomIn', 'Zoom in')}">${icon('plus', 15)}</button>
          </div>
        </div>
      </div>

      <div class="imagebar" id="imagebar" hidden>
        <span class="what">${icon('image', 14)}${t('doc-editor.picture', 'Picture')}</span>
        <div class="cluster">
          <button class="tool" data-picture="left" title="${t('doc-editor.alignLeft', 'Align left')}">${icon('alignLeft', 15)}</button>
          <button class="tool" data-picture="center" title="${t('doc-editor.centre', 'Centre')}">${icon('alignCenter', 15)}</button>
          <button class="tool" data-picture="right" title="${t('doc-editor.alignRight', 'Align right')}">${icon('alignRight', 15)}</button>
        </div>
        <div class="cluster">
          <button class="tool" data-picture="small" title="${t('doc-editor.small', 'Small')}">${t('doc-editor.smallShort', 'S')}</button>
          <button class="tool" data-picture="medium" title="${t('doc-editor.medium', 'Medium')}">${t('doc-editor.mediumShort', 'M')}</button>
          <button class="tool" data-picture="full" title="${t('doc-editor.fullWidth', 'Full width')}">${t('doc-editor.fullShort', 'L')}</button>
        </div>
        <div class="cluster">
          <button class="tool danger" data-picture="drop" title="${t('doc-editor.removePicture', 'Remove the picture')}">${icon('eraser', 15)}</button>
        </div>
      </div>

      <div class="tablebar" id="tablebar" hidden>
        <span class="what">${icon('table', 14)}${t('doc-editor.table', 'Table')}</span>
        <span class="where" id="cellat"></span>
        <div class="cluster">
          <button class="tool" data-table="rowAbove" title="${t('doc-editor.rowAbove', 'Row above')}">${icon('chevronUp', 15)}</button>
          <button class="tool" data-table="rowBelow" title="${t('doc-editor.rowBelow', 'Row below')}">${icon('chevronDown', 15)}</button>
          <button class="tool" data-table="columnLeft" title="${t('doc-editor.columnLeft', 'Column to the left')}">${icon('chevronLeft', 15)}</button>
          <button class="tool" data-table="columnRight" title="${t('doc-editor.columnRight', 'Column to the right')}">${icon('chevronRight', 15)}</button>
        </div>
        <div class="cluster">
          <button class="tool" data-table="dropRow" title="${t('doc-editor.deleteRow', 'Delete this row')}">${icon('rowRemove', 15)}</button>
          <button class="tool" data-table="dropColumn" title="${t('doc-editor.deleteColumn', 'Delete this column')}">${icon('columnRemove', 15)}</button>
          <button class="tool" data-table="header" title="${t('doc-editor.toggleHeaderRow', 'Turn the first row into a header')}">${icon('heading', 15)}</button>
        </div>
        <div class="cluster">
          <div class="pop">
            <button class="tool" data-pop="cell" title="${t('doc-editor.cellShading', 'Cell shading')}">${icon('palette', 15)}</button>
            <div class="sheet" data-for="cell">${['#ffffff', '#f1f3f5', '#fff3a3', '#c8f2d0', '#cfe4ff', '#ffd6d6', '#e8dcff', 'transparent'].map((colour) => html`<button class="chip" data-cell="${colour}" style="background:${colour === 'transparent' ? 'var(--card)' : colour}"></button>`)}</div>
          </div>
          <button class="tool danger" data-table="dropTable" title="${t('doc-editor.deleteTable', 'Delete the table')}">${icon('eraser', 15)}</button>
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
          <button class="addpage" id="addpage" type="button">${icon('plus', 13)}${t('doc-editor.addPage', 'Add a page')}</button>
          <div class="outline" id="outline" hidden></div>
        </aside>

        <div class="deck">
          <div class="ruler" id="ruler" aria-hidden="true" hidden><div class="track" id="track"></div></div>
          <div class="stage" id="stage">
          <div class="sheetwrap" id="sheetwrap">
            <div class="papercage" id="papercage">
              <div class="paper" id="paper">
                <div class="pages" id="editor" contenteditable="true" spellcheck="true" role="textbox" aria-multiline="true"></div>
              </div>
            </div>
          </div>
          </div>
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

      <jg-dialog id="setup-box" title-text="${t('doc-editor.pageSetup', 'Page setup')}" sub="${t('doc-editor.setupHint', 'Applies to the whole document, on screen and in the export.')}">
        <div class="cols">
          <jg-field label="${t('doc-editor.paperSize', 'Paper size')}">
            <jg-select id="setup-size">
              <option value="a4">A4</option>
              <option value="letter">Letter</option>
              <option value="legal">Legal</option>
              <option value="a5">A5</option>
              <option value="a3">A3</option>
              <option value="tabloid">Tabloid</option>
            </jg-select>
          </jg-field>
          <jg-field label="${t('doc-editor.orientation', 'Orientation')}">
            <jg-select id="setup-orient">
              <option value="portrait">${t('doc-editor.portrait', 'Portrait')}</option>
              <option value="landscape">${t('doc-editor.landscape', 'Landscape')}</option>
            </jg-select>
          </jg-field>
          <jg-field label="${t('doc-editor.margin', 'Margin in points')}" hint="${t('doc-editor.marginHint', '72 points is an inch')}">
            <jg-input id="setup-margin" type="number" min="0" max="200" step="6"></jg-input>
          </jg-field>
          <jg-field label="${t('doc-editor.exportFont', 'Font used when exporting')}">
            <jg-select id="setup-font">
              <option value="helvetica">Helvetica</option>
              <option value="times">Times</option>
              <option value="courier">Courier</option>
            </jg-select>
          </jg-field>
        </div>
        <jg-field label="${t('doc-editor.appliesTo', 'Applies to')}">
          <jg-select id="setup-scope" value="all">
            <option value="all">${t('doc-editor.wholeDocument', 'The whole document')}</option>
            <option value="here">${t('doc-editor.fromHereOn', 'From here on, as a new section')}</option>
          </jg-select>
        </jg-field>
        <div class="row end">
          <jg-button size="sm" id="setup-apply">${t('doc-editor.done', 'Done')}</jg-button>
        </div>
      </jg-dialog>

      <jg-dialog id="name-box" title-text="${t('doc-editor.rename', 'Rename')}">
        <jg-field label="${t('doc-editor.documentName', 'Document name')}"><jg-input id="name" autofocus></jg-input></jg-field>
        <div class="row end">
          <jg-button size="sm" variant="outline" id="name-cancel">${t('doc-editor.cancel', 'Cancel')}</jg-button>
          <jg-button size="sm" id="name-apply">${t('doc-editor.done', 'Done')}</jg-button>
        </div>
      </jg-dialog>

      <jg-dialog id="chart-box" title-text="${t('doc-editor.chart', 'Chart')}" sub="${t('doc-editor.chartHint', 'One row per point. The preview updates as you type.')}">
        <div class="row wrap">
          <jg-select id="chart-kind" size="sm" value="bar">
            <option value="bar">${t('doc-editor.bars', 'Bars')}</option>
            <option value="line">${t('doc-editor.line', 'Line')}</option>
            <option value="area">${t('doc-editor.area', 'Area')}</option>
            <option value="pie">${t('doc-editor.pie', 'Pie')}</option>
          </jg-select>
          <jg-input id="chart-title" size="sm" placeholder="${t('doc-editor.chartTitle', 'Title, optional')}"></jg-input>
        </div>
        <div class="label">${t('doc-editor.data', 'Data')}</div>
        <jg-table
          id="chart-grid"
          least="1"
          add-label="${t('doc-editor.addRow', 'Add a row')}"
          remove-label="${t('doc-editor.removeRow', 'Remove')}"
          hint="${t('doc-editor.gridHint', 'Paste rows from a spreadsheet, drag to reorder.')}"></jg-table>
        <canvas id="chart-preview" class="preview-chart"></canvas>
        <div class="row end">
          <jg-button size="sm" variant="outline" id="chart-cancel">${t('doc-editor.cancel', 'Cancel')}</jg-button>
          <jg-button size="sm" id="chart-apply">${t('doc-editor.insert', 'Insert')}</jg-button>
        </div>
      </jg-dialog>

      <jg-dialog id="formula-box" title-text="${t('doc-editor.formula', 'Formula')}" sub="${t('doc-editor.formulaHint', 'Type it plainly: x^2 for powers, x_1 for subscripts, \\alpha for Greek, \\frac{a}{b} for a fraction.')}">
        <jg-formula-input id="formula-source" value="a^2 + b^2 = c^2"></jg-formula-input>
        <div class="samples" id="formula-samples">${FORMULAS.map((entry) => html`<button class="pill" data-sample="${entry.source.replace(/"/g, '&quot;')}">${entry.label}</button>`)}</div>
        <div class="row end">
          <jg-button size="sm" variant="outline" id="formula-cancel">${t('doc-editor.cancel', 'Cancel')}</jg-button>
          <jg-button size="sm" id="formula-apply">${t('doc-editor.insert', 'Insert')}</jg-button>
        </div>
      </jg-dialog>

      <div class="context" id="context" hidden></div>

      <div class="runbar" id="runbar" hidden>
        <span class="what" id="runwhat"></span>
        ${MARKS.map((mark) => html`<button class="pill" type="button" data-mark="${mark.id}">${mark.label()}</button>`)}
        <span class="split"></span>
        <button class="tool" type="button" data-run="left" title="${t('doc-editor.alignLeft', 'Align left')}">${icon('alignLeft', 14)}</button>
        <button class="tool" type="button" data-run="center" title="${t('doc-editor.alignCenter', 'Centre')}">${icon('alignCenter', 14)}</button>
        <button class="tool" type="button" data-run="right" title="${t('doc-editor.alignRight', 'Align right')}">${icon('alignRight', 14)}</button>
        <span class="split"></span>
        <button class="tool" type="button" data-run="clear" title="${t('doc-editor.clear', 'Clear')}">${icon('eraser', 14)}</button>
        <jg-button size="sm" id="rundone">${t('doc-editor.done', 'Done')}</jg-button>
      </div>

      <jg-dialog id="head-box" title-text="${t('doc-editor.headerAndFooter', 'Header and footer')}" sub="${t('doc-editor.shownOnEveryPage', 'Shown on every page of the PDF and the page view.')}">
        <jg-field label="${t('doc-editor.headerText', 'Header')}"><jg-input id="head-text" placeholder="${t('doc-editor.optional', 'Optional')}"></jg-input></jg-field>
        <jg-field label="${t('doc-editor.footerText', 'Footer text, optional')}"><jg-input id="foot-text" placeholder="${t('doc-editor.optional', 'Optional')}"></jg-input></jg-field>
        <div class="row wrap">
          <jg-switch id="head-numbers"></jg-switch><span class="hint">${t('doc-editor.pageNumbers', 'Number the pages')}</span>
        </div>
        <div class="row end">
          <jg-button size="sm" id="head-apply">${t('doc-editor.done', 'Done')}</jg-button>
        </div>
      </jg-dialog>

      <jg-dialog id="export-box" title-text="${t('doc-editor.export', 'Export')}" sub="${t('doc-editor.chooseAFormat', 'Choose a format. The file is built on this device.')}">
        <div class="formats">
          <button class="format" data-kind="doc"><b>${t('doc-editor.studioFile', 'Studio document')}</b><span>${t('doc-editor.studioHint', 'Keeps the page setup so you can carry on later')}</span></button>
          <button class="format" data-kind="pdf"><b>PDF</b><span>${t('doc-editor.pdfHint', 'Laid out exactly as the page view shows')}</span></button>
          <button class="format" data-kind="docx"><b>Word</b><span>${t('doc-editor.docxHint', 'A .docx that Word and Pages both open')}</span></button>
          <button class="format" data-kind="html"><b>HTML</b><span>${t('doc-editor.htmlHint', 'A single page with the formatting kept')}</span></button>
          <button class="format" data-kind="md"><b>Markdown</b><span>${t('doc-editor.mdHint', 'Headings, lists, links and emphasis')}</span></button>
          <button class="format" data-kind="txt"><b>${t('doc-editor.plainText', 'Plain text')}</b><span>${t('doc-editor.txtHint', 'Just the words')}</span></button>
          <button class="format" data-kind="print"><b>${t('doc-editor.print', 'Print')}</b><span>${t('doc-editor.printHint', 'Send the pages to a printer')}</span></button>
        </div>
        <p class="note" id="running"></p>
      </jg-dialog>
    </div>`);

    this.#write(STARTER);
    document.execCommand('defaultParagraphSeparator', false, 'p');

    this.#wire();
    this.#restore();
    this.#ruler = this.config.get('ruler', 'off') === 'on';
    this.#applyPaper();
    this.#showName();
    this.#sync();

    const stage = this.$('#stage');
    if (stage) this.on(stage, 'scroll', () => this.#drawRuler());
    if (stage && 'ResizeObserver' in window) {
      const watcher = new ResizeObserver(() => this.#fitPaper());
      watcher.observe(stage);
      this.track(() => watcher.disconnect());
    }
  }

  #restore() {
    const saved = this.store.read();
    const open = saved?.current;
    if (open?.html) {
      this.#write(open.html);
      this.#name = open.name ?? this.#name;
      this.#header = open.header ?? '';
      this.#footer = open.footer ?? '';
      this.#numbers = Boolean(open.numbers);
      this.#header = this.#asRunner(this.#header);
      this.#footer = this.#asRunner(this.#footer, this.#numbers);
      this.#spacing = Number(open.spacing) || 1.6;
      this.#columns = Number(open.columns) || 1;
      this.$('#spacing').value = String(this.#spacing);
      this.$('#columns').value = String(this.#columns);
      this.$('#editor').style.lineHeight = String(this.#spacing);
    }
  }

  #showName() {
    this.setTitle(this.#name);
  }

  #keep() {
    const state = this.store.read() ?? {};
    state.current = { name: this.#name, ...this.#snapshot(), at: Date.now() };
    this.store.write(state);

  }

  #wire() {
    const editor = this.$('#editor');
    const settle = debounce(() => this.#sync(), 260);

    this.on(editor, 'input', settle);
    this.on(editor, 'keyup', () => {
      this.#remember();
      this.#reflect();
    });
    this.on(editor, 'mouseup', () => {
      this.#remember();
      this.#reflect();
    });
    this.on(editor, 'blur', () => {
      this.#remember();
      this.#live();
    });
    this.on(editor, 'focus', () => this.#live());
    this.listen(document, 'selectionchange', () => {
      this.#remember();
      this.#live();
    });
    this.on(editor, 'paste', (event) => {
      const text = event.clipboardData?.getData('text/plain');
      if (event.clipboardData?.types?.includes('text/html')) return;
      if (text === undefined) return;
      event.preventDefault();
      document.execCommand('insertText', false, text);
    });

    this.on(this.$('#tools'), 'mousedown', (event) => {
      if (event.target.closest('button, .chip')) event.preventDefault();
    });
    this.on(this.$('#tablebar'), 'mousedown', (event) => {
      if (event.target.closest('button, .chip')) event.preventDefault();
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
      const button = event.target.closest('[data-act]');
      if (button) this.#act(button.dataset.act);
    });

    this.on(this.$('#menu'), 'mousedown', (event) => {
      if (event.target.closest('button')) event.preventDefault();
    });
    this.on(this.$('#menu'), 'click', (event) => {
      const crumb = event.target.closest('[data-pop]');
      if (crumb) {
        const parent = crumb.parentElement;
        const open = !parent.classList.contains('open');
        this.$$('.pop').forEach((node) => node.classList.remove('open'));
        parent.classList.toggle('open', open);
        event.stopPropagation();
        return;
      }
      const entry = event.target.closest('[data-act]');
      if (entry) {
        this.$$('.pop').forEach((node) => node.classList.remove('open'));
        this.#act(entry.dataset.act);
      }
    });

    this.on(this.$('#ink'), 'change', (event) => this.#run('foreColor', event.detail.value));
    this.on(this.$('#mark'), 'change', (event) =>
      this.#run('hiliteColor', event.detail.value === 'transparent' ? 'rgba(0,0,0,0)' : event.detail.value));

    this.listen(document, 'click', () => this.$$('.pop').forEach((node) => node.classList.remove('open')));

    this.$('#style').items = STYLES.map((entry) => ({ value: entry.value, label: entry.label(), style: entry.style ?? '' }));
    this.on(this.$('#style'), 'change', (event) => {
      const entry = STYLES.find((item) => item.value === event.detail.value);
      this.#run('formatBlock', `<${entry?.tag ?? 'p'}>`);
    });
    this.on(this.$('#family'), 'change', (event) => this.#wrapStyle('fontFamily', event.detail.value));
    this.on(this.$('#size'), 'change', (event) => this.#wrapStyle('fontSize', `${event.detail.value}px`));
    this.on(this.$('#spacing'), 'change', (event) => {
      this.#spacing = Number(event.detail.value) || 1.6;
      this.$('#editor').style.lineHeight = String(this.#spacing);
      this.#sync();
    });
    this.on(this.$('#columns'), 'change', (event) => {
      this.#columns = Number(event.detail.value) || 1;
      this.#sync();
    });

    this.on(this.$('#imagebar'), 'mousedown', (event) => {
      if (event.target.closest('button')) event.preventDefault();
    });
    this.on(this.$('#imagebar'), 'click', (event) => {
      const button = event.target.closest('[data-picture]');
      if (button) this.#pictureAct(button.dataset.picture);
    });
    this.on(this.$('#editor'), 'dblclick', (event) => {
      const runner = event.target.closest('[data-runner]');
      if (runner) {
        event.preventDefault();
        this.#editRunner(runner);
      }
    });
    const blocks = this.$('#blocks');
    blocks.items = BLOCKS.map((entry) => ({ value: entry.value, label: entry.label(), hint: entry.hint?.() }));
    this.on(blocks, 'change', (event) => {
      const pick = event.detail.value;
      blocks.removeAttribute('value');
      if (pick) this.#act(pick);
    });

    this.on(this.$('#runbar'), 'mousedown', (event) => event.preventDefault());
    this.on(this.$('#runbar'), 'click', (event) => {
      const mark = event.target.closest('[data-mark]');
      if (mark) return this.#addMark(mark.dataset.mark);
      const tool = event.target.closest('[data-run]');
      if (tool) return this.#runnerAct(tool.dataset.run);
      if (event.target.closest('#rundone')) this.#closeRunner();
    });
    this.on(this.$('#editor'), 'click', (event) => {
      if (this.#editingRunner && !event.target.closest('[data-runner]')) this.#closeRunner();
      const figure = event.target.closest('figure');
      this.$$('#editor figure').forEach((node) => node.classList.toggle('picked', node === figure));
      this.#reflect();
    });

    this.on(this.$('#setup-apply'), 'click', () => {
      const size = this.$('#setup-size').value;
      const orientation = this.$('#setup-orient').value;
      const margin = String(Math.max(0, Math.min(200, Number(this.$('#setup-margin').value) || 72)));
      this.$('#setup-box').close();

      if (this.$('#setup-scope').value === 'here') {
        this.#insertBlock(
          `<hr data-section="1" data-size="${size}" data-orient="${orientation}" data-margin="${margin}"><p><br></p>`,
        );
        toast(t('doc-editor.sectionAdded', 'A new section starts here'));
        return;
      }

      this.config.set('paper', size);
      this.config.set('orientation', orientation);
      this.config.set('margin', margin);
      this.config.set('bodyFont', this.$('#setup-font').value);
      this.#applyPaper();
      this.#sync();
    });

    this.on(this.$('#name-cancel'), 'click', () => this.$('#name-box').close());
    this.on(this.$('#name-apply'), 'click', () => {
      this.#name = this.$('#name').value.trim() || t('doc-editor.untitled', 'Untitled document');
      this.$('#name-box').close();
      this.#showName();
      this.#keep();
    });

    this.on(this.$('#head-apply'), 'click', () => {
      this.#header = this.$('#head-text').value.trim();
      this.#footer = this.$('#foot-text').value.trim();
      this.#numbers = this.$('#head-numbers').checked;
      this.$('#head-box').close();
      this.#sync();
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
        this.#write(design.html ?? '');
        this.#header = design.header ?? '';
        this.#footer = design.footer ?? '';
        this.#numbers = Boolean(design.numbers);
        this.#name = open.dataset.open;
        this.#showName();
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

    this.on(this.$('#new-doc'), 'click', () => this.#newDocument());

    this.on(this.$('#save-doc'), 'click', () => this.#act('saveCopy'));

    for (const id of ['#chart-kind', '#chart-title']) {
      this.on(this.$(id), 'input', () => this.#drawChartPreview());
      this.on(this.$(id), 'change', () => this.#drawChartPreview());
    }
    this.on(this.$('#chart-grid'), 'change', () => this.#drawChartPreview());
    this.on(this.$('#chart-cancel'), 'click', () => this.$('#chart-box').close());
    this.on(this.$('#chart-apply'), 'click', () => this.#insertChart());

    this.on(this.$('#formula-samples'), 'click', (event) => {
      const pill = event.target.closest('[data-sample]');
      if (!pill) return;
      this.$('#formula-source').value = pill.dataset.sample;
    });
    this.on(this.$('#formula-cancel'), 'click', () => this.$('#formula-box').close());
    this.on(this.$('#formula-apply'), 'click', () => this.#insertFormula());

    this.on(this.$('#editor'), 'contextmenu', (event) => {
      event.preventDefault();
      this.#showContext(event.clientX, event.clientY);
    });
    this.on(this.$('#context'), 'mousedown', (event) => event.preventDefault());
    this.on(this.$('#context'), 'click', (event) => {
      const button = event.target.closest('[data-act]');
      this.$('#context').hidden = true;
      if (button) this.#act(button.dataset.act);
    });
    this.listen(document, 'click', () => {
      const menu = this.$('#context');
      if (menu) menu.hidden = true;
    });

    this.on(this.$('#link-cancel'), 'click', () => this.$('#link-box').close());
    this.on(this.$('#link-apply'), 'click', () => this.#applyLink());

    this.on(this.$('.tabs'), 'click', (event) => {
      const tab = event.target.closest('[data-side]');
      if (!tab) return;
      this.#side = tab.dataset.side;
      this.$$('.tab').forEach((node) => node.setAttribute('aria-pressed', String(node.dataset.side === this.#side)));
      this.$('#thumbs').hidden = this.#side !== 'pages';
      this.$('#addpage').hidden = this.#side !== 'pages';
      this.$('#outline').hidden = this.#side !== 'outline';
    });

    this.on(this.$('#outline'), 'click', (event) => {
      const entry = event.target.closest('[data-index]');
      if (!entry) return;
      const node = this.#nodes()[Number(entry.dataset.index)];
      node?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    this.on(this.$('#addpage'), 'click', () => this.#addPage());
    this.on(this.$('#thumbs'), 'click', (event) => {
      const card = event.target.closest('[data-page]');
      if (!card) return;
      const which = Number(card.dataset.page);
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
      this.#insertBlock(`<figure data-align="center" data-size="medium"><img src="${data}" alt=""></figure><p><br></p>`);
    });

    this.on(this.$('#tablebar'), 'click', (event) => {
      const pop = event.target.closest('[data-pop]');
      if (pop) {
        pop.parentElement.classList.toggle('open');
        event.stopPropagation();
        return;
      }
      const shade = event.target.closest('[data-cell]');
      if (shade) {
        this.#shadeCell(shade.dataset.cell);
        shade.closest('.pop').classList.remove('open');
        return;
      }
      const button = event.target.closest('[data-table]');
      if (button) this.#tableAct(button.dataset.table);
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

    this.listen(window, 'keydown', (event) => {
      if (event.key !== 'Escape' || this.offsetParent === null) return;
      const menu = this.$('#context');
      const dialog = [...this.shadowRoot.querySelectorAll('jg-dialog')].find((box) => box.hasAttribute('open'));
      const bar = this.$('#find');
      const pop = this.shadowRoot.querySelector('.pop.open');
      if (menu && !menu.hidden) {
        menu.hidden = true;
      } else if (pop) {
        pop.classList.remove('open');
      } else if (dialog) {
        dialog.close();
      } else if (bar && !bar.hidden) {
        this.#toggleFind(false);
      } else {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }, { capture: true });

    this.hotkeys((event) => {
      const meta = event.metaKey || event.ctrlKey;
      if (!meta) {
        if (event.key === 'Enter' && event.altKey) {
          event.preventDefault();
          this.#act('pageBreak');
          return;
        }
        if (event.key === 'Tab' && this.#inList()) {
          event.preventDefault();
          this.#act(event.shiftKey ? 'outdent' : 'indent');
        }
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        this.#act('pageBreak');
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

  #remember() {
    const editor = this.$('#editor');
    const selection = this.shadowRoot.getSelection?.() ?? window.getSelection();
    if (!editor || !selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) this.#lastRange = range.cloneRange();
  }

  #focus() {
    const editor = this.$('#editor');
    if (this.shadowRoot.activeElement !== editor) editor.focus();
    const selection = this.shadowRoot.getSelection?.() ?? window.getSelection();
    const inside = selection?.rangeCount && editor.contains(selection.getRangeAt(0).commonAncestorContainer);

    if (!inside && this.#lastRange && editor.contains(this.#lastRange.commonAncestorContainer)) {
      selection.removeAllRanges();
      selection.addRange(this.#lastRange);
      return editor;
    }
    if (!inside) {
      const range = document.createRange();
      const last = editor.lastElementChild ?? editor;
      range.selectNodeContents(last);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    return editor;
  }

  // blocks belong between the paragraphs, never inside the one holding the caret
  #insertBlock(markup, at) {
    this.#focus();
    const selection = this.shadowRoot.getSelection?.() ?? window.getSelection();
    const anchor = selection?.anchorNode;
    const from = anchor?.nodeType === 1 ? anchor : anchor?.parentElement;
    const leaf = at ?? from?.closest?.('.leaf') ?? this.#edge(true);

    let block = from && leaf.contains(from) ? from : null;
    while (block && block.parentElement !== leaf) block = block.parentElement;

    const holder = document.createElement('div');
    holder.innerHTML = markup;
    const made = [...holder.children];
    if (!made.length) return;

    if (block) block.after(...made);
    else leaf.append(...made);

    const last = made[made.length - 1];
    const range = document.createRange();
    range.selectNodeContents(last);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);

    this.#sync();
    this.#reflect();
  }

  #insertNode(markup) {
    this.#focus();
    const selection = this.shadowRoot.getSelection?.() ?? window.getSelection();
    if (!selection?.rangeCount) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();

    const holder = document.createElement('div');
    holder.innerHTML = markup;
    const fragment = document.createDocumentFragment();
    let last = null;
    while (holder.firstChild) {
      last = holder.firstChild;
      fragment.append(last);
    }
    range.insertNode(fragment);

    if (last) {
      const after = document.createRange();
      after.setStartAfter(last);
      after.collapse(true);
      selection.removeAllRanges();
      selection.addRange(after);
    }
    this.#sync();
    this.#reflect();
  }

  #run(command, value) {
    this.#focus();
    document.execCommand('styleWithCSS', false, command === 'foreColor' || command === 'hiliteColor');
    document.execCommand(command, false, value);
    this.#sync();
    this.#reflect();
  }

  #wrapNode(tag, attributes) {
    const editor = this.#focus();
    const selection = this.shadowRoot.getSelection?.() ?? window.getSelection();
    if (!selection) return false;

    const kept = this.#lastRange;
    const live = selection.rangeCount ? selection.getRangeAt(0) : null;
    if ((!live || live.collapsed) && kept && !kept.collapsed && editor.contains(kept.commonAncestorContainer)) {
      selection.removeAllRanges();
      selection.addRange(kept);
    }
    if (!selection.rangeCount || selection.getRangeAt(0).collapsed) return false;

    const range = selection.getRangeAt(0);
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes ?? {})) node.setAttribute(name, value);
    try {
      node.appendChild(range.extractContents());
      range.insertNode(node);
      selection.removeAllRanges();
      const next = document.createRange();
      next.selectNodeContents(node);
      selection.addRange(next);
      this.#lastRange = next.cloneRange();
      return true;
    } catch {
      return false;
    }
  }

  #wrapStyle(property, value) {
    const editor = this.#focus();
    const selection = this.shadowRoot.getSelection?.() ?? window.getSelection();
    if (!selection) return;

    const kept = this.#lastRange;
    const live = selection.rangeCount ? selection.getRangeAt(0) : null;
    const usable = live && !live.collapsed;
    if (!usable && kept && !kept.collapsed && editor.contains(kept.commonAncestorContainer)) {
      selection.removeAllRanges();
      selection.addRange(kept);
    }
    if (!selection.rangeCount || selection.getRangeAt(0).collapsed) {
      toast(t('doc-editor.selectSomeText', 'Select some text first'), 'danger');
      return;
    }
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
      this.#lastRange = next.cloneRange();
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
    if (action === 'rule') return this.#insertBlock('<hr><p><br></p>');
    if (action === 'table') {
      const head = `<tr><th>${t('doc-editor.column', 'Column')} 1</th><th>${t('doc-editor.column', 'Column')} 2</th><th>${t('doc-editor.column', 'Column')} 3</th></tr>`;
      const row = '<tr><td><br></td><td><br></td><td><br></td></tr>';
      return this.#insertBlock(`<table>${head}${row}${row}</table><p><br></p>`);
    }
    if (action === 'find') return this.#toggleFind(true);
    if (action === 'case') return this.#changeCase();
    if (action === 'library') {
      this.#paintFiles();
      return this.$('#library-box').open();
    }
    if (action === 'openFile') return this.#openFile();
    if (action === 'exportFile') return this.#openExport();
    if (action === 'printNow') return this.#savePdf(true);
    if (action === 'runningHead') {
      const first = this.#leaves()[0]?.querySelector('[data-runner="header"]');
      if (first) {
        first.scrollIntoView({ block: 'start', behavior: 'smooth' });
        this.#editRunner(first);
        return;
      }
      return this.$('#head-box').open();
    }
    if (action === 'newDoc') return this.#newDocument();
    if (action === 'pageSetup') {
      this.$('#setup-size').value = this.config.get('paper', 'a4');
      this.$('#setup-orient').value = this.config.get('orientation', 'portrait');
      this.$('#setup-margin').value = String(this.config.get('margin', '72'));
      this.$('#setup-font').value = this.config.get('bodyFont', 'helvetica');
      return this.$('#setup-box').open();
    }
    if (action === 'rename') {
      this.$('#name').value = this.#name;
      return this.$('#name-box').open();
    }
    if (action === 'saveCopy') {
      this.#files.save(this.#name, this.#snapshot());
      this.#paintFiles();
      return toast(t('doc-editor.copySaved', 'Saved a copy of {name}', { name: this.#name }));
    }
    if (action === 'pageBreak') return this.#insertBlock('<hr data-break="page"><p><br></p>');
    if (action === 'today') {
      return this.#run('insertText', new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date()));
    }
    if (action === 'checklist') return this.#checklist();
    if (action === 'contents') return this.#insertLive('contents');
    if (action === 'indexBlock') return this.#insertLive('index');
    if (action === 'references') return this.#insertLive('references');
    if (action === 'markIndex') return this.#markIndex();
    if (action === 'cite') return this.#addCitation();
    if (action === 'codeBlock') return this.#insertCode();
    if (action === 'chart') {
      if (!this.$('#chart-grid')?.columns.length) {
        this.#chartRows([
          { label: 'Germany', value: 31149 },
          { label: 'France', value: 32458 },
          { label: 'Spain', value: 28900 },
          { label: 'Italy', value: 27400 },
        ]);
      }
      this.#drawChartPreview();
      return this.$('#chart-box').open();
    }
    if (action === 'formula') return this.$('#formula-box').open();
    if (action === 'footnote') return this.#footnote();
    if (action.startsWith('table')) return this.#tableAct(action.slice(5, 6).toLowerCase() + action.slice(6));
    if (action.startsWith('picture')) return this.#pictureAct(action.slice(7).toLowerCase());
    if (action === 'bigger' || action === 'smaller') return this.#stepSize(action === 'bigger' ? 1 : -1);
    if (action === 'zoomIn' || action === 'zoomOut') return this.#setZoom(this.#zoom + (action === 'zoomIn' ? 0.1 : -0.1));
    if (action === 'ruler') return this.#showRuler(!this.#ruler);
    if (action === 'side') {
      this.$('#panel').classList.toggle('away');
      return;
    }
    this.#run(action);
  }

  #insertCode() {
    const language = this.config.get('codeLanguage', 'javascript');
    this.#insertBlock(`<pre data-code="${language}"><code>const total = 0;</code></pre><p><br></p>`);
    toast(t('doc-editor.codeAdded', 'Code block added'));
  }

  #colourCode() {
    const editor = this.$('#editor');
    if (!editor) return;
    const selection = this.shadowRoot.getSelection?.() ?? window.getSelection();
    const anchor = selection?.anchorNode;

    for (const block of editor.querySelectorAll('pre[data-code]')) {
      // leave the one being typed in alone, colouring it would move the caret
      if (anchor && block.contains(anchor)) continue;
      const code = block.querySelector('code') ?? block;
      const text = code.textContent;
      const painted = highlight(text, block.dataset.code || 'plain').replace(
        /<span class="tok-([a-z]+)">/g,
        (whole, token) => `<span style="color:${TOKEN_COLOURS[token] ?? '#111111'}">`,
      );
      if (code.innerHTML !== painted) code.innerHTML = painted;
    }
  }

  #setCodeLanguage(language) {
    const selection = this.shadowRoot.getSelection?.() ?? window.getSelection();
    const anchor = selection?.anchorNode;
    const from = anchor?.nodeType === 1 ? anchor : anchor?.parentElement;
    const block = from?.closest?.('pre[data-code]');
    if (!block) return;
    block.dataset.code = language;
    this.config.set('codeLanguage', language);
    this.#sync();
  }

  #blockTitle(kind) {
    if (kind === 'contents') return t('doc-editor.contents', 'Contents');
    if (kind === 'index') return t('doc-editor.indexPage', 'Index');
    return t('doc-editor.references', 'References');
  }

  #insertLive(kind) {
    if (this.$(`[data-block="${kind}"]`)) {
      toast(t('doc-editor.blockAlreadyThere', 'That block is already in the document'), 'danger');
      return;
    }
    const title = this.#blockTitle(kind);
    const body = kind === 'references'
      ? `<ol data-list></ol>`
      : `<div data-list contenteditable="false"></div>`;
    this.#insertBlock(
      `<section data-block="${kind}"><h2 data-head>${title}</h2>${body}</section><p><br></p>`,
    );
    toast(t('doc-editor.blockAdded', '{title} added', { title }));
  }

  #addCitation() {
    let block = this.$('[data-block="references"]');
    if (!block) {
      this.#insertLive('references');
      block = this.$('[data-block="references"]');
      if (!block) return;
    }
    const list = block.querySelector('[data-list]');
    const id = `r${Date.now().toString(36)}`;

    const item = document.createElement('li');
    item.dataset.ref = id;
    item.textContent = t('doc-editor.sourceHere', 'Author, title, where it was published, year.');
    list.append(item);

    this.#insertNode(`<sup data-cite="${id}">1</sup>`);
    toast(t('doc-editor.citationAdded', 'Citation added, fill the entry in the references'));
  }

  #pageOf(index) {
    const at = this.#layout?.pages.findIndex((page) => (page.starts ?? []).includes(index)) ?? -1;
    return at === -1 ? 1 : at + 1;
  }

  #safe(text) {
    return String(text).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  }

  #markIndex() {
    const selection = this.shadowRoot.getSelection?.() ?? window.getSelection();
    const term = selection?.toString().trim();
    if (!term) {
      toast(t('doc-editor.selectSomeText', 'Select some text first'), 'danger');
      return;
    }
    if (!this.#wrapNode('span', { 'data-index': term.toLowerCase() })) return;
    this.#sync();
    toast(t('doc-editor.markedForIndex', '“{term}” goes in the index', { term }));
  }

  // the generated blocks are rebuilt from the document on every pass, so they
  // stay right as the writing moves between pages
  #fillBlocks() {
    for (const block of this.$$('[data-block]')) {
      const kind = block.dataset.block;
      const list = block.querySelector('[data-list]');
      if (!list) continue;
      if (kind === 'references') continue;
      list.innerHTML = kind === 'contents' ? this.#contentsRows() : this.#indexRows();
    }
    this.#numberCites();
  }

  // read from the page rather than the block model, so the headings the
  // generated blocks carry never list themselves
  #contentsRows() {
    const rows = [];
    this.#nodes().forEach((node, at) => {
      if (!/^H[1-6]$/.test(node.tagName) || node.closest('[data-block]')) return;
      const text = node.textContent.trim();
      if (!text) return;
      const pad = `margin-left:${(Number(node.tagName[1]) - 1) * 18}px`;
      rows.push(`<p style="${pad}" data-row>${this.#safe(text)}<span data-dots></span><span data-page>${this.#pageOf(at)}</span></p>`);
    });
    if (!rows.length) return `<p data-empty>${t('doc-editor.addHeadingsFirst', 'Add some headings first')}</p>`;
    return rows.join('');
  }

  #indexRows() {
    const nodes = [...this.$('#editor').querySelectorAll('[data-index]')].filter((node) => !node.closest('[data-block]'));
    if (!nodes.length) {
      return `<p data-empty>${t('doc-editor.markWordsForIndex', 'Select a word and mark it for the index')}</p>`;
    }
    const blocks = this.#nodes();
    const terms = new Map();
    for (const node of nodes) {
      const term = node.dataset.index || node.textContent.trim().toLowerCase();
      if (!term) continue;
      let owner = node;
      while (owner && !blocks.includes(owner)) owner = owner.parentElement;
      const page = this.#pageOf(blocks.indexOf(owner));
      const seen = terms.get(term) ?? new Set();
      seen.add(page);
      terms.set(term, seen);
    }
    return [...terms.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([term, pages]) => {
        const list = [...pages].sort((a, b) => a - b).join(', ');
        return `<p data-row>${this.#safe(term)}<span data-dots></span><span data-page>${list}</span></p>`;
      })
      .join('');
  }

  #numberCites() {
    const marks = [...this.$('#editor').querySelectorAll('sup[data-cite]')];
    const order = new Map();
    for (const mark of marks) {
      const id = mark.dataset.cite;
      if (!order.has(id)) order.set(id, order.size + 1);
      mark.textContent = String(order.get(id));
    }
    const list = this.$('[data-block="references"] [data-list]');
    if (!list) return;
    for (const item of list.children) {
      const number = order.get(item.dataset.ref ?? '');
      item.dataset.number = number ? String(number) : '';
    }
  }


  #footnote() {
    const editor = this.$('#editor');
    const marks = editor.querySelectorAll('sup[data-note]');
    const number = marks.length + 1;
    this.#insertNode(`<sup data-note="${number}">${number}</sup>`);
    let notes = editor.querySelector('[data-notes]');
    if (!notes) {
      this.#edge(true).insertAdjacentHTML(
        'beforeend',
        `<hr><h3 data-notes-head>${t('doc-editor.notes', 'Notes')}</h3><ol data-notes></ol>`,
      );
      notes = editor.querySelector('[data-notes]');
    }
    const item = document.createElement('li');
    item.innerHTML = '<br>';
    notes.append(item);
    this.#sync();
    toast(t('doc-editor.noteAdded', 'Note {number} added at the end', { number }));
  }

  #chartSpec() {
    const points = (this.$('#chart-grid')?.rows ?? [])
      .map((row) => ({ label: row.label ?? '', value: Number(row.value) }))
      .filter((point) => Number.isFinite(point.value));
    return {
      kind: this.$('#chart-kind')?.value ?? 'bar',
      title: this.$('#chart-title')?.value?.trim() ?? '',
      points,
    };
  }

  #chartRows(points) {
    const grid = this.$('#chart-grid');
    if (!grid) return;
    grid.columns = [
      { key: 'label', label: t('doc-editor.label', 'Label') },
      { key: 'value', label: t('doc-editor.value', 'Value'), type: 'number', align: 'right' },
    ];
    grid.rows = points.map((point) => ({ label: point.label ?? '', value: point.value ?? 0 }));
  }

  #drawChartPreview() {
    const canvas = this.$('#chart-preview');
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = 420 * ratio;
    canvas.height = 200 * ratio;
    drawChart(canvas, { ...this.#chartSpec(), font: 'Helvetica Neue, Arial, sans-serif' });
  }

  #insertChart() {
    const spec = this.#chartSpec();
    if (!spec.points.length) {
      toast(t('doc-editor.chartNeedsNumbers', 'Add at least one row with a number'), 'danger');
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 700;
    drawChart(canvas, { ...spec, font: 'Helvetica Neue, Arial, sans-serif' });
    this.$('#chart-box').close();
    this.#insertBlock(`<figure data-align="center" data-size="full"><img src="${canvas.toDataURL('image/png')}" alt=""></figure><p><br></p>`);
  }

  #insertFormula() {
    const field = this.$('#formula-source');
    const body = field?.html ?? '';
    if (!body.trim()) return;
    this.$('#formula-box').close();
    this.#insertNode(`<span class="maths">${body}</span>`);
  }

  #openExport() {
    const note = this.$('#running');
    if (note) {
      const bits = [];
      const plain = (markup) => {
        const holder = document.createElement('div');
        holder.innerHTML = markup ?? '';
        return holder.textContent.replace(/\s+/g, ' ').trim();
      };
      if (this.#header) bits.push(t('doc-editor.headerIs', 'header “{text}”', { text: plain(this.#header) }));
      if (this.#footer) bits.push(t('doc-editor.footerIs', 'footer “{text}”', { text: plain(this.#footer) }));
      note.textContent = bits.length
        ? t('doc-editor.runningNote', 'Every page carries {bits}.', { bits: bits.join(', ') })
        : t('doc-editor.runningNone', 'No header, footer or page numbers. Set them under Format.');
    }
    this.$('#export-box').open();
  }

  #snapshot() {
    return {
      html: this.#read(),
      header: this.#header,
      footer: this.#footer,
      numbers: this.#numbers,
      spacing: this.#spacing,
      columns: this.#columns,
    };
  }

  #newDocument() {
    this.#write('<h1><br></h1><p><br></p>');
    this.#name = t('doc-editor.untitled', 'Untitled document');
    this.#showName();
    this.#header = '';
    this.#footer = '';
    this.#numbers = false;
    this.$('#library-box')?.close();
    this.#sync();
  }

  #checklist() {
    const at = (this.shadowRoot.getSelection?.() ?? window.getSelection())?.anchorNode;
    const holder = (at?.nodeType === Node.TEXT_NODE ? at.parentElement : at)?.closest('li');
    if (holder) {
      const done = holder.dataset.done === 'true';
      holder.dataset.done = done ? 'false' : 'true';
      holder.classList.toggle('done', !done);
      this.#sync();
      return;
    }
    this.#run('insertUnorderedList');
    const fresh = (this.shadowRoot.getSelection?.() ?? window.getSelection())?.anchorNode;
    const item = (fresh?.nodeType === Node.TEXT_NODE ? fresh.parentElement : fresh)?.closest('li');
    if (item) {
      item.dataset.done = 'false';
      item.closest('ul')?.classList.add('checklist');
      this.#sync();
    }
  }

  #stepSize(step) {
    const picker = this.$('#size');
    const now = Number(picker.value) || 11;
    const at = SIZES.indexOf(now);
    const next = SIZES[Math.max(0, Math.min(SIZES.length - 1, (at === -1 ? SIZES.indexOf(11) : at) + step))];
    picker.value = String(next);
    this.#wrapStyle('fontSize', `${next}px`);
  }

  #setZoom(next) {
    this.#zoom = Math.max(0.5, Math.min(2, Math.round(next * 20) / 20));
    const label = this.$('#zoomat');
    if (label) label.textContent = `${Math.round(this.#zoom * 100)}%`;
    this.#fitPaper();
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

  #pictureNow() {
    return this.$('#editor')?.querySelector('figure.picked') ?? null;
  }

  #pictureAct(action) {
    const figure = this.#pictureNow();
    if (!figure) return;
    if (action === 'drop') {
      figure.remove();
      this.#sync();
      this.#reflect();
      return;
    }
    if (action === 'left' || action === 'center' || action === 'right') figure.dataset.align = action;
    else figure.dataset.size = action;
    this.#sync();
  }

  #cellNow() {
    const selection = this.shadowRoot.getSelection?.() ?? window.getSelection();
    let node = selection?.anchorNode ?? null;
    if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement;
    const cell = node?.closest?.('th, td');
    if (!cell) return null;
    const row = cell.closest('tr');
    const table = cell.closest('table');
    if (!row || !table || !this.$('#editor').contains(table)) return null;
    return {
      table,
      row,
      cell,
      column: [...row.children].indexOf(cell),
      line: [...table.rows].indexOf(row),
    };
  }

  #blankCell(like) {
    const cell = document.createElement(like?.tagName === 'TH' ? 'th' : 'td');
    cell.innerHTML = '<br>';
    return cell;
  }

  #tableAct(action) {
    const at = this.#cellNow();
    if (!at) return;
    const { table, row, cell, column } = at;

    if (action === 'rowAbove' || action === 'rowBelow') {
      const fresh = document.createElement('tr');
      for (const source of row.children) fresh.append(this.#blankCell(source.tagName === 'TH' ? null : source));
      row.parentNode.insertBefore(fresh, action === 'rowAbove' ? row : row.nextSibling);
    }

    if (action === 'columnLeft' || action === 'columnRight') {
      for (const line of table.rows) {
        const neighbour = line.children[column];
        const fresh = this.#blankCell(neighbour);
        if (action === 'columnLeft') line.insertBefore(fresh, neighbour ?? null);
        else line.insertBefore(fresh, neighbour ? neighbour.nextSibling : null);
      }
    }

    if (action === 'dropRow') {
      if (table.rows.length <= 1) return this.#tableAct('dropTable');
      row.remove();
    }

    if (action === 'dropColumn') {
      if ((table.rows[0]?.children.length ?? 0) <= 1) return this.#tableAct('dropTable');
      for (const line of table.rows) line.children[column]?.remove();
    }

    if (action === 'header') {
      const first = table.rows[0];
      if (first) {
        const toHead = first.children[0]?.tagName !== 'TH';
        for (const source of [...first.children]) {
          const swap = document.createElement(toHead ? 'th' : 'td');
          swap.innerHTML = source.innerHTML;
          source.replaceWith(swap);
        }
      }
    }

    if (action === 'dropTable') {
      const after = document.createElement('p');
      after.innerHTML = '<br>';
      table.replaceWith(after);
      const range = document.createRange();
      range.setStart(after, 0);
      const selection = this.shadowRoot.getSelection?.() ?? window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      this.#sync();
      this.#reflect();
      return;
    }

    const landing = table.contains(cell) ? cell : table.rows[0]?.children[0];
    if (landing) {
      const range = document.createRange();
      range.selectNodeContents(landing);
      range.collapse(true);
      const selection = this.shadowRoot.getSelection?.() ?? window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
    this.#sync();
    this.#reflect();
  }

  #shadeCell(colour) {
    const at = this.#cellNow();
    if (!at) return;
    at.cell.style.backgroundColor = colour === 'transparent' ? '' : colour;
    this.#sync();
  }

  #showContext(x, y) {
    const menu = this.$('#context');
    if (!menu) return;
    const selection = (this.shadowRoot.getSelection?.() ?? window.getSelection())?.toString() ?? '';
    const inTable = Boolean(this.#cellNow());
    const onPicture = Boolean(this.#pictureNow());

    const entry = (act, label, keys = '') => `<button data-act="${act}">${label}<em>${keys}</em></button>`;
    const rule = '<div class="rule"></div>';
    const parts = [];

    if (selection.trim()) {
      parts.push(entry('bold', t('doc-editor.bold', 'Bold'), 'Ctrl B'));
      parts.push(entry('italic', t('doc-editor.italic', 'Italic'), 'Ctrl I'));
      parts.push(entry('link', t('doc-editor.insertLink', 'Insert link'), 'Ctrl K'));
      parts.push(entry('case', t('doc-editor.changeCase', 'Change the case')));
      parts.push(entry('removeFormat', t('doc-editor.clearFormatting', 'Clear formatting')));
      parts.push(rule);
    }
    if (inTable) {
      parts.push(entry('tableRowBelow', t('doc-editor.rowBelow', 'Row below')));
      parts.push(entry('tableColumnRight', t('doc-editor.columnRight', 'Column to the right')));
      parts.push(entry('tableDropRow', t('doc-editor.deleteRow', 'Delete this row')));
      parts.push(rule);
    }
    if (onPicture) {
      parts.push(entry('pictureCenter', t('doc-editor.centre', 'Centre')));
      parts.push(entry('pictureDrop', t('doc-editor.removePicture', 'Remove the picture')));
      parts.push(rule);
    }
    parts.push(entry('table', t('doc-editor.insertTable', 'Insert table')));
    parts.push(entry('image', t('doc-editor.insertPicture', 'Insert picture')));
    parts.push(entry('pageBreak', t('doc-editor.pageBreak', 'Page break'), 'Alt Enter'));
    parts.push(entry('footnote', t('doc-editor.footnote', 'Footnote')));

    menu.innerHTML = parts.join('');
    menu.hidden = false;
    const box = menu.getBoundingClientRect();
    const room = document.documentElement;
    menu.style.left = `${Math.min(x, room.clientWidth - box.width - 12)}px`;
    menu.style.top = `${Math.min(y, room.clientHeight - box.height - 12)}px`;
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
    if (text) this.#insertNode(`<a href="${safe}">${text.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</a>`);
    else this.#run('createLink', url);
  }

  #reflect() {
    const picture = this.#pictureNow();
    const pictureBar = this.$('#imagebar');
    if (pictureBar) pictureBar.hidden = !picture;

    const at = this.#cellNow();
    const bar = this.$('#tablebar');
    if (bar) {
      bar.hidden = !at;
      if (at) {
        this.$('#cellat').textContent = t('doc-editor.rowAndColumn', 'row {row}, column {column}', {
          row: at.line + 1,
          column: at.column + 1,
        });
      }
    }

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
      orientation: this.config.get('orientation', 'portrait'),
      margin: Number(this.config.get('margin', '72')),
      font: this.config.get('bodyFont', 'helvetica'),
      spacing: this.#spacing,
      columns: this.#columns,
    };
  }

  #applyPaper() {
    const paper = this.#paper();
    const sheet = layoutDocument([], paper);
    const editor = this.$('#editor');
    if (!editor) return;
    const scale = 96 / 72;

    const pt = (points) => `${(points * scale).toFixed(2)}px`;
    for (const [kind, style] of Object.entries(BLOCK_STYLE)) {
      editor.style.setProperty(`--size-${kind}`, pt(style.size));
      editor.style.setProperty(`--before-${kind}`, pt(style.before ?? 0));
      editor.style.setProperty(`--after-${kind}`, pt(style.after ?? 0));
    }
    editor.style.setProperty('--lead', String(paper.spacing ?? 1.45));
    editor.style.setProperty('--sheet-pad', `${Math.round(paper.margin * scale)}px`);
    this.#setWidth(sheet.width * scale);
  }

  #setWidth(pixels) {
    const value = `${Math.round(pixels)}px`;
    for (const id of ['#editor', '#paper', '#papercage']) {
      this.$(id)?.style.setProperty('--sheet-width', value);
    }
    this.#fitPaper();
  }

  #fitPaper() {
    const stage = this.$('#stage');
    const cage = this.$('#papercage');
    const paper = this.$('#paper');
    if (!stage || !cage || !paper) return;
    const sheet = parseFloat(getComputedStyle(cage).getPropertyValue('--sheet-width')) || 794;
    const room = stage.clientWidth - 44;
    const fit = Math.min(1, Math.max(0.35, room / sheet));
    this.#scale = fit * this.#zoom;
    cage.style.setProperty('--zoom', String(this.#scale));
    paper.style.setProperty('--zoom', String(this.#scale));
    cage.style.height = `${Math.ceil(paper.offsetHeight * this.#scale)}px`;
    this.#drawRuler();
  }

  #sync() {
    this.#keep();
    this.#stamp += 1;
    this.#tidy();
    this.#blocks = htmlToBlocks(this.#flow());
    this.#layout = layoutDocument(this.#blocks, this.#paper());
    this.#spread();
    this.#drawRunners();
    this.#fillBlocks();
    this.#colourCode();
    this.#live();
    this.#drawRuler();
    this.#drawThumbs();
    this.#drawOutline();
    const counts = countWords(this.#blocks);
    this.$('#counts').textContent = t('doc-editor.counts', '{words} words · {characters} characters', counts);
    this.$('#pages').textContent = t('doc-editor.pageCount', '{count} pages', { count: this.#layout.pages.length });
  }

  #paint(canvas, page, scale) {
    const context = canvas.getContext('2d');
    const style = getComputedStyle(this);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const ratio = canvas.width / (page.width ?? this.#layout.width);
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

  #showRuler(on) {
    this.#ruler = Boolean(on);
    this.config.set('ruler', this.#ruler ? 'on' : 'off');
    this.#drawRuler();
  }

  #drawRuler() {
    const host = this.$('#ruler');
    if (!host) return;
    host.hidden = !this.#ruler;
    if (!this.#ruler || !this.#layout) return;

    const leaves = this.#leaves();
    const live = leaves.findIndex((leaf) => leaf.classList.contains('live'));
    const page = this.#layout.pages[live < 0 ? 0 : live] ?? this.#layout.pages[0];
    const scale = (96 / 72) * this.#scale;
    const imperial = /letter|legal|tabloid/.test(this.config.get('size', 'a4'));
    const unit = imperial ? 72 : 28.3465;
    const parts = imperial ? 4 : 2;

    const track = this.$('#track');
    track.style.width = `${Math.round(page.width * scale)}px`;
    const paper = this.$('#paper')?.getBoundingClientRect();
    if (paper) track.style.left = `${Math.round(paper.left - host.getBoundingClientRect().left)}px`;

    const marks = [
      `<span class="edge" style="left:0;width:${Math.round(page.margin * scale)}px"></span>`,
      `<span class="edge" style="right:0;width:${Math.round(page.margin * scale)}px"></span>`,
    ];

    const step = unit / parts;
    for (let at = page.margin; at <= page.width - page.margin + 0.01; at += step) {
      const from = Math.round(((at - page.margin) / unit) * parts);
      const whole = from % parts === 0;
      marks.push(`<span class="tick" style="left:${Math.round(at * scale)}px;height:${whole ? 8 : 4}px"></span>`);
      if (whole && from) marks.push(`<span class="num" style="left:${Math.round(at * scale)}px">${from / parts}</span>`);
    }
    for (let at = page.margin - step; at >= 0; at -= step) {
      const from = Math.round(((page.margin - at) / unit) * parts);
      if (from % parts) continue;
      marks.push(`<span class="tick" style="left:${Math.round(at * scale)}px;height:8px"></span>`);
      if (from) marks.push(`<span class="num" style="left:${Math.round(at * scale)}px">${from / parts}</span>`);
    }

    track.innerHTML = marks.join('');
  }

  #live() {
    const selection = this.shadowRoot.getSelection?.() ?? window.getSelection();
    const anchor = selection?.anchorNode;
    const here = anchor && (anchor.nodeType === 1 ? anchor : anchor.parentElement)?.closest?.('.leaf');
    const focused = this.shadowRoot.activeElement === this.$('#editor');
    for (const leaf of this.#leaves()) leaf.classList.toggle('live', focused && leaf === here);
  }

  #tidy() {
    for (const leaf of this.#leaves()) {
      for (const node of [...leaf.children]) {
        if (node.tagName !== 'DIV' || node.dataset.runner || node.querySelector('img')) continue;
        const mark = this.#mark();
        const swap = document.createElement('p');
        swap.innerHTML = node.innerHTML;
        for (const { name, value } of node.attributes) swap.setAttribute(name, value);
        node.replaceWith(swap);
        this.#place(mark);
      }
    }
  }

  #leaves() {
    return [...(this.$('#editor')?.children ?? [])].filter((node) => node.classList?.contains('leaf'));
  }

  #flow() {
    const editor = this.$('#editor');
    const children = [];
    for (const node of editor?.children ?? []) {
      if (node.classList?.contains('leaf')) children.push(...[...node.children].filter((kid) => !kid.dataset?.runner));
      else if (!node.dataset?.runner) children.push(node);
    }
    return { children };
  }

  #nodes() {
    return blockNodes(this.#flow());
  }

  #read() {
    return this.#leaves()
      .map((leaf) => [...leaf.children].filter((kid) => !kid.dataset?.runner).map((kid) => kid.outerHTML).join(''))
      .join('');
  }

  #write(markup) {
    const editor = this.$('#editor');
    if (!editor) return;
    editor.innerHTML = '';
    const leaf = document.createElement('div');
    leaf.className = 'leaf';
    leaf.innerHTML = markup ?? '';
    editor.append(leaf);
  }

  #edge(last) {
    const leaves = this.#leaves();
    if (leaves.length) return last ? leaves[leaves.length - 1] : leaves[0];
    this.#write('');
    return this.#leaves()[0];
  }

  #mark() {
    const selection = this.shadowRoot.getSelection?.() ?? window.getSelection();
    const anchor = selection?.anchorNode;
    if (!anchor) return null;
    const nodes = this.#nodes();
    const at = nodes.findIndex((node) => node === anchor || node.contains(anchor));
    if (at < 0) return null;
    const range = document.createRange();
    range.selectNodeContents(nodes[at]);
    try {
      range.setEnd(anchor, selection.anchorOffset);
    } catch {
      return { at, offset: 0 };
    }
    return { at, offset: range.toString().length };
  }

  #place(mark) {
    if (!mark) return;
    const node = this.#nodes()[mark.at];
    if (!node) return;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let seen = 0;
    let target = null;
    let offset = 0;
    while (walker.nextNode()) {
      const text = walker.currentNode;
      const length = text.textContent.length;
      if (seen + length >= mark.offset) {
        target = text;
        offset = mark.offset - seen;
        break;
      }
      seen += length;
    }
    const range = document.createRange();
    if (target) range.setStart(target, Math.min(offset, target.textContent.length));
    else range.selectNodeContents(node);
    range.collapse(true);
    const selection = this.shadowRoot.getSelection?.() ?? window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  #holder(node) {
    let top = node;
    for (let up = node.parentElement; up && !up.classList?.contains('leaf'); up = up.parentElement) {
      if (up.tagName === 'UL' || up.tagName === 'OL' || up.dataset?.block) top = up;
    }
    return top;
  }

  #carve(nodes, homes) {
    for (let at = 1; at < nodes.length; at += 1) {
      if (homes[at] === homes[at - 1]) continue;
      const node = nodes[at];
      if (node.tagName !== 'LI') continue;
      const list = node.parentElement;
      if (!list || !list.parentElement?.classList?.contains('leaf')) continue;
      if (!list.contains(nodes[at - 1])) continue;

      const rest = list.cloneNode(false);
      if (list.tagName === 'OL') {
        const from = Number(list.getAttribute('start')) || 1;
        rest.setAttribute('start', String(from + [...list.children].indexOf(node)));
      }
      const tail = [];
      for (let item = node; item; item = item.nextElementSibling) tail.push(item);
      rest.append(...tail);
      list.after(rest);
    }
  }

  #spread() {
    const editor = this.$('#editor');
    if (!editor || !this.#layout) return;

    const scale = 96 / 72;
    const pages = this.#layout.pages;
    const nodes = this.#nodes();
    const owner = new Map();
    pages.forEach((page, index) => {
      for (const at of page.starts ?? []) owner.set(at, index);
    });

    const homes = [];
    let on = 0;
    nodes.forEach((node, at) => {
      if (owner.has(at)) on = owner.get(at);
      homes[at] = on;
    });

    this.#carve(nodes, homes);

    const want = pages.map(() => []);
    nodes.forEach((node, at) => {
      const holder = this.#holder(node);
      const list = want[homes[at]];
      if (list[list.length - 1] !== holder) list.push(holder);
    });

    const leaves = this.#leaves();
    while (leaves.length < pages.length) {
      const leaf = document.createElement('div');
      leaf.className = 'leaf';
      editor.append(leaf);
      leaves.push(leaf);
    }
    while (leaves.length > pages.length) leaves.pop().remove();

    const settled = leaves.every((leaf, index) => {
      const held = [...leaf.children];
      return held.length === want[index].length && held.every((node, at) => node === want[index][at]);
    });

    if (!settled) {
      const mark = this.#mark();
      leaves.forEach((leaf, index) => leaf.append(...want[index]));
      this.#place(mark);
    }

    let wide = 0;
    pages.forEach((page, index) => {
      const leaf = leaves[index];
      leaf.dataset.page = String(index + 1);
      leaf.style.width = `${Math.round(page.width * scale)}px`;
      leaf.style.minHeight = `${Math.round(page.height * scale)}px`;
      leaf.style.padding = `${Math.round(page.margin * scale)}px`;
      if (page.columns > 1) leaf.dataset.columns = String(page.columns);
      else delete leaf.dataset.columns;
      wide = Math.max(wide, page.width * scale);
    });

    this.#setWidth(wide);
  }

  #addPage() {
    const last = this.#edge(true);
    this.#insertBlock('<hr data-break="page"><p><br></p>', last);
    const pages = this.#layout?.pages.length ?? 1;
    this.#goToPage(pages - 1);
    toast(t('doc-editor.pageAdded', 'Page {number} added', { number: pages }));
  }

  #goToPage(index) {
    const leaf = this.#leaves()[index];
    leaf?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  // documents written before the runners were editable held plain text and a
  // switch for page numbers
  #asRunner(value, numbers = false) {
    let markup = value ?? '';
    if (markup && !/[<>]/.test(markup)) markup = this.#safe(markup);
    if (numbers) {
      const tail = '<span data-mark="page"></span> / <span data-mark="pages"></span>';
      markup = markup ? `${markup} · ${tail}` : `<span style="text-align:right">${tail}</span>`;
    }
    return markup;
  }

  #runnerHtml(where) {
    return where === 'header' ? this.#header : this.#footer;
  }

  #setRunner(where, markup) {
    if (where === 'header') this.#header = markup;
    else this.#footer = markup;
  }

  #markValue(id, index, total) {
    if (id === 'page') return String(index + 1);
    if (id === 'pages') return String(total);
    if (id === 'title') return this.#name;
    if (id === 'date') return new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date());
    return '';
  }

  // the stored runner keeps its placeholders, each page gets them filled in
  #fillRunner(markup, index, total) {
    const holder = document.createElement('div');
    holder.innerHTML = markup ?? '';
    for (const mark of holder.querySelectorAll('[data-mark]')) {
      mark.textContent = this.#markValue(mark.dataset.mark, index, total);
    }
    return holder.innerHTML;
  }

  #drawRunners() {
    const leaves = this.#leaves();
    const total = leaves.length;

    leaves.forEach((leaf, index) => {
      const inset = Math.round((parseFloat(getComputedStyle(leaf).paddingTop) || 96) / 2);
      for (const where of ['header', 'footer']) {
        let runner = leaf.querySelector(`[data-runner="${where}"]`);
        if (!runner) {
          runner = document.createElement('div');
          runner.className = 'runner';
          runner.dataset.runner = where;
          runner.contentEditable = 'false';
          leaf.append(runner);
        }
        if (where === 'header') runner.style.top = `${inset - 7}px`;
        else runner.style.bottom = `${inset - 7}px`;
        runner.dataset.hint = where === 'header'
          ? t('doc-editor.doubleClickHeader', 'Double click to write a header')
          : t('doc-editor.doubleClickFooter', 'Double click to write a footer');
        if (runner === this.#editingRunner) continue;
        runner.innerHTML = this.#fillRunner(this.#runnerHtml(where), index, total);
        runner.dataset.empty = String(!runner.textContent.trim());
      }
    });
  }

  #editRunner(runner) {
    if (!runner || this.#editingRunner === runner) return;
    this.#closeRunner();

    const where = runner.dataset.runner;
    this.#editingRunner = runner;
    runner.contentEditable = 'true';
    runner.dataset.editing = 'true';
    runner.innerHTML = this.#runnerHtml(where) || '';
    if (!runner.querySelector('[data-line]')) {
      const line = document.createElement('div');
      line.dataset.line = '';
      while (runner.firstChild) line.append(runner.firstChild);
      runner.append(line);
    }
    runner.dataset.empty = 'false';

    const bar = this.$('#runbar');
    bar.hidden = false;
    this.$('#runwhat').textContent =
      where === 'header' ? t('doc-editor.headerText', 'Header') : t('doc-editor.footerText', 'Footer');

    const range = document.createRange();
    range.selectNodeContents(runner.querySelector('[data-line]'));
    range.collapse(false);
    const selection = this.shadowRoot.getSelection?.() ?? window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    runner.focus();
  }

  #closeRunner() {
    const runner = this.#editingRunner;
    if (!runner) return;
    const holds = runner.textContent.trim() || runner.querySelector('[data-mark]');
    this.#setRunner(runner.dataset.runner, holds ? runner.innerHTML.trim() : '');
    runner.contentEditable = 'false';
    delete runner.dataset.editing;
    this.#editingRunner = null;
    this.$('#runbar').hidden = true;
    this.#keep();
    this.#drawRunners();
  }

  #runnerAct(what) {
    const runner = this.#editingRunner;
    const line = runner?.querySelector('[data-line]');
    if (!line) return;
    if (what === 'clear') line.innerHTML = '';
    else line.style.textAlign = what;
    this.#setRunner(runner.dataset.runner, runner.innerHTML.trim());
    runner.focus();
  }

  #addMark(id) {
    const runner = this.#editingRunner;
    const mark = MARKS.find((entry) => entry.id === id);
    if (!runner || !mark) return;

    const chip = document.createElement('span');
    chip.dataset.mark = id;
    chip.textContent = mark.label();

    const selection = this.shadowRoot.getSelection?.() ?? window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (range && runner.contains(range.commonAncestorContainer)) {
      range.deleteContents();
      range.insertNode(chip);
      const after = document.createRange();
      after.setStartAfter(chip);
      after.collapse(true);
      selection.removeAllRanges();
      selection.addRange(after);
    } else {
      (runner.querySelector('[data-line]') ?? runner).append(chip);
    }
    this.#setRunner(runner.dataset.runner, runner.innerHTML.trim());
    runner.focus();
  }

  // what PDF and Word need: one line of plain text with its alignment
  #runnerFor(where) {
    const markup = this.#runnerHtml(where);
    if (!markup) return null;
    const holder = document.createElement('div');
    holder.innerHTML = markup;
    const align = /text-align:\s*(center|right)/.exec(markup)?.[1] ?? 'left';
    return (index, total) => {
      const copy = holder.cloneNode(true);
      for (const mark of copy.querySelectorAll('[data-mark]')) {
        mark.textContent = this.#markValue(mark.dataset.mark, index, total);
      }
      const text = copy.textContent.replace(/\s+/g, ' ').trim();
      return text ? [{ text, align }] : null;
    };
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

    for (let index = 0; index < this.#layout.pages.length; index += 1) {
      const card = host.children[index];
      const page = this.#layout.pages[index];
      card.dataset.page = String(index);
      card.dataset.drawn = '';
      const canvas = card.querySelector('canvas');
      const wide = page.width >= page.height;
      const thumbWidth = wide ? 150 : Math.round(width * (page.width / this.#layout.width));
      canvas.style.width = `${thumbWidth}px`;
      canvas.style.height = `${Math.round((page.height / page.width) * thumbWidth)}px`;
      card.querySelector('span').textContent = String(index + 1);
    }

    this.#watch();
    this.#paintVisible();
  }

  #watch() {
    const host = this.$('#thumbs');
    if (!host || this.#eye) return;
    this.#eye = true;
    this.on(host, 'scroll', () => this.#paintVisible(), { passive: true });
  }

  #paintThumb(card) {
    const index = Number(card.dataset.page);
    const page = this.#layout?.pages[index];
    if (!page || card.dataset.drawn === String(this.#stamp)) return;
    const canvas = card.querySelector('canvas');
    const ratio = window.devicePixelRatio || 1;
    const wide = page.width >= page.height;
    const width = wide ? 150 : Math.round(132 * (page.width / this.#layout.width));
    const height = Math.round((page.height / page.width) * width);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    this.#paint(canvas, page, ratio);
    card.dataset.drawn = String(this.#stamp);
  }

  #paintVisible() {
    const host = this.$('#thumbs');
    if (!host) return;
    const box = host.getBoundingClientRect();
    for (const card of host.children) {
      const spot = card.getBoundingClientRect();
      if (spot.bottom > box.top - 260 && spot.top < box.bottom + 260) this.#paintThumb(card);
    }
  }

  #drawOutline() {
    const host = this.$('#outline');
    if (!host) return;
    const entries = outlineOf(this.#blocks);
    host.innerHTML = entries.length
      ? html`${entries.map((entry) => html`<button class="line" data-index="${entry.index}" style="padding-left:${8 + (entry.level - 1) * 12}px">${entry.text}</button>`)}`
      : html`<div class="hint">${t('doc-editor.noHeadings', 'Headings you add will appear here.')}</div>`;
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
    if (kind === 'doc') return this.#saveStudio();
    if (kind === 'pdf' || kind === 'print') return this.#savePdf(kind === 'print');
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

  #saveStudio() {
    const file = {
      kind: 'jsglobe.document',
      version: 1,
      name: this.#name,
      saved: new Date().toISOString(),
      size: this.config.get('size', 'a4'),
      orientation: this.config.get('orientation', 'portrait'),
      margin: Number(this.config.get('margin', '72')),
      font: this.config.get('bodyFont', 'helvetica'),
      ...this.#snapshot(),
    };
    download(`${this.#name}.jgdoc`, JSON.stringify(file, null, 2), 'application/json');
    toast(t('doc-editor.savedStudio', 'Saved as a Studio document'));
  }

  #loadStudio(text) {
    const file = JSON.parse(text);
    if (file?.kind !== 'jsglobe.document' || typeof file.html !== 'string') throw new Error('not a studio document');

    if (file.size) this.config.set('size', file.size);
    if (file.orientation) this.config.set('orientation', file.orientation);
    if (Number.isFinite(file.margin)) this.config.set('margin', String(file.margin));
    if (file.font) this.config.set('bodyFont', file.font);

    this.#header = file.header ?? '';
    this.#footer = file.footer ?? '';
    this.#numbers = Boolean(file.numbers);
    this.#spacing = Number(file.spacing) || 1.6;
    this.#columns = Number(file.columns) || 1;
    this.$('#spacing').value = String(this.#spacing);
    this.$('#columns').value = String(this.#columns);
    this.$('#editor').style.lineHeight = String(this.#spacing);

    this.#write(file.html);
    this.#applyPaper();
    return file.name;
  }

  async #savePdf(toPrinter = false) {
    const paper = this.#paper();
    const blocks = await this.#withPictures();
    const layout = layoutDocument(blocks, paper);
    const bytes = layoutToPdf(layout, {
      ...paper,
      title: this.#name,
      creator: 'Toolbox',
      header: this.#runnerFor('header'),
      footer: this.#runnerFor('footer'),
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
    const picked = await pickFile('.jgdoc,.txt,.md,.markdown,.html,.htm,.docx', false);
    if (!picked) return;
    let name = picked.name.replace(/\.[^.]+$/, '');
    try {
      if (/\.jgdoc$/i.test(picked.name)) {
        const text = typeof picked.data === 'string' ? picked.data : new TextDecoder().decode(picked.data);
        name = this.#loadStudio(text) || name;
      } else if (/\.docx$/i.test(picked.name)) {
        const zip = await readZip(picked.data);
        const xml = await zip.text('word/document.xml');
        if (!xml) throw new Error('empty');
        this.#write(docxToHtml(xml));
      } else {
        const text = typeof picked.data === 'string' ? picked.data : new TextDecoder().decode(picked.data);
        if (/\.html?$/i.test(picked.name)) {
          const body = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(text);
          this.#write((body ? body[1] : text).replace(/<script[\s\S]*?<\/script>/gi, ''));
        } else if (/\.(md|markdown)$/i.test(picked.name)) {
          this.#write(markdownToHtml(text));
        } else {
          this.#write(text
            .split(/\n{2,}/)
            .map((piece) => `<p>${piece.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])).replace(/\n/g, '<br>')}</p>`)
            .join(''));
        }
      }
      this.#name = name || this.#name;
      this.#showName();
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
