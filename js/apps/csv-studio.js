import { JGApp, define, html, css } from '../core/app.js';
import { debounce, copyText, download, toast, formatBytes } from '../core/util.js';

const sheet = css`
  .grid-wrap {
    flex: 1;
    min-height: 200px;
    overflow: auto;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    scrollbar-width: thin;
  }
  table { border-collapse: separate; border-spacing: 0; width: max-content; min-width: 100%; font-size: 12.5px; }
  th, td {
    border-bottom: 1px solid var(--border);
    border-right: 1px solid var(--border);
    padding: 0;
    max-width: 320px;
  }
  thead th {
    position: sticky;
    top: 0;
    z-index: 2;
    background: color-mix(in srgb, var(--muted) 92%, var(--background));
    backdrop-filter: blur(6px);
  }
  .head {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 9px;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
    user-select: none;
  }
  .head .sort { color: var(--muted-foreground); font-size: 10px; }
  .num {
    position: sticky;
    left: 0;
    z-index: 1;
    background: color-mix(in srgb, var(--muted) 70%, var(--background));
    color: var(--muted-foreground);
    font-family: var(--font-mono);
    font-size: 10.5px;
    text-align: right;
    padding: 0 8px;
    user-select: none;
  }
  thead .num { z-index: 3; }
  .cell {
    display: block;
    padding: 5px 9px;
    min-width: 60px;
    outline: none;
    white-space: pre;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cell:focus { background: color-mix(in srgb, var(--ring) 14%, transparent); box-shadow: inset 0 0 0 1px var(--ring); }
  tbody tr:hover .cell { background: color-mix(in srgb, var(--foreground) 4%, transparent); }
  .drop {
    display: grid;
    place-items: center;
    flex: none;
    min-height: 90px;
    border: 1px dashed var(--border-strong);
    border-radius: var(--radius-md);
    color: var(--muted-foreground);
    font-size: 13px;
    cursor: pointer;
    padding: 12px;
    text-align: center;
  }
  .drop[data-over="true"] { border-color: var(--ring); color: var(--foreground); }
  .panes { display: grid; grid-template-columns: 1fr; gap: 10px; flex: 1; min-height: 0; }
`;

const DELIMITERS = { ',': 'Comma', ';': 'Semicolon', '\t': 'Tab', '|': 'Pipe' };

const sniff = (text) => {
  const line = text.split(/\r?\n/).find((entry) => entry.trim()) ?? '';
  const counts = Object.keys(DELIMITERS).map((delimiter) => [delimiter, line.split(delimiter).length - 1]);
  const best = counts.sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? best[0] : ',';
};

const parse = (text, delimiter) => {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  const source = text.replace(/^﻿/, '');

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (quoted) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        value += character;
      }
      continue;
    }

    if (character === '"' && !value) {
      quoted = true;
      continue;
    }
    if (character === delimiter) {
      row.push(value);
      value = '';
      continue;
    }
    if (character === '\n' || character === '\r') {
      if (character === '\r' && source[index + 1] === '\n') index += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
      continue;
    }
    value += character;
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  const width = rows.reduce((max, entry) => Math.max(max, entry.length), 0);
  return rows.map((entry) => Array.from({ length: width }, (item, index) => entry[index] ?? ''));
};

const escapeCell = (value, delimiter) =>
  new RegExp(`["\\n\\r${delimiter === '|' ? '\\|' : delimiter}]`).test(value) ? `"${value.replace(/"/g, '""')}"` : value;

const toCsv = (rows, delimiter) => rows.map((row) => row.map((cell) => escapeCell(String(cell ?? ''), delimiter)).join(delimiter)).join('\n');

const asNumber = (value) => {
  const text = String(value).trim().replace(/,/g, '');
  if (!text || Number.isNaN(Number(text))) return null;
  return Number(text);
};

const typed = (value) => {
  const number = asNumber(value);
  if (number !== null && String(value).trim() !== '') return number;
  if (/^(true|false)$/i.test(String(value).trim())) return String(value).trim().toLowerCase() === 'true';
  return value;
};

const objects = (rows, headers) =>
  rows.map((row) => Object.fromEntries(headers.map((header, index) => [header || `column${index + 1}`, typed(row[index] ?? '')])));

const sqlValue = (value) => {
  const parsed = typed(value);
  if (typeof parsed === 'number') return String(parsed);
  if (typeof parsed === 'boolean') return parsed ? 'true' : 'false';
  if (parsed === '') return 'NULL';
  return `'${String(parsed).replace(/'/g, "''")}'`;
};

const markdown = (rows, headers) => {
  const widths = headers.map((header, index) =>
    Math.max(String(header).length, ...rows.map((row) => String(row[index] ?? '').length)),
  );
  const line = (cells) => `| ${cells.map((cell, index) => String(cell ?? '').padEnd(widths[index])).join(' | ')} |`;
  return [line(headers), `| ${widths.map((width) => '-'.repeat(Math.max(3, width))).join(' | ')} |`, ...rows.map((row) => line(row))].join('\n');
};

const MAX_RENDER = 300;

class CsvStudio extends JGApp {
  static appId = 'csv-studio';
  static styles = [...JGApp.styles, sheet];

  #rows = [];
  #headers = [];
  #delimiter = ',';
  #sort = null;
  #filter = '';
  #name = 'data';

  renderApp() {
    this.paint(html`<div class="app">
      <jg-toolbar id="bar"></jg-toolbar>

      <div class="drop" id="drop">Drop a CSV or TSV file here, or click to choose one</div>

      <div class="row">
        <jg-input id="filter" size="sm" placeholder="Filter rows" style="flex:1;min-width:160px"></jg-input>
        <jg-select id="delimiter" size="sm" style="width:140px">
          ${Object.entries(DELIMITERS).map(([value, label]) => html`<option value="${value === '\t' ? 'tab' : value}">${label}</option>`)}
        </jg-select>
        <jg-switch id="header" checked></jg-switch><span class="hint">First row is a header</span>
        <span class="grow"></span>
        <span class="hint" id="stats"></span>
      </div>

      <div class="panes">
        <div class="grid-wrap" id="wrap">
          <table id="table"></table>
        </div>
      </div>

      <jg-field label="Paste or export" id="textfield">
        <jg-code id="text" rows="8" gutter language="plain" placeholder="name,role,city"></jg-code>
      </jg-field>
    </div>`);

    this.$('#bar').items = [
      { id: 'csv', label: 'CSV', icon: 'list', select: true },
      { id: 'json', label: 'JSON', icon: 'braces', select: true },
      { id: 'jsonl', label: 'JSON lines', icon: 'code', select: true },
      { id: 'sql', label: 'SQL', icon: 'database', select: true },
      { id: 'markdown', label: 'Markdown', icon: 'fileText', select: true },
      { separator: true },
      { id: 'row', label: 'Add row', icon: 'plus' },
      { id: 'column', label: 'Add column', icon: 'grid' },
      { id: 'tidy', label: 'Tidy', icon: 'undo', title: 'Trim spaces, drop empty rows and duplicates' },
      { spacer: true },
      { id: 'copy', label: 'Copy', icon: 'copy' },
      { id: 'download', label: 'Download', icon: 'external' },
    ];
    this.$('#bar').value = 'csv';

    this.on(this.$('#bar'), 'select', (event) => this.#action(event.detail.id));

    const picker = document.createElement('input');
    picker.type = 'file';
    picker.accept = '.csv,.tsv,.txt,text/csv,text/tab-separated-values';
    const drop = this.$('#drop');

    this.on(drop, 'click', () => picker.click());
    this.on(picker, 'change', () => this.#loadFile(picker.files[0]));
    this.on(drop, 'dragover', (event) => {
      event.preventDefault();
      drop.dataset.over = 'true';
    });
    this.on(drop, 'dragleave', () => {
      drop.dataset.over = 'false';
    });
    this.on(drop, 'drop', (event) => {
      event.preventDefault();
      drop.dataset.over = 'false';
      this.#loadFile(event.dataTransfer.files[0]);
    });

    this.on(this.$('#text'), 'input', debounce(() => {
      if (this.$('#bar').value !== 'csv') return;
      this.#ingest(this.$('#text').value, { keepText: true });
    }, 350));

    this.on(this.$('#filter'), 'input', debounce((event) => {
      this.#filter = event.target.value.trim().toLowerCase();
      this.#paintTable();
    }, 160));

    this.on(this.$('#delimiter'), 'change', (event) => {
      this.#delimiter = event.detail.value === 'tab' ? '\t' : event.detail.value;
      this.#paintOutput();
    });

    this.on(this.$('#header'), 'change', () => this.#ingest(toCsv([this.#headers, ...this.#rows], this.#delimiter)));

    const saved = this.store.read({ text: '' });
    const text = saved.text || 'name,role,city\nAda,engineer,London\nGrace,admiral,New York\nAlan,researcher,Cambridge';
    this.#delimiter = sniff(text);
    this.$('#delimiter').value = this.#delimiter === '\t' ? 'tab' : this.#delimiter;
    this.#ingest(text);
  }

  #ingest(text, { keepText = false } = {}) {
    if (!text.trim()) {
      this.#headers = [];
      this.#rows = [];
      this.#paintTable();
      return;
    }

    this.#delimiter = this.#delimiter || sniff(text);
    const table = parse(text, this.#delimiter);
    const useHeader = this.$('#header').checked;

    this.#headers = useHeader
      ? table[0].map((cell, index) => cell || `column${index + 1}`)
      : table[0].map((cell, index) => `column${index + 1}`);
    this.#rows = useHeader ? table.slice(1) : table;

    this.store.write({ text: toCsv([this.#headers, ...this.#rows], this.#delimiter) });
    this.#paintTable();
    if (!keepText) this.#paintOutput();
  }

  async #loadFile(file) {
    if (!file) return;
    const text = await file.text();
    this.#name = file.name.replace(/\.[^.]+$/, '');
    this.#delimiter = sniff(text);
    this.$('#delimiter').value = this.#delimiter === '\t' ? 'tab' : this.#delimiter;
    this.$('#drop').textContent = `${file.name} - ${formatBytes(file.size)}`;
    this.#ingest(text);
    this.$('#bar').value = 'csv';
  }

  #visible() {
    let rows = this.#rows.map((row, index) => ({ row, index }));

    if (this.#filter) {
      rows = rows.filter(({ row }) => row.some((cell) => String(cell).toLowerCase().includes(this.#filter)));
    }

    if (this.#sort) {
      const { column, direction } = this.#sort;
      rows = [...rows].sort((left, right) => {
        const a = left.row[column] ?? '';
        const b = right.row[column] ?? '';
        const na = asNumber(a);
        const nb = asNumber(b);
        const result = na !== null && nb !== null ? na - nb : String(a).localeCompare(String(b), undefined, { numeric: true });
        return direction === 'asc' ? result : -result;
      });
    }

    return rows;
  }

  #paintTable() {
    const rows = this.#visible();
    const shown = rows.slice(0, MAX_RENDER);
    const arrow = (index) => (this.#sort?.column === index ? (this.#sort.direction === 'asc' ? '▲' : '▼') : '');

    this.$('#table').innerHTML = html`
      <thead>
        <tr>
          <th class="num">#</th>
          ${this.#headers.map(
            (header, index) => html`<th><span class="head" data-column="${index}">${header}<span class="sort">${arrow(index)}</span></span></th>`,
          )}
        </tr>
      </thead>
      <tbody>
        ${shown.map(
          ({ row, index }) => html`<tr>
            <td class="num">${index + 1}</td>
            ${this.#headers.map(
              (header, column) => html`<td><span class="cell" contenteditable="plaintext-only" data-row="${index}" data-col="${column}">${row[column] ?? ''}</span></td>`,
            )}
          </tr>`,
        )}
      </tbody>
    `;

    this.$('#stats').textContent = `${this.#rows.length} rows - ${this.#headers.length} columns${
      rows.length > MAX_RENDER ? ` - showing first ${MAX_RENDER}` : ''
    }${this.#filter ? ` - ${rows.length} match the filter` : ''}`;

    this.bind('[data-column]', 'click', (event) => {
      const column = Number(event.currentTarget.dataset.column);
      const direction = this.#sort?.column === column && this.#sort.direction === 'asc' ? 'desc' : 'asc';
      this.#sort = { column, direction };
      this.#paintTable();
    });

    this.bind('.cell', 'blur', (event) => {
      const { row, col } = event.currentTarget.dataset;
      const next = event.currentTarget.textContent;
      if (this.#rows[Number(row)][Number(col)] === next) return;
      this.#rows[Number(row)][Number(col)] = next;
      this.#paintOutput();
      this.store.write({ text: toCsv([this.#headers, ...this.#rows], this.#delimiter) });
    });
  }

  #paintOutput() {
    const format = this.$('#bar').value;
    const code = this.$('#text');
    const field = this.$('#textfield');
    const rows = this.#visible().map(({ row }) => row);

    const languages = { csv: 'plain', json: 'json', jsonl: 'json', sql: 'sql', markdown: 'markdown' };
    code.language = languages[format] ?? 'plain';
    code.toggleAttribute('readonly', format !== 'csv');
    field.setAttribute('label', format === 'csv' ? 'Paste or export' : `Export as ${format}`);

    if (format === 'csv') {
      code.value = toCsv([this.#headers, ...this.#rows], this.#delimiter);
      return;
    }
    if (format === 'json') {
      code.value = JSON.stringify(objects(rows, this.#headers), null, 2);
      return;
    }
    if (format === 'jsonl') {
      code.value = objects(rows, this.#headers).map((entry) => JSON.stringify(entry)).join('\n');
      return;
    }
    if (format === 'sql') {
      const table = this.#name.replace(/[^\w]+/g, '_').toLowerCase() || 'data';
      const columns = this.#headers.map((header) => header.replace(/[^\w]+/g, '_').toLowerCase());
      code.value = rows
        .map((row) => `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${row.map(sqlValue).join(', ')});`)
        .join('\n');
      return;
    }
    code.value = markdown(rows, this.#headers);
  }

  #action(id) {
    if (['csv', 'json', 'jsonl', 'sql', 'markdown'].includes(id)) return this.#paintOutput();

    if (id === 'row') {
      this.#rows.push(this.#headers.map(() => ''));
      this.#paintTable();
      return this.#paintOutput();
    }
    if (id === 'column') {
      this.#headers.push(`column${this.#headers.length + 1}`);
      this.#rows.forEach((row) => row.push(''));
      this.#paintTable();
      return this.#paintOutput();
    }
    if (id === 'tidy') {
      const seen = new Set();
      const before = this.#rows.length;
      this.#rows = this.#rows
        .map((row) => row.map((cell) => String(cell).trim()))
        .filter((row) => row.some((cell) => cell !== ''))
        .filter((row) => {
          const key = row.join(' ');
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      this.#headers = this.#headers.map((header) => header.trim());
      this.#paintTable();
      this.#paintOutput();
      toast(`Removed ${before - this.#rows.length} empty or duplicate rows`);
      return undefined;
    }
    if (id === 'copy') return copyText(this.$('#text').value);
    if (id === 'download') {
      const extensions = { csv: 'csv', json: 'json', jsonl: 'jsonl', sql: 'sql', markdown: 'md' };
      const format = this.$('#bar').value;
      return download(`${this.#name}.${extensions[format]}`, this.$('#text').value, 'text/plain');
    }
    return undefined;
  }
}

define('jg-app-csv-studio', CsvStudio);
