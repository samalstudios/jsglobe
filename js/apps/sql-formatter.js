import { JGApp, define, html, css } from '../core/app.js';
import { escapeHtml } from '../core/dom.js';
import { copyText, debounce } from '../core/util.js';

const sheet = css`
  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; flex: 1; min-height: 0; }
  @media (max-width: 760px) { .split { grid-template-columns: 1fr; } }
  .pane { display: flex; flex-direction: column; gap: 6px; min-height: 0; }
  .view {
    flex: 1;
    min-height: 200px;
    overflow: auto;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    background: color-mix(in srgb, var(--muted) 72%, transparent);
    font-family: var(--font-mono);
    font-size: 12.5px;
    line-height: 1.7;
    white-space: pre;
  }
  .kw { color: var(--syn-bool); font-weight: 600; }
  .str { color: var(--syn-str); }
  .num { color: var(--syn-num); }
  .cmt { color: var(--muted-foreground); font-style: italic; }
`;

const MAIN = ['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'OFFSET', 'UNION ALL', 'UNION', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'RETURNING', 'WITH'];
const JOINS = ['LEFT OUTER JOIN', 'RIGHT OUTER JOIN', 'FULL OUTER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'CROSS JOIN', 'JOIN'];
const KEYWORDS = [...MAIN, ...JOINS, 'ON', 'AND', 'OR', 'NOT', 'IN', 'AS', 'IS', 'NULL', 'LIKE', 'BETWEEN', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'ASC', 'DESC', 'EXISTS', 'CREATE TABLE', 'ALTER TABLE', 'DROP TABLE', 'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'DEFAULT'];

const SAMPLE =
  "select u.id, u.name, count(o.id) as orders from users u left join orders o on o.user_id = u.id where u.created_at > '2024-01-01' and u.active = true group by u.id, u.name having count(o.id) > 3 order by orders desc limit 20";

const format = (sql, { uppercase = true, indent = 2 } = {}) => {
  const spacer = ' '.repeat(indent);
  let out = sql.replace(/\s+/g, ' ').trim();

  const pattern = new RegExp(`\\b(${[...MAIN, ...JOINS].map((word) => word.replace(/ /g, '\\s+')).join('|')})\\b`, 'gi');
  out = out.replace(pattern, (match) => `\n${uppercase ? match.toUpperCase() : match}`);
  out = out.replace(/\b(and|or)\b/gi, (match) => `\n${spacer}${uppercase ? match.toUpperCase() : match}`);
  out = out.replace(/,\s*/g, `,\n${spacer}`);
  out = out.replace(/\bon\b/gi, (match) => (uppercase ? match.toUpperCase() : match));

  if (uppercase) {
    const words = new RegExp(`\\b(${KEYWORDS.map((word) => word.replace(/ /g, '\\s+')).join('|')})\\b`, 'gi');
    out = out.replace(words, (match) => match.toUpperCase());
  }

  return out
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line, index) => line.trim() || index)
    .join('\n')
    .trim();
};

const highlight = (sql) => {
  const words = new RegExp(`\\b(${KEYWORDS.map((word) => word.replace(/ /g, '\\s+')).join('|')})\\b`, 'gi');
  return escapeHtml(sql)
    .replace(/(--[^\n]*)/g, '<span class="cmt">$1</span>')
    .replace(/('(?:[^']|'')*')/g, '<span class="str">$1</span>')
    .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="num">$1</span>')
    .replace(words, (match) => `<span class="kw">${match}</span>`);
};

class SqlFormatter extends JGApp {
  static appId = 'sql-formatter';
  static styles = [...JGApp.styles, sheet];

  renderApp() {
    this.paint(html`<div class="app">
      <div class="row">
        <jg-switch id="upper" checked></jg-switch><span class="hint">Uppercase keywords</span>
        <jg-select id="indent" value="2" size="sm" style="width:130px">
          <option value="2">2 spaces</option><option value="4">4 spaces</option>
        </jg-select>
        <span class="grow"></span>
        <jg-button size="sm" variant="outline" id="sample">Sample</jg-button>
        <jg-button size="sm" variant="outline" id="copy">Copy</jg-button>
      </div>

      <div class="split">
        <div class="pane">
          <span class="label">Input</span>
          <jg-code id="input" grow gutter language="sql" placeholder="select * from users where id = 1"></jg-code>
        </div>
        <div class="pane">
          <span class="label">Formatted</span>
          <div class="view" id="output"></div>
        </div>
      </div>
    </div>`);

    const run = debounce(() => this.#run(), 150);
    this.on(this.$('#input'), 'input', run);
    this.on(this.$('#upper'), 'change', () => this.#run());
    this.on(this.$('#indent'), 'change', () => this.#run());
    this.on(this.$('#sample'), 'click', () => {
      this.$('#input').value = SAMPLE;
      this.#run();
    });
    this.on(this.$('#copy'), 'click', () => copyText(this.$('#output').textContent));

    this.$('#input').value = SAMPLE;
    this.#run();
  }

  #run() {
    const source = this.$('#input').value.trim();
    const output = this.$('#output');
    if (!source) {
      output.innerHTML = '';
      return;
    }
    const formatted = format(source, {
      uppercase: this.$('#upper').checked,
      indent: Number(this.$('#indent').value),
    });
    output.innerHTML = highlight(formatted);
  }
}

define('jg-app-sql-formatter', SqlFormatter);
