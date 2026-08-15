const BLOCK = new Set(['P', 'DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'MAIN', 'FIGURE', 'FIGCAPTION']);

const clean = (text) => text.replace(/ /g, ' ').replace(/[ \t]+/g, ' ');

const escape = (text) => text.replace(/([\\`*_[\]])/g, '\\$1');

const cell = (node, walk) => walk(node).replace(/\n+/g, ' ').replace(/\|/g, '\\|').trim();

export const htmlToMarkdown = (root) => {
  const walk = (node, depth = 0, order = null) => {
    if (node.nodeType === Node.TEXT_NODE) return escape(clean(node.textContent));
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const tag = node.tagName;
    const children = () => [...node.childNodes].map((child) => walk(child, depth, order)).join('');

    if (tag === 'BR') return '\n';
    if (tag === 'HR') return '\n\n---\n\n';
    if (/^H[1-6]$/.test(tag)) return `\n\n${'#'.repeat(Number(tag[1]))} ${children().trim()}\n\n`;
    if (tag === 'STRONG' || tag === 'B') {
      const inner = children().trim();
      return inner ? `**${inner}**` : '';
    }
    if (tag === 'EM' || tag === 'I') {
      const inner = children().trim();
      return inner ? `*${inner}*` : '';
    }
    if (tag === 'U') return children();
    if (tag === 'S' || tag === 'STRIKE' || tag === 'DEL') {
      const inner = children().trim();
      return inner ? `~~${inner}~~` : '';
    }
    if (tag === 'CODE' && node.closest('pre') === null) return `\`${node.textContent.trim()}\``;
    if (tag === 'PRE') return `\n\n\`\`\`\n${node.textContent.replace(/\n+$/, '')}\n\`\`\`\n\n`;
    if (tag === 'A') {
      const href = node.getAttribute('href');
      const inner = children().trim();
      if (!inner) return '';
      return href && !href.startsWith('#') ? `[${inner}](${href})` : inner;
    }
    if (tag === 'IMG') {
      const alt = node.getAttribute('alt') ?? '';
      const src = node.getAttribute('src') ?? '';
      return src ? `![${alt}](${src})` : '';
    }
    if (tag === 'BLOCKQUOTE') {
      const inner = children().trim().split('\n').map((line) => `> ${line}`.trimEnd()).join('\n');
      return `\n\n${inner}\n\n`;
    }
    if (tag === 'UL' || tag === 'OL') {
      const items = [...node.children].filter((child) => child.tagName === 'LI');
      const body = items
        .map((item, index) => {
          const marker = tag === 'OL' ? `${index + 1}.` : '-';
          const inner = walk(item, depth + 1, tag === 'OL' ? index + 1 : null)
            .trim()
            .split('\n')
            .map((line, position) => (position === 0 ? line : `  ${line}`))
            .join('\n');
          return `${'  '.repeat(depth)}${marker} ${inner}`;
        })
        .join('\n');
      return `\n\n${body}\n\n`;
    }
    if (tag === 'LI') return children();
    if (tag === 'TABLE') {
      const rows = [...node.querySelectorAll('tr')];
      if (!rows.length) return '';
      const grid = rows.map((row) => [...row.children].map((column) => cell(column, walk)));
      const width = Math.max(...grid.map((row) => row.length));
      const line = (cells) => `| ${Array.from({ length: width }, (item, index) => cells[index] ?? '').join(' | ')} |`;
      const [head, ...body] = grid;
      return `\n\n${[line(head), `| ${Array.from({ length: width }, () => '---').join(' | ')} |`, ...body.map(line)].join('\n')}\n\n`;
    }
    if (BLOCK.has(tag)) {
      const inner = children().trim();
      return inner ? `\n\n${inner}\n\n` : '';
    }
    return children();
  };

  return walk(root)
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
};

export const htmlToText = (root) =>
  htmlToMarkdown(root)
    .replace(/^#{1,6} /gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[(.*?)\]\(.*?\)/g, '$1')
    .replace(/\\([\\`*_[\]])/g, '$1');
