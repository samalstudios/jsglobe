import { JGElement, define, css, html } from '../core/dom.js';
import { base } from './styles.js';
import { icon } from './icons.js';

const sheet = css`
  :host { display: block; }
  table { width: 100%; border-collapse: collapse; }
  th {
    text-align: left;
    font: 600 10px/1 var(--font-sans);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted-foreground);
    padding: 0 6px 6px;
    white-space: nowrap;
  }
  th.right { text-align: right; }
  td { padding: 2px 3px; vertical-align: middle; }
  td.grip, td.drop { width: 30px; padding: 2px 0; }

  input {
    width: 100%;
    height: 30px;
    padding: 0 9px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--card);
    color: var(--foreground);
    font: 500 12.5px/1 var(--font-sans);
    outline: 0;
  }
  input:focus { border-color: var(--ring); }
  input.number { font-family: var(--font-mono); text-align: right; }

  .icon {
    width: 26px;
    height: 26px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 0;
    background: transparent;
    color: var(--muted-foreground);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }
  .icon:hover { background: var(--accent); color: var(--foreground); }
  .grip .icon { cursor: grab; }
  tr[data-lift="true"] { opacity: 0.45; }
  tr[data-over="true"] td { box-shadow: inset 0 2px 0 var(--ring); }

  .foot { display: flex; align-items: center; gap: 8px; margin-top: 7px; }
  .add {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 10px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--card);
    color: var(--foreground);
    font: 500 12px/1 var(--font-sans);
    cursor: pointer;
  }
  .add:hover { border-color: var(--ring); }
  .hint { font: 400 11px/1.4 var(--font-sans); color: var(--muted-foreground); }
`;

const clean = (value) => String(value ?? '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

const split = (text) => text
  .replace(/\r/g, '')
  .split('\n')
  .filter((line) => line.trim())
  .map((line) => (line.includes('\t') ? line.split('\t') : line.split(',')).map((cell) => cell.trim()));

class JGTable extends JGElement {
  static styles = [base, sheet];

  #columns = [];
  #rows = [];
  #lift = -1;

  set columns(list) {
    this.#columns = (list ?? []).map((column) => (typeof column === 'object' ? column : { key: column, label: column }));
    this.refresh();
  }

  get columns() {
    return this.#columns;
  }

  set rows(list) {
    this.#rows = (list ?? []).map((row) => ({ ...row }));
    this.refresh();
  }

  get rows() {
    return this.#rows.map((row) => ({ ...row }));
  }

  get least() {
    return Number(this.getAttribute('least')) || 0;
  }

  blank() {
    const row = {};
    for (const column of this.#columns) row[column.key] = column.type === 'number' ? 0 : '';
    return row;
  }

  addRow(row) {
    this.#rows.push({ ...this.blank(), ...(row ?? {}) });
    this.refresh();
    this.#tell();
    const cells = this.$$('input');
    cells[(this.#rows.length - 1) * this.#columns.length]?.focus();
  }

  render() {
    const columns = this.#columns;
    if (columns.length && !this.#rows.length && this.least) {
      for (let at = 0; at < this.least; at += 1) this.#rows.push(this.blank());
    }

    this.paint(html`
      <table>
        <thead>
          <tr>
            ${this.hasAttribute('no-order') ? '' : html`<th></th>`}
            ${columns.map((column) => html`<th class="${column.align === 'right' ? 'right' : ''}">${column.label ?? column.key}</th>`)}
            ${this.hasAttribute('no-remove') ? '' : html`<th></th>`}
          </tr>
        </thead>
        <tbody>
          ${this.#rows.map((row, at) => html`<tr data-row="${at}" draggable="${String(!this.hasAttribute('no-order'))}">
            ${this.hasAttribute('no-order') ? '' : html`<td class="grip"><span class="icon" aria-hidden="true">${icon('more', 13)}</span></td>`}
            ${columns.map((column) => html`<td><input
              class="${column.type === 'number' ? 'number' : ''}"
              type="${column.type === 'number' ? 'number' : 'text'}"
              step="${column.type === 'number' ? 'any' : ''}"
              data-key="${column.key}"
              placeholder="${column.placeholder ?? ''}"
              value="${clean(row[column.key])}"></td>`)}
            ${this.hasAttribute('no-remove') ? '' : html`<td class="drop"><button class="icon" data-drop="${at}"
              title="${this.getAttribute('remove-label') ?? 'Remove'}">${icon('rowRemove', 14)}</button></td>`}
          </tr>`)}
        </tbody>
      </table>
      <div class="foot">
        ${this.hasAttribute('no-add') ? '' : html`<button class="add" type="button" id="add">${icon('plus', 12)}${this.getAttribute('add-label') ?? 'Add a row'}</button>`}
        <span class="hint">${this.getAttribute('hint') ?? ''}</span>
      </div>
    `);

    this.on(this.$('tbody'), 'input', (event) => {
      const field = event.target.closest('input');
      const row = field?.closest('[data-row]');
      if (!field || !row) return;
      const column = columns.find((entry) => entry.key === field.dataset.key);
      const value = column?.type === 'number' ? Number(field.value) : field.value;
      this.#rows[Number(row.dataset.row)][field.dataset.key] = value;
      this.#tell();
    });

    this.on(this.$('tbody'), 'keydown', (event) => this.#keys(event));
    this.on(this.$('tbody'), 'paste', (event) => this.#paste(event));

    this.on(this.$('tbody'), 'click', (event) => {
      const button = event.target.closest('[data-drop]');
      if (!button) return;
      this.#remove(Number(button.dataset.drop));
    });

    this.on(this.$('tbody'), 'dragstart', (event) => {
      const row = event.target.closest('[data-row]');
      if (!row) return;
      this.#lift = Number(row.dataset.row);
      row.dataset.lift = 'true';
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', String(this.#lift));
    });

    this.on(this.$('tbody'), 'dragover', (event) => {
      if (this.#lift < 0) return;
      event.preventDefault();
      const row = event.target.closest('[data-row]');
      for (const other of this.$$('[data-row]')) other.dataset.over = String(other === row);
    });

    this.on(this.$('tbody'), 'drop', (event) => {
      const row = event.target.closest('[data-row]');
      if (this.#lift < 0 || !row) return;
      event.preventDefault();
      this.#shift(this.#lift, Number(row.dataset.row));
    });

    this.on(this.$('tbody'), 'dragend', () => {
      this.#lift = -1;
      for (const other of this.$$('[data-row]')) {
        delete other.dataset.over;
        delete other.dataset.lift;
      }
    });

    const add = this.$('#add');
    if (add) this.on(add, 'click', () => this.addRow());
  }

  #keys(event) {
    const field = event.target.closest('input');
    const row = field?.closest('[data-row]');
    if (!field || !row) return;
    const at = Number(row.dataset.row);
    const column = this.#columns.findIndex((entry) => entry.key === field.dataset.key);

    if (event.key === 'Enter') {
      event.preventDefault();
      if (at === this.#rows.length - 1) return this.addRow();
      return this.#jump(at + 1, column);
    }
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && event.altKey) {
      event.preventDefault();
      return this.#shift(at, at + (event.key === 'ArrowDown' ? 1 : -1));
    }
    if (event.key === 'ArrowDown' && at < this.#rows.length - 1) {
      event.preventDefault();
      return this.#jump(at + 1, column);
    }
    if (event.key === 'ArrowUp' && at > 0) {
      event.preventDefault();
      return this.#jump(at - 1, column);
    }
    if (event.key === 'Backspace' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      this.#remove(at);
    }
  }

  #paste(event) {
    const text = event.clipboardData?.getData('text/plain') ?? '';
    const grid = split(text);
    if (grid.length < 2 && (grid[0]?.length ?? 0) < 2) return;
    event.preventDefault();

    const field = event.target.closest('input');
    const from = Number(field?.closest('[data-row]')?.dataset.row ?? 0);
    const start = Math.max(0, this.#columns.findIndex((entry) => entry.key === field?.dataset.key));

    grid.forEach((cells, line) => {
      const at = from + line;
      if (!this.#rows[at]) this.#rows[at] = this.blank();
      cells.forEach((cell, offset) => {
        const column = this.#columns[start + offset];
        if (!column) return;
        this.#rows[at][column.key] = column.type === 'number' ? Number(cell.replace(/[^0-9.eE+-]/g, '')) : cell;
      });
    });

    this.refresh();
    this.#tell();
  }

  #jump(row, column) {
    const cells = this.$$('input');
    const field = cells[row * this.#columns.length + Math.max(0, column)];
    field?.focus();
    field?.select?.();
  }

  #remove(at) {
    if (this.#rows.length <= this.least) return;
    this.#rows.splice(at, 1);
    this.refresh();
    this.#tell();
  }

  #shift(from, to) {
    if (to < 0 || to >= this.#rows.length || from === to) return;
    const [row] = this.#rows.splice(from, 1);
    this.#rows.splice(to, 0, row);
    this.refresh();
    this.#tell();
    this.#jump(to, 0);
  }

  #tell() {
    this.emit('change', { rows: this.rows });
  }
}

define('jg-table', JGTable);
