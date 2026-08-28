export const BLOCK_TAGS = {
  P: 'p', H1: 'h1', H2: 'h2', H3: 'h3', H4: 'h4', H5: 'h5', H6: 'h6',
  BLOCKQUOTE: 'quote', PRE: 'code', HR: 'rule', FIGURE: 'image', TABLE: 'table',
};

const MARKS = { B: 'bold', STRONG: 'bold', I: 'italic', EM: 'italic', U: 'underline', S: 'strike', STRIKE: 'strike', CODE: 'mono' };

const styleOf = (node) => {
  const marks = {};
  if (!node.style) return marks;
  const colour = node.style.color;
  const back = node.style.backgroundColor;
  const family = node.style.fontFamily;
  const size = node.style.fontSize;
  if (colour) marks.color = colour;
  if (back && back !== 'transparent') marks.highlight = back;
  if (family) marks.font = family.replace(/["']/g, '').split(',')[0].trim();
  if (size) marks.size = parseFloat(size);
  if (node.style.fontWeight === 'bold' || Number(node.style.fontWeight) >= 600) marks.bold = true;
  if (node.style.fontStyle === 'italic') marks.italic = true;
  const decoration = node.style.textDecorationLine || node.style.textDecoration;
  if (decoration?.includes('underline')) marks.underline = true;
  if (decoration?.includes('line-through')) marks.strike = true;
  if (node.style.verticalAlign === 'super') marks.sup = true;
  if (node.style.verticalAlign === 'sub') marks.sub = true;
  return marks;
};

const collectRuns = (node, inherited = {}, runs = []) => {
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.nodeValue.replace(/ /g, ' ');
      if (text) runs.push({ text, ...inherited });
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    if (child.tagName === 'BR') {
      runs.push({ text: '\n', ...inherited });
      continue;
    }
    const marks = { ...inherited, ...styleOf(child) };
    if (MARKS[child.tagName]) marks[MARKS[child.tagName]] = true;
    if (child.tagName === 'SUP') marks.sup = true;
    if (child.tagName === 'SUB') marks.sub = true;
    if (child.tagName === 'A') marks.link = child.getAttribute('href') ?? '';
    collectRuns(child, marks, runs);
  }
  return runs;
};

const tidy = (runs) => {
  const out = [];
  for (const run of runs) {
    if (!run.text) continue;
    const last = out[out.length - 1];
    const same =
      last &&
      last.bold === run.bold && last.italic === run.italic && last.underline === run.underline &&
      last.strike === run.strike && last.mono === run.mono && last.link === run.link &&
      last.color === run.color && last.highlight === run.highlight && last.font === run.font &&
      last.size === run.size && last.sup === run.sup && last.sub === run.sub;
    if (same) last.text += run.text;
    else out.push({ ...run });
  }
  return out;
};

const alignOf = (node) => {
  const value = node.style?.textAlign;
  return value === 'center' || value === 'right' || value === 'justify' ? value : 'left';
};

const listBlocks = (node, ordered, depth, out) => {
  for (const item of node.children) {
    if (item.tagName !== 'LI') continue;
    const nested = [...item.children].filter((child) => child.tagName === 'UL' || child.tagName === 'OL');
    const clone = item.cloneNode(true);
    [...clone.children].forEach((child) => {
      if (child.tagName === 'UL' || child.tagName === 'OL') child.remove();
    });
    out.push({
      type: ordered ? 'ordered' : 'bullet',
      depth,
      align: alignOf(item),
      runs: tidy(collectRuns(clone)),
    });
    for (const child of nested) listBlocks(child, child.tagName === 'OL', depth + 1, out);
  }
};

export function htmlToBlocks(root) {
  const blocks = [];
  for (const node of root.children) {
    const tag = node.tagName;
    if (tag === 'UL' || tag === 'OL') {
      listBlocks(node, tag === 'OL', 0, blocks);
      continue;
    }
    if (tag === 'HR') {
      blocks.push({ type: 'rule' });
      continue;
    }
    if (tag === 'FIGURE' || (tag === 'DIV' && node.querySelector('img'))) {
      const image = node.querySelector('img');
      if (image) blocks.push({ type: 'image', src: image.getAttribute('src'), width: image.width, height: image.height, align: alignOf(node) });
      continue;
    }
    if (tag === 'TABLE') {
      const rows = [...node.querySelectorAll('tr')].map((row) =>
        [...row.children].map((cell) => ({ head: cell.tagName === 'TH', runs: tidy(collectRuns(cell)) })),
      );
      if (rows.length) blocks.push({ type: 'table', rows });
      continue;
    }
    const kind = BLOCK_TAGS[tag] ?? 'p';
    blocks.push({
      type: kind,
      align: alignOf(node),
      indent: Number(node.dataset?.indent ?? 0) || 0,
      runs: tidy(collectRuns(node)),
    });
  }
  if (!blocks.length) blocks.push({ type: 'p', align: 'left', runs: [] });
  return blocks;
}

const escapeHtml = (text) =>
  String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const runHtml = (run) => {
  let out = escapeHtml(run.text).replace(/\n/g, '<br>');
  const styles = [];
  if (run.color) styles.push(`color:${run.color}`);
  if (run.highlight) styles.push(`background-color:${run.highlight}`);
  if (run.font) styles.push(`font-family:${run.font}`);
  if (run.size) styles.push(`font-size:${run.size}px`);
  if (styles.length) out = `<span style="${styles.join(';')}">${out}</span>`;
  if (run.mono) out = `<code>${out}</code>`;
  if (run.bold) out = `<b>${out}</b>`;
  if (run.italic) out = `<i>${out}</i>`;
  if (run.underline) out = `<u>${out}</u>`;
  if (run.strike) out = `<s>${out}</s>`;
  if (run.sup) out = `<sup>${out}</sup>`;
  if (run.sub) out = `<sub>${out}</sub>`;
  if (run.link) out = `<a href="${escapeHtml(run.link)}">${out}</a>`;
  return out;
};

const TAG_OF = { p: 'p', h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4', h5: 'h5', h6: 'h6', quote: 'blockquote', code: 'pre' };

export function blocksToHtml(blocks) {
  const out = [];
  let list = null;
  const closeList = () => {
    if (list) out.push(list.ordered ? '</ol>' : '</ul>');
    list = null;
  };

  for (const block of blocks) {
    if (block.type === 'bullet' || block.type === 'ordered') {
      const ordered = block.type === 'ordered';
      if (!list || list.ordered !== ordered) {
        closeList();
        out.push(ordered ? '<ol>' : '<ul>');
        list = { ordered };
      }
      out.push(`<li>${block.runs.map(runHtml).join('') || '<br>'}</li>`);
      continue;
    }
    closeList();
    if (block.type === 'rule') {
      out.push('<hr>');
      continue;
    }
    if (block.type === 'image') {
      out.push(`<figure><img src="${escapeHtml(block.src)}" alt=""></figure>`);
      continue;
    }
    if (block.type === 'table') {
      const rows = block.rows
        .map((row) => `<tr>${row.map((cell) => `<${cell.head ? 'th' : 'td'}>${cell.runs.map(runHtml).join('')}</${cell.head ? 'th' : 'td'}>`).join('')}</tr>`)
        .join('');
      out.push(`<table>${rows}</table>`);
      continue;
    }
    const tag = TAG_OF[block.type] ?? 'p';
    const styles = [];
    if (block.align && block.align !== 'left') styles.push(`text-align:${block.align}`);
    if (block.indent) styles.push(`margin-left:${block.indent * 36}px`);
    const attr = styles.length ? ` style="${styles.join(';')}"` : '';
    out.push(`<${tag}${attr}>${block.runs.map(runHtml).join('') || '<br>'}</${tag}>`);
  }
  closeList();
  return out.join('\n');
}

export const blocksToText = (blocks) =>
  blocks
    .map((block) => {
      if (block.type === 'rule') return '---';
      if (block.type === 'image') return '';
      if (block.type === 'table') return block.rows.map((row) => row.map((cell) => cell.runs.map((r) => r.text).join('')).join('\t')).join('\n');
      const text = (block.runs ?? []).map((run) => run.text).join('');
      if (block.type === 'bullet') return `${'  '.repeat(block.depth ?? 0)}- ${text}`;
      if (block.type === 'ordered') return `${'  '.repeat(block.depth ?? 0)}1. ${text}`;
      return text;
    })
    .join('\n');

export function blocksToMarkdown(blocks) {
  const mark = (run) => {
    let text = run.text;
    if (!text.trim()) return text;
    if (run.mono) text = `\`${text}\``;
    if (run.bold) text = `**${text}**`;
    if (run.italic) text = `*${text}*`;
    if (run.strike) text = `~~${text}~~`;
    if (run.link) text = `[${text}](${run.link})`;
    return text;
  };
  const counters = [];
  return blocks
    .map((block) => {
      const body = (block.runs ?? []).map(mark).join('');
      if (block.type === 'rule') return '---';
      if (block.type === 'image') return `![](${block.src})`;
      if (block.type === 'quote') return `> ${body}`;
      if (block.type === 'code') return '```\n' + (block.runs ?? []).map((r) => r.text).join('') + '\n```';
      if (block.type === 'bullet') return `${'  '.repeat(block.depth ?? 0)}- ${body}`;
      if (block.type === 'ordered') {
        const depth = block.depth ?? 0;
        counters.length = depth + 1;
        counters[depth] = (counters[depth] ?? 0) + 1;
        return `${'  '.repeat(depth)}${counters[depth]}. ${body}`;
      }
      if (block.type === 'table') {
        const rows = block.rows.map((row) => `| ${row.map((cell) => cell.runs.map((r) => r.text).join('')).join(' | ')} |`);
        const head = block.rows[0]?.length ?? 0;
        rows.splice(1, 0, `|${' --- |'.repeat(head)}`);
        return rows.join('\n');
      }
      const level = { h1: 1, h2: 2, h3: 3, h4: 4, h5: 5, h6: 6 }[block.type];
      return level ? `${'#'.repeat(level)} ${body}` : body;
    })
    .join('\n\n');
}

export const outlineOf = (blocks) =>
  blocks
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => /^h[1-6]$/.test(block.type))
    .map(({ block, index }) => ({
      index,
      level: Number(block.type.slice(1)),
      text: (block.runs ?? []).map((run) => run.text).join('').trim(),
    }))
    .filter((entry) => entry.text);

export const countWords = (blocks) => {
  const own = (block) =>
    block.type === 'table'
      ? block.rows.flatMap((row) => row.map((cell) => cell.runs.map((run) => run.text).join(''))).join(' ')
      : (block.runs ?? []).map((run) => run.text).join('');
  const text = blocks.map(own).join('\n');
  const words = text.trim().match(/[^\s]+/g);
  return {
    words: words ? words.length : 0,
    characters: text.replace(/\n/g, '').length,
    paragraphs: blocks.filter((block) => block.runs?.length).length,
  };
};
