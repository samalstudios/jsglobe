import { JGApp, define, html, styleSheet } from '../../core/app.js';
import { appWords } from '../../core/i18n.js';
import { escapeHtml } from '../../core/dom.js';
import { copyText, debounce, download } from '../../core/util.js';

const t = await appWords('markdown-preview', (lang) => import(`./i18n/${lang}.js`));

const sheet = await styleSheet(import.meta.url);

const SAMPLE = `# JS Globe

A **home screen** for small developer tools.

## Highlights

- Runs entirely in the browser
- Every tool has its own URL
- Works offline once loaded

> Nothing you paste ever leaves this tab.

\`\`\`js
const hash = await crypto.subtle.digest('SHA-256', bytes);
\`\`\`

| Tool | Category |
| --- | --- |
| JSON Formatter | Development |
| Hash Text | Crypto |

1. Open a tool
2. Paste your data
3. Copy the result

- [x] Custom elements
- [ ] Framework
`;

const inline = (text) =>
  escapeHtml(text)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" rel="noopener noreferrer" target="_blank">$1</a>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|\W)\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|\W)_([^_]+)_/g, '$1<em>$2</em>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>');

const render = (source) => {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let index = 0;

  const flushList = (ordered) => {
    const items = [];
    const pattern = ordered ? /^\s*\d+[.)]\s+(.*)$/ : /^\s*[-*+]\s+(.*)$/;
    while (index < lines.length && pattern.test(lines[index])) {
      let content = pattern.exec(lines[index])[1];
      content = content
        .replace(/^\[ \]\s*/, '<input type="checkbox" disabled>')
        .replace(/^\[x\]\s*/i, '<input type="checkbox" checked disabled>');
      items.push(`<li>${inline(content).replace(/&lt;input type="checkbox"( checked)? disabled&gt;/g, (match) => match.replace(/&lt;/g, '<').replace(/&gt;/g, '>'))}</li>`);
      index += 1;
    }
    out.push(ordered ? `<ol>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`);
  };

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (/^```/.test(line)) {
      const language = line.slice(3).trim();
      const body = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index])) {
        body.push(lines[index]);
        index += 1;
      }
      index += 1;
      out.push(`<pre><code data-lang="${escapeHtml(language)}">${escapeHtml(body.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      out.push('<hr>');
      index += 1;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const body = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        body.push(lines[index].replace(/^\s*>\s?/, ''));
        index += 1;
      }
      out.push(`<blockquote>${render(body.join('\n'))}</blockquote>`);
      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      flushList(false);
      continue;
    }

    if (/^\s*\d+[.)]\s+/.test(line)) {
      flushList(true);
      continue;
    }

    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|[\s:-]+\|\s*$/.test(lines[index + 1] ?? '')) {
      const header = line.split('|').slice(1, -1).map((cell) => cell.trim());
      index += 2;
      const rows = [];
      while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index])) {
        rows.push(lines[index].split('|').slice(1, -1).map((cell) => cell.trim()));
        index += 1;
      }
      out.push(
        `<table><thead><tr>${header.map((cell) => `<th>${inline(cell)}</th>`).join('')}</tr></thead><tbody>${rows
          .map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table>`,
      );
      continue;
    }

    const paragraph = [];
    while (index < lines.length && lines[index].trim() && !/^(#{1,6}\s|```|\s*[-*+]\s|\s*\d+[.)]\s|\s*>)/.test(lines[index])) {
      paragraph.push(lines[index]);
      index += 1;
    }
    out.push(`<p>${inline(paragraph.join('\n')).replace(/\n/g, '<br>')}</p>`);
  }

  return out.join('\n');
};

class MarkdownPreview extends JGApp {
  static appId = 'markdown-preview';
  static styles = [...JGApp.styles, sheet];

  renderApp() {
    this.paint(html`<div class="app">
      <div class="row">
        <jg-tabs id="mode"></jg-tabs>
        <span class="grow"></span>
        <span class="hint" id="stats"></span>
        <jg-button size="sm" variant="outline" id="sample">${t('markdown-preview.sample', 'Sample')}</jg-button>
        <jg-button size="sm" variant="outline" id="copy">${t('markdown-preview.copyHtml', 'Copy HTML')}</jg-button>
        <jg-button size="sm" variant="outline" id="save">${t('markdown-preview.download', 'Download')}</jg-button>
      </div>

      <div class="split">
        <div class="pane">
          <span class="label">${t('markdown-preview.markdown', 'Markdown')}</span>
          <jg-code id="input" grow gutter language="markdown" placeholder="${t('markdown-preview.title', '# Title')}"></jg-code>
        </div>
        <div class="pane">
          <span class="label" id="rightlabel">${t('markdown-preview.preview', 'Preview')}</span>
          <div class="preview" id="preview"></div>
          <jg-code id="htmlout" grow gutter language="html" readonly hidden></jg-code>
        </div>
      </div>
    </div>`);

    this.$('#mode').items = [
      { value: 'preview', label: t('markdown-preview.preview', 'Preview') },
      { value: 'html', label: 'HTML' },
    ];

    this.on(this.$('#input'), 'input', debounce(() => this.#run(), 150));
    this.on(this.$('#mode'), 'change', () => this.#run());
    this.on(this.$('#sample'), 'click', () => {
      this.$('#input').value = SAMPLE;
      this.#run();
    });
    this.on(this.$('#copy'), 'click', () => copyText(render(this.$('#input').value)));
    this.on(this.$('#save'), 'click', () =>
      download('document.html', `<!doctype html>\n<meta charset="utf-8">\n${render(this.$('#input').value)}\n`, 'text/html'),
    );

    this.$('#input').value = SAMPLE;
    this.#run();
  }

  #run() {
    const source = this.$('#input').value;
    const markup = render(source);
    const showHtml = this.$('#mode').value === 'html';

    this.$('#preview').hidden = showHtml;
    this.$('#htmlout').hidden = !showHtml;
    this.$('#rightlabel').textContent = showHtml ? 'Generated HTML' : 'Preview';
    this.$('#preview').innerHTML = markup;
    this.$('#htmlout').value = markup;
    this.$('#stats').textContent = `${source.split(/\s+/).filter(Boolean).length} words · ${markup.length} chars of HTML`;
  }
}

define('jg-app-markdown', MarkdownPreview);
