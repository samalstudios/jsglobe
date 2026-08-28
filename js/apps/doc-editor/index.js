import { JGApp, define, html, raw, styleSheet } from '../../core/app.js';
import { appText } from '../../core/i18n.js';
import strings from './i18n.js';
import { icon } from '../../ui/icons.js';
import { toast, download, debounce, pickFile } from '../../core/util.js';
import { createDesigns } from '../../lib/designs.js';
import { toJpeg } from '../../lib/raster.js';
import { drawChart, parseSeries } from '../../lib/chart.js';
import { SAMPLES as FORMULAS } from '../../lib/formula.js';
import { readZip } from '../../core/zip.js';
import { htmlToBlocks, blockNodes, blocksToHtml, blocksToText, blocksToMarkdown, markdownToHtml, outlineOf, countWords } from '../../lib/richtext.js';
import { layoutDocument, layoutToPdf } from '../../lib/doc-layout.js';
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
            <button class="tool" data-act="contents" title="${t('doc-editor.tableOfContents', 'Table of contents')}">${icon('list', 16)}</button>
            <button class="tool" data-act="chart" title="${t('doc-editor.chart', 'Chart')}">${icon('barChart', 16)}</button>
            <button class="tool" data-act="formula" title="${t('doc-editor.formula', 'Formula')}">${icon('sigma', 16)}</button>
            <button class="tool" data-act="footnote" title="${t('doc-editor.footnote', 'Footnote')}">${icon('quote', 16)}</button>
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
          <div class="outline" id="outline" hidden></div>
        </aside>

        <div class="stage" id="stage">
          <div class="sheetwrap" id="sheetwrap">
            <div class="paper" id="paper">
              <div class="guides" id="guides" aria-hidden="true"></div>
              <div class="page" id="editor" contenteditable="true" spellcheck="true" role="textbox" aria-multiline="true"></div>
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

      <jg-dialog id="chart-box" title-text="${t('doc-editor.chart', 'Chart')}" sub="${t('doc-editor.chartHint', 'One row per point: a label, a comma, then the number.')}">
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
        <table class="datagrid" id="chart-grid">
          <thead><tr><th>${t('doc-editor.label', 'Label')}</th><th>${t('doc-editor.value', 'Value')}</th><th></th></tr></thead>
          <tbody id="chart-rows"></tbody>
        </table>
        <div class="row tight">
          <jg-button size="sm" variant="outline" id="chart-add">${t('doc-editor.addRow', 'Add a row')}</jg-button>
          <jg-button size="sm" variant="ghost" id="chart-paste">${t('doc-editor.pasteRows', 'Paste rows')}</jg-button>
        </div>
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

    const editor = this.$('#editor');
    editor.innerHTML = STARTER;

    this.#wire();
    this.#restore();
    this.#applyPaper();
    this.#showName();
    this.#sync();
  }

  #restore() {
    const saved = this.store.read();
    const open = saved?.current;
    if (open?.html) {
      this.$('#editor').innerHTML = open.html;
      this.#name = open.name ?? this.#name;
      this.#header = open.header ?? '';
      this.#footer = open.footer ?? '';
      this.#numbers = Boolean(open.numbers);
      this.#spacing = Number(open.spacing) || 1.6;
      this.#columns = Number(open.columns) || 1;
      this.$('#spacing').value = String(this.#spacing);
      this.$('#columns').value = String(this.#columns);
      this.$('#editor').style.lineHeight = String(this.#spacing);
      if (this.#columns > 1) this.$('#editor').dataset.columns = String(this.#columns);
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
    this.on(editor, 'blur', () => this.#remember());
    this.listen(document, 'selectionchange', () => this.#remember());
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
      const page = this.$('#editor');
      if (this.#columns > 1) page.dataset.columns = String(this.#columns);
      else delete page.dataset.columns;
      this.#sync();
    });

    this.on(this.$('#imagebar'), 'mousedown', (event) => {
      if (event.target.closest('button')) event.preventDefault();
    });
    this.on(this.$('#imagebar'), 'click', (event) => {
      const button = event.target.closest('[data-picture]');
      if (button) this.#pictureAct(button.dataset.picture);
    });
    this.on(this.$('#editor'), 'click', (event) => {
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
        this.#insertNode(
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
        this.$('#editor').innerHTML = design.html ?? '';
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
    this.on(this.$('#chart-grid'), 'input', () => this.#drawChartPreview());
    this.on(this.$('#chart-grid'), 'click', (event) => {
      if (!event.target.closest('.g-drop')) return;
      event.target.closest('tr').remove();
      this.#drawChartPreview();
    });
    this.on(this.$('#chart-add'), 'click', () => {
      this.#chartRows([...this.#chartSpec().points, { label: '', value: 0 }]);
      this.#drawChartPreview();
    });
    this.on(this.$('#chart-paste'), 'click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        const points = parseSeries(text);
        if (!points.length) return toast(t('doc-editor.nothingToPaste', 'Nothing in the clipboard looked like rows'), 'danger');
        this.#chartRows(points);
        this.#drawChartPreview();
      } catch {
        toast(t('doc-editor.clipboardBlocked', 'The clipboard could not be read'), 'danger');
      }
    });
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
      this.#insertNode(`<figure data-align="center" data-size="medium"><img src="${data}" alt=""></figure><p><br></p>`);
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
    if (action === 'rule') return this.#insertNode('<hr><p><br></p>');
    if (action === 'table') {
      const head = `<tr><th>${t('doc-editor.column', 'Column')} 1</th><th>${t('doc-editor.column', 'Column')} 2</th><th>${t('doc-editor.column', 'Column')} 3</th></tr>`;
      const row = '<tr><td><br></td><td><br></td><td><br></td></tr>';
      return this.#insertNode(`<table>${head}${row}${row}</table><p><br></p>`);
    }
    if (action === 'find') return this.#toggleFind(true);
    if (action === 'case') return this.#changeCase();
    if (action === 'library') {
      this.#paintFiles();
      return this.$('#library-box').open();
    }
    if (action === 'openFile') return this.#openFile();
    if (action === 'exportFile') return this.#openExport();
    if (action === 'printNow') return this.#savePdf(true, this.#numbers, this.#footer);
    if (action === 'runningHead') {
      this.$('#head-text').value = this.#header;
      this.$('#foot-text').value = this.#footer;
      this.$('#head-numbers').checked = this.#numbers;
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
    if (action === 'pageBreak') return this.#insertNode('<hr data-break="page"><p><br></p>');
    if (action === 'today') {
      return this.#run('insertText', new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(new Date()));
    }
    if (action === 'checklist') return this.#checklist();
    if (action === 'contents') return this.#insertContents();
    if (action === 'chart') {
      if (!this.shadowRoot.querySelectorAll('#chart-rows tr').length) {
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
    if (action === 'side') {
      this.$('#panel').classList.toggle('away');
      return;
    }
    this.#run(action);
  }

  #insertContents() {
    const entries = outlineOf(this.#blocks);
    if (!entries.length) {
      toast(t('doc-editor.addHeadingsFirst', 'Add some headings first'), 'danger');
      return;
    }
    const pageFor = (index) => {
      const at = this.#layout.pages.findIndex((page) => (page.starts ?? []).includes(index));
      return at === -1 ? 1 : at + 1;
    };
    const rows = entries
      .map((entry) => {
        const pad = 'margin-left:' + (entry.level - 1) * 18 + 'px';
        return `<p style="${pad}">${entry.text.replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))} <span style="color:#7a828a">· ${pageFor(entry.index)}</span></p>`;
      })
      .join('');
    const editor = this.$('#editor');
    editor.insertAdjacentHTML(
      'afterbegin',
      `<h2>${t('doc-editor.contents', 'Contents')}</h2>${rows}<hr data-break="page">`,
    );
    this.#sync();
    toast(t('doc-editor.contentsAdded', 'Contents added at the top'));
  }

  #footnote() {
    const editor = this.$('#editor');
    const marks = editor.querySelectorAll('sup[data-note]');
    const number = marks.length + 1;
    this.#insertNode(`<sup data-note="${number}">${number}</sup>`);
    let notes = editor.querySelector('[data-notes]');
    if (!notes) {
      editor.insertAdjacentHTML(
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
    const points = [...this.shadowRoot.querySelectorAll('#chart-rows tr')]
      .map((row) => ({
        label: row.querySelector('.g-label')?.value ?? '',
        value: Number(row.querySelector('.g-value')?.value),
      }))
      .filter((point) => Number.isFinite(point.value));
    return {
      kind: this.$('#chart-kind')?.value ?? 'bar',
      title: this.$('#chart-title')?.value?.trim() ?? '',
      points,
    };
  }

  #chartRows(points) {
    const body = this.$('#chart-rows');
    if (!body) return;
    body.innerHTML = points
      .map(
        (point) =>
          `<tr><td><input class="g-label" value="${String(point.label ?? '').replace(/"/g, '&quot;')}"></td>` +
          `<td><input class="g-value" type="number" step="any" value="${point.value ?? ''}"></td>` +
          `<td><button class="g-drop" title="${t('doc-editor.removeRow', 'Remove')}">✕</button></td></tr>`,
      )
      .join('');
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
    this.#insertNode(`<figure data-align="center" data-size="full"><img src="${canvas.toDataURL('image/png')}" alt=""></figure><p><br></p>`);
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
      if (this.#header) bits.push(t('doc-editor.headerIs', 'header “{text}”', { text: this.#header }));
      if (this.#footer) bits.push(t('doc-editor.footerIs', 'footer “{text}”', { text: this.#footer }));
      if (this.#numbers) bits.push(t('doc-editor.numbersOn', 'page numbers'));
      note.textContent = bits.length
        ? t('doc-editor.runningNote', 'Every page carries {bits}.', { bits: bits.join(', ') })
        : t('doc-editor.runningNone', 'No header, footer or page numbers. Set them under Format.');
    }
    this.$('#export-box').open();
  }

  #snapshot() {
    return {
      html: this.$('#editor').innerHTML,
      header: this.#header,
      footer: this.#footer,
      numbers: this.#numbers,
      spacing: this.#spacing,
      columns: this.#columns,
    };
  }

  #newDocument() {
    this.$('#editor').innerHTML = '<h1><br></h1><p><br></p>';
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
    const paper = this.$('#paper');
    if (paper) paper.style.zoom = this.#zoom === 1 ? '' : String(this.#zoom);
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
    editor.style.setProperty('--sheet-width', `${Math.round(sheet.width * scale)}px`);
    editor.style.minHeight = `${Math.round(sheet.height * scale)}px`;
    editor.style.padding = `${Math.round(paper.margin * scale)}px`;
    editor.style.setProperty('--sheet-pad', `${Math.round(paper.margin * scale)}px`);
    const holder = this.$('#paper');
    if (holder) holder.style.setProperty('--sheet-width', `${Math.round(sheet.width * scale)}px`);
  }

  #sync() {
    this.#keep();
    this.#stamp += 1;
    this.#blocks = htmlToBlocks(this.$('#editor'));
    this.#layout = layoutDocument(this.#blocks, this.#paper());
    this.#drawThumbs();
    this.#sizeBreaks();
    this.#drawGuides();
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

  #sizeBreaks() {
    const editor = this.$('#editor');
    if (!editor || !this.#layout) return;

    const scale = 96 / 72;
    const margin = this.#layout.margin * scale;
    const usable = this.#layout.height * scale - margin * 2;
    if (usable <= 0) return;

    const breaks = [...editor.querySelectorAll('hr[data-break="page"]')];
    for (const rule of breaks) rule.style.height = '0px';

    for (const rule of breaks) {
      const origin = () => editor.getBoundingClientRect().top + margin;
      const top = rule.getBoundingClientRect().top - origin();
      const into = ((top % usable) + usable) % usable;
      let height = Math.max(0, Math.round(usable - into));
      rule.style.height = `${height}px`;

      const next = rule.nextElementSibling;
      if (!next) continue;
      for (let pass = 0; pass < 3; pass += 1) {
        const lands = next.getBoundingClientRect().top - origin();
        const slip = ((lands % usable) + usable) % usable;
        if (slip < 2 || Math.abs(slip - usable) < 2) break;
        height += slip > usable / 2 ? Math.round(usable - slip) : -Math.round(slip);
        height = Math.max(0, height);
        rule.style.height = `${height}px`;
      }
    }
  }

  #drawGuides() {
    const host = this.$('#guides');
    const editor = this.$('#editor');
    if (!host || !editor || !this.#layout) return;
    const nodes = blockNodes(editor);
    const top = editor.getBoundingClientRect().top;
    const marks = [];

    this.#layout.pages.forEach((page, index) => {
      if (!index) return;
      const first = page.starts?.[0];
      const opener = first === undefined ? null : nodes[first];
      if (opener) {
        const at = opener.getBoundingClientRect().top - top;
        if (at > 8) marks.push({ at, page: index + 1 });
        return;
      }
      const closer = nodes[this.#layout.pages[index - 1]?.last ?? -1];
      if (!closer) return;
      const box = closer.getBoundingClientRect();
      const at = box.bottom - top;
      if (at > 8) marks.push({ at, page: index + 1 });
    });

    host.innerHTML = marks
      .map((mark) => `<span class="guide" style="top:${Math.round(mark.at)}px"><b>${mark.page}</b></span>`)
      .join('');
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
    if (kind === 'pdf' || kind === 'print') return this.#savePdf(kind === 'print', this.#numbers, this.#footer);
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
      header: this.#header,
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
